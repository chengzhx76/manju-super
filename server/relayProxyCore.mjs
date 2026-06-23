import crypto from 'node:crypto';

const RELAY_SERVICE = 'ark';
const RELAY_VERSION = '2024-01-01';
const RELAY_REGION = 'cn-beijing';
const OFFICIAL_ARK_OPENAPI_BASE_URL = 'https://ark.cn-beijing.volcengineapi.com';
const RELAY_PROXY_REQUEST_ID_HEADER = 'X-Relay-Proxy-Request-Id';
const RELAY_UPSTREAM_REQUEST_ID_HEADER = 'X-Relay-Upstream-Request-Id';
const RELAY_UPSTREAM_TRACE_ID_HEADER = 'X-Relay-Upstream-Trace-Id';

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const nowIso = () => new Date().toISOString();

const createRequestId = () => crypto.randomUUID().slice(0, 8);

const maskValue = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`;
};

const summarizeEndpoint = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return raw.slice(0, 160);
  }
};

const sanitizeText = (value) => {
  const raw = String(value || '');
  if (!raw) return '';
  return raw
    .replace(
      /\b(Authorization\s*[:=]\s*)([^\s,;]+(?:\s+[^\s,;]+)*)/gi,
      '$1[REDACTED]'
    )
    .replace(/\b(Credential=)([^,\s]+)/gi, '$1[REDACTED]')
    .replace(/\b(Signature=)([a-f0-9]+)/gi, '$1[REDACTED]')
    .replace(
      /("?(?:access[_-]?key|accessKeyId|secret[_-]?key|secretAccessKey)"?\s*[:=]\s*"?)([^",\s}]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/\b(AK|SK)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]');
};

const sanitizeForLogs = (value, seen = new WeakSet()) => {
  if (typeof value === 'string') return sanitizeText(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogs(item, seen));
  }

  return Object.entries(value).reduce((acc, [key, current]) => {
    if (/secret[_-]?key|secretAccessKey|authorization|signature/i.test(key)) {
      acc[key] = '[REDACTED]';
      return acc;
    }
    if (/access[_-]?key|accessKeyId/i.test(key)) {
      acc[key] = maskValue(current);
      return acc;
    }
    acc[key] = sanitizeForLogs(current, seen);
    return acc;
  }, {});
};

const logRelayProxy = (level, event, details = {}) => {
  const logger =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logger(`[relay-proxy] ${event}`, {
    timestamp: nowIso(),
    ...sanitizeForLogs(details),
  });
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

const pickFirstNonEmptyString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return undefined;
};

const extractUpstreamMeta = (payload, response) => {
  const responseMetadata = isRecordObject(payload?.ResponseMetadata)
    ? payload.ResponseMetadata
    : null;
  return {
    requestId: pickFirstNonEmptyString(
      responseMetadata?.RequestId,
      responseMetadata?.RequestID,
      payload?.requestId,
      payload?.RequestId,
      response?.headers?.get?.('x-tt-logid'),
      response?.headers?.get?.('x-request-id'),
      response?.headers?.get?.('x-requestid')
    ),
    traceId: pickFirstNonEmptyString(
      responseMetadata?.TraceId,
      responseMetadata?.TraceID,
      payload?.traceId,
      payload?.TraceId,
      response?.headers?.get?.('x-trace-id'),
      response?.headers?.get?.('x-traceid')
    ),
  };
};

const normalizeBaseUrl = () => {
  let url;
  try {
    url = new URL(OFFICIAL_ARK_OPENAPI_BASE_URL);
  } catch {
    throw new RelayProxyError('官方素材库 BaseURL 配置无效', 500);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new RelayProxyError('官方素材库 BaseURL 协议无效', 500);
  }

  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
};

const normalizeConfig = (rawConfig) => {
  if (!isRecordObject(rawConfig)) return null;
  const accessKey = String(rawConfig.accessKeyId || rawConfig.access_key || '').trim();
  const secretKey = String(
    rawConfig.secretAccessKey || rawConfig.secret_key || ''
  ).trim();
  if (!accessKey || !secretKey) return null;
  return {
    endpoint: normalizeBaseUrl(),
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
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

  const dateKey = hmac(Buffer.from(config.secretAccessKey, 'utf8'), shortDate);
  const regionKey = hmac(dateKey, RELAY_REGION);
  const serviceKey = hmac(regionKey, RELAY_SERVICE);
  const signingKey = hmac(serviceKey, 'request');
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return {
    'Content-Type': 'application/json',
    Host: url.host,
    'X-Date': timestamp,
    'X-Content-Sha256': payloadHash,
    Authorization: `HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

