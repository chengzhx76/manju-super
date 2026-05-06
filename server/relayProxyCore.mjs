import crypto from 'node:crypto';

const RELAY_SERVICE = 'ark';
const RELAY_VERSION = '2024-01-01';
const RELAY_REGION = 'cn-beijing';

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const isRecordObject = (value) => typeof value === 'object' && value !== null;

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
};

const parseJsonResponse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const extractErrorMessage = (value) => {
  if (!value) return '素材库请求失败';
  if (typeof value === 'string') return value;
  if (!isRecordObject(value)) return String(value);

  const message = value.message;
  if (typeof message === 'string') return message;
  const upperMessage = value.Message;
  if (typeof upperMessage === 'string') return upperMessage;

  const error = value.error;
  if (isRecordObject(error) && typeof error.message === 'string') {
    return error.message;
  }

  const upperError = value.Error;
  if (isRecordObject(upperError) && typeof upperError.Message === 'string') {
    return upperError.Message;
  }

  const responseMetadata = value.ResponseMetadata;
  if (isRecordObject(responseMetadata) && isRecordObject(responseMetadata.Error)) {
    const nestedMessage = responseMetadata.Error.Message;
    if (typeof nestedMessage === 'string') return nestedMessage;
  }

  return JSON.stringify(value);
};

const normalizeConfig = (rawConfig) => {
  if (!isRecordObject(rawConfig)) return null;
  const address = String(rawConfig.address || '').trim().replace(/\/+$/, '');
  const accessKey = String(rawConfig.access_key || '').trim();
  const secretKey = String(rawConfig.secret_key || '').trim();
  if (!address || !accessKey || !secretKey) return null;
  return {
    address,
    access_key: accessKey,
    secret_key: secretKey,
  };
};

const encodeRFC3986 = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const toCanonicalPath = (url) =>
  url.pathname
    .split('/')
    .map((segment) => encodeRFC3986(segment))
    .join('/');

const toCanonicalQuery = (url) =>
  Array.from(url.searchParams.entries())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
      return leftValue.localeCompare(rightValue);
    })
    .map(([key, value]) => `${encodeRFC3986(key)}=${encodeRFC3986(value)}`)
    .join('&');

const toIsoDate = (date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '');

const sha256Hex = (value) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const hmac = (key, value) =>
  crypto.createHmac('sha256', key).update(value, 'utf8').digest();

const buildSignedHeaders = ({ config, url, body }) => {
  const timestamp = toIsoDate(new Date());
  const shortDate = timestamp.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders = [
    ['content-type', 'application/json'],
    ['host', url.host],
    ['x-content-sha256', payloadHash],
    ['x-date', timestamp],
  ];
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(';');
  const canonicalRequest = [
    'POST',
    toCanonicalPath(url) || '/',
    toCanonicalQuery(url),
    canonicalHeaders.map(([key, value]) => `${key}:${value}\n`).join(''),
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${shortDate}/${RELAY_REGION}/${RELAY_SERVICE}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const dateKey = hmac(Buffer.from(config.secret_key, 'utf8'), shortDate);
  const regionKey = hmac(dateKey, RELAY_REGION);
  const serviceKey = hmac(regionKey, RELAY_SERVICE);
  const signingKey = hmac(serviceKey, 'request');
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return {
    'Content-Type': 'application/json',
    Host: url.host,
    'X-Date': timestamp,
    'X-Content-Sha256': payloadHash,
    Authorization: `HMAC-SHA256 Credential=${config.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

const buildActionUrls = (endpoint, action) => {
  const base = endpoint.replace(/\/+$/, '');
  return [
    `${base}/?Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(RELAY_VERSION)}`,
    `${base}/open/${encodeURIComponent(action)}`,
  ];
};

class RelayProxyError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const callRelay = async ({ config, action, payload, requireHttp200 = false }) => {
  const body = JSON.stringify(payload || {});
  let lastError = null;

  for (const requestUrl of buildActionUrls(config.address, action)) {
    try {
      const url = new URL(requestUrl);
      const headers = buildSignedHeaders({ config, url, body });
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
      });

      if (requireHttp200 && response.status !== 200) {
        throw new RelayProxyError(`素材库验证失败：HTTP ${response.status}`, response.status);
      }

      const responseText = await response.text();
      const parsed = parseJsonResponse(responseText);
      if (!response.ok) {
        const message = extractErrorMessage(parsed);
        if (response.status === 404 || response.status === 405) {
          lastError = new RelayProxyError(message, response.status);
          continue;
        }
        throw new RelayProxyError(message, response.status);
      }

      if (parsed && typeof parsed === 'object' && 'Result' in parsed) {
        return parsed.Result;
      }
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof RelayProxyError) throw lastError;
  throw new RelayProxyError(
    lastError instanceof Error ? lastError.message : '素材库请求失败',
    500
  );
};

export const createRelayProxyHandler = () => {
  return async (req, res, next) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;
    if (!pathname.startsWith('/api/relay/')) {
      if (typeof next === 'function') {
        next();
        return;
      }
      json(res, 404, { success: false, message: 'Not Found' });
      return;
    }

    if (pathname === '/api/relay/signed-call' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const config = normalizeConfig(body.config);
        const action = String(body.action || '').trim();
        const payload = isRecordObject(body.payload) ? body.payload : {};
        const requireHttp200 = Boolean(body.requireHttp200);

        if (!config) {
          throw new RelayProxyError('素材库配置缺失', 400);
        }
        if (!action) {
          throw new RelayProxyError('action 不能为空', 400);
        }

        const result = await callRelay({
          config,
          action,
          payload,
          requireHttp200,
        });
        json(res, 200, { success: true, result });
      } catch (error) {
        const statusCode = Number(error?.statusCode || 500);
        json(res, statusCode, {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    json(res, 404, { success: false, message: 'Relay API Not Found' });
  };
};