const buildActionUrl = (endpoint, action) => {
  const requestUrl = new URL(`${endpoint.replace(/\/+$/, '')}/`);
  requestUrl.searchParams.set('Action', action);
  requestUrl.searchParams.set('Version', RELAY_VERSION);
  return requestUrl;
};

class RelayProxyError extends Error {
  constructor(message, statusCode = 500, metadata = {}) {
    super(sanitizeText(message));
    this.statusCode = statusCode;
    this.requestId = metadata.requestId;
    this.traceId = metadata.traceId;
  }
}

const callRelay = async ({
  config,
  action,
  payload,
  requireHttp200 = false,
  requestId,
}) => {
  const body = JSON.stringify(payload || {});
  const startedAt = Date.now();
  const url = buildActionUrl(config.endpoint, action);
  try {
    const headers = buildSignedHeaders({ config, url, body });
    logRelayProxy('info', 'upstream:start', {
      requestId,
      action,
      endpoint: summarizeEndpoint(config.endpoint),
      requestUrl: `${url.origin}${url.pathname}`,
    });
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
    const upstreamMeta = extractUpstreamMeta(parsed, response);
    if (!response.ok) {
      const message = sanitizeText(extractErrorMessage(parsed));
      logRelayProxy('warn', 'upstream:response-error', {
        requestId,
        action,
        endpoint: summarizeEndpoint(config.endpoint),
        requestUrl: `${url.origin}${url.pathname}`,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        upstreamRequestId: upstreamMeta.requestId,
        upstreamTraceId: upstreamMeta.traceId,
        message,
      });
      throw new RelayProxyError(message, response.status, upstreamMeta);
    }

    logRelayProxy('info', 'upstream:success', {
      requestId,
      action,
      endpoint: summarizeEndpoint(config.endpoint),
      requestUrl: `${url.origin}${url.pathname}`,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      upstreamRequestId: upstreamMeta.requestId,
      upstreamTraceId: upstreamMeta.traceId,
    });
    if (parsed && typeof parsed === 'object' && 'Result' in parsed) {
      return parsed.Result;
    }
    return parsed;
  } catch (error) {
    logRelayProxy('error', 'upstream:failed', {
      requestId,
      action,
      endpoint: summarizeEndpoint(config.endpoint),
      requestUrl: `${url.origin}${url.pathname}`,
      durationMs: Date.now() - startedAt,
      upstreamRequestId: error?.requestId,
      upstreamTraceId: error?.traceId,
      message: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof RelayProxyError) throw error;
    throw new RelayProxyError(
      error instanceof Error ? error.message : '素材库请求失败',
      500
    );
  }
};

export const createRelayProxyHandler = () => {
  return async (req, res, next) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;
    const requestId = createRequestId();
    const startedAt = Date.now();
    const context = {
      requestId,
      pathname,
      method: req.method || 'GET',
    };
    res.setHeader(RELAY_PROXY_REQUEST_ID_HEADER, requestId);
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
        logRelayProxy('info', 'request:start', context);
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
          requestId,
        });
        logRelayProxy('info', 'request:success', {
          ...context,
          action,
          endpoint: summarizeEndpoint(config?.endpoint),
          durationMs: Date.now() - startedAt,
          statusCode: 200,
        });
        json(res, 200, { success: true, result });
      } catch (error) {
        const statusCode = Number(error?.statusCode || 500);
        if (error?.requestId) {
          res.setHeader(RELAY_UPSTREAM_REQUEST_ID_HEADER, String(error.requestId));
        }
        if (error?.traceId) {
          res.setHeader(RELAY_UPSTREAM_TRACE_ID_HEADER, String(error.traceId));
        }
        logRelayProxy('error', 'request:failed', {
          ...context,
          durationMs: Date.now() - startedAt,
          statusCode,
          upstreamRequestId: error?.requestId,
          upstreamTraceId: error?.traceId,
          message: error instanceof Error ? error.message : String(error),
        });
        json(res, statusCode, {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          requestId: String(error?.requestId || requestId),
          relayRequestId: requestId,
          ...(error?.traceId ? { traceId: String(error.traceId) } : {}),
        });
      }
      return;
    }

    json(res, 404, { success: false, message: 'Relay API Not Found' });
  };
};
