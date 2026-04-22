import { TosClient } from '@volcengine/tos-sdk';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const normalizeText = (value) => String(value || '').trim();

const stripWrappingQuotes = (value) =>
  String(value || '')
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .trim();

const encodeRfc3986 = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const sanitizePath = (value) =>
  String(value || '')
    .split('/')
    .map((part) => encodeRfc3986(part))
    .join('/');

const tryDecodeBase64Secret = (rawSecret) => {
  const normalized = normalizeText(rawSecret);
  if (!normalized || normalized.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) return null;
  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim();
    if (!decoded || decoded === normalized) return null;
    if (!/^[\x20-\x7E]+$/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
};

const getSecretCandidates = (rawSecret) => {
  const normalized = normalizeText(rawSecret);
  const decoded = tryDecodeBase64Secret(normalized);
  if (decoded) return [normalized, decoded];
  return [normalized];
};

const shouldRetryWithNextSecret = (error) => {
  const statusCode = Number(error?.statusCode || error?.response?.statusCode || 0);
  const code = normalizeText(error?.code || error?.data?.Code);
  const message = normalizeText(error?.message || error?.data?.Message);
  return (
    statusCode === 403 &&
    /SignatureDoesNotMatch/i.test(`${code} ${message}`)
  );
};

const readBodyBuffer = async (req) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += next.length;
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error(`上传文件超过限制（${MAX_UPLOAD_BYTES} bytes）`);
    }
    chunks.push(next);
  }
  return Buffer.concat(chunks);
};

const parseJsonBody = async (req) => {
  const raw = (await readBodyBuffer(req)).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
};

const buildTosWriteUrl = ({ region, bucketName, objectKey }) => {
  const normalizedRegion = normalizeText(region);
  const normalizedBucketName = normalizeText(bucketName);
  const normalizedObjectKey = String(objectKey || '').replace(/^\/+/, '');
  if (!normalizedRegion || !normalizedBucketName || !normalizedObjectKey) {
    throw new Error('region、bucketName、objectKey 均为必填');
  }
  const endpoint = `https://${normalizedBucketName}.tos-${normalizedRegion}.volces.com/${sanitizePath(normalizedObjectKey)}`;
  return new URL(endpoint);
};

const validateCredentials = ({ accessKeyId, secretAccessKey, host }) => {
  if (!normalizeText(accessKeyId) || !normalizeText(secretAccessKey)) {
    throw new Error('accessKeyId 或 secretAccessKey 缺失');
  }
  if (!normalizeText(host)) {
    throw new Error('host 缺失');
  }
};

const createTosClient = ({ accessKeyId, secretAccessKey, region, bucketName }) =>
  new TosClient({
    accessKeyId: normalizeText(accessKeyId),
    accessKeySecret: normalizeText(secretAccessKey),
    region: normalizeText(region),
    bucket: normalizeText(bucketName),
    endpoint: `tos-${normalizeText(region)}.volces.com`,
  });

const buildPublicBaseUrl = ({ host, bucketName, region }) => {
  const normalizedBucket = normalizeText(bucketName);
  const normalizedRegion = normalizeText(region);
  const fallback = `https://${normalizedBucket}.tos-${normalizedRegion}.volces.com`;
  const normalizedHost = stripWrappingQuotes(host).replace(/\/+$/, '');
  if (!normalizedHost) return fallback;
  const hostWithProtocol = /^https?:\/\//i.test(normalizedHost)
    ? normalizedHost
    : `https://${normalizedHost}`;
  try {
    const url = new URL(hostWithProtocol);
    const endpointHost = `tos-${normalizedRegion}.volces.com`;
    if (url.hostname === endpointHost) {
      url.hostname = `${normalizedBucket}.${endpointHost}`;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback;
  }
};

const uploadBytesToTos = async ({
  bodyBuffer,
  contentType,
  region,
  bucketName,
  objectKey,
  host,
  accessKeyId,
  secretAccessKey,
}) => {
  validateCredentials({ accessKeyId, secretAccessKey, host });
  const secretCandidates = getSecretCandidates(secretAccessKey);
  let lastError = null;
  for (const candidateSecret of secretCandidates) {
    const client = createTosClient({
      accessKeyId,
      secretAccessKey: candidateSecret,
      region,
      bucketName,
    });
    try {
      await client.putObject({
        bucket: normalizeText(bucketName),
        key: String(objectKey || '').replace(/^\/+/, ''),
        body: bodyBuffer,
        contentType: normalizeText(contentType) || 'application/octet-stream',
        contentLength: bodyBuffer.byteLength,
      });
      const baseUrl = buildPublicBaseUrl({ host, bucketName, region });
      const publicUrl = `${baseUrl.replace(/\/+$/, '')}/${String(objectKey).replace(/^\/+/, '')}`;
      return { objectKey: String(objectKey), url: publicUrl };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const hasNextCandidate = secretCandidates[secretCandidates.length - 1] !== candidateSecret;
      if (!(hasNextCandidate && shouldRetryWithNextSecret(error))) {
        const statusCode = Number(error?.statusCode || error?.response?.statusCode || 500);
        const code = normalizeText(error?.code || error?.data?.Code);
        const message = normalizeText(error?.message || error?.data?.Message);
        const detail = code || message ? ` Code=${code || '-'} Message=${message || '-'}` : '';
        throw new Error(`TOS 上传失败(${statusCode})${detail}`);
      }
      console.warn('[tos-proxy] upload signature mismatch, retrying with decoded secret candidate');
    }
  }
  throw lastError || new Error('TOS 上传失败');
};

const handleUploadByUrl = async (req, res) => {
  const body = await parseJsonBody(req);
  const sourceUrl = stripWrappingQuotes(body.sourceUrl);
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error('sourceUrl 必须是 http/https URL');
  }
  const upstream = await fetch(sourceUrl, { redirect: 'follow' });
  if (!upstream.ok) {
    const detail = await upstream.text();
    throw new Error(`拉取源文件失败(${upstream.status}) ${detail || ''}`.trim());
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  const uploaded = await uploadBytesToTos({
    bodyBuffer: buffer,
    contentType: upstream.headers.get('content-type') || 'application/octet-stream',
    region: body.region,
    bucketName: body.bucketName,
    objectKey: body.objectKey,
    host: body.host,
    accessKeyId: body.accessKeyId,
    secretAccessKey: body.secretAccessKey,
  });
  console.info('[tos-proxy] upload-by-url', {
    operator: 'frontend-user',
    action: 'upload_object',
    objectKey: uploaded.objectKey,
    sourceUrl,
  });
  json(res, 200, uploaded);
};

const handleUploadFile = async (req, res) => {
  const request = new Request('http://localhost/api/tos/upload-file', {
    method: req.method || 'POST',
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('file 缺失');
  }
  const uploaded = await uploadBytesToTos({
    bodyBuffer: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || 'application/octet-stream',
    region: formData.get('region'),
    bucketName: formData.get('bucketName'),
    objectKey: formData.get('objectKey'),
    host: formData.get('host'),
    accessKeyId: formData.get('accessKeyId'),
    secretAccessKey: formData.get('secretAccessKey'),
  });
  console.info('[tos-proxy] upload-file', {
    operator: 'frontend-user',
    action: 'upload_object',
    objectKey: uploaded.objectKey,
    fileName: file.name,
    fileSize: file.size,
  });
  json(res, 200, uploaded);
};

const handleDeleteObject = async (req, res) => {
  const body = await parseJsonBody(req);
  validateCredentials({
    accessKeyId: body.accessKeyId,
    secretAccessKey: body.secretAccessKey,
    host: body.host,
  });
  const secretCandidates = getSecretCandidates(body.secretAccessKey);
  let deleteStatus = 204;
  let lastError = null;
  for (const candidateSecret of secretCandidates) {
    const client = createTosClient({
      accessKeyId: body.accessKeyId,
      secretAccessKey: candidateSecret,
      region: body.region,
      bucketName: body.bucketName,
    });
    try {
      const result = await client.deleteObject({
        bucket: normalizeText(body.bucketName),
        key: String(body.objectKey || '').replace(/^\/+/, ''),
      });
      deleteStatus = Number(result?.statusCode || 204);
      lastError = null;
      break;
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.response?.statusCode || 500);
      const code = normalizeText(error?.code || error?.data?.Code);
      const message = normalizeText(error?.message || error?.data?.Message);
      const hasNextCandidate = secretCandidates[secretCandidates.length - 1] !== candidateSecret;
      if (statusCode === 404 || /NoSuchKey/i.test(`${code} ${message}`)) {
        deleteStatus = 404;
        lastError = null;
        break;
      }
      if (!(hasNextCandidate && shouldRetryWithNextSecret(error))) {
        const detail = code || message ? ` Code=${code || '-'} Message=${message || '-'}` : '';
        throw new Error(`TOS 删除失败(${statusCode})${detail}`);
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn('[tos-proxy] delete signature mismatch, retrying with decoded secret candidate');
    }
  }
  if (lastError) {
    throw lastError || new Error('TOS 删除失败');
  }
  console.info('[tos-proxy] delete-object', {
    operator: 'frontend-user',
    action: 'delete_object',
    objectKey: body.objectKey,
    result: deleteStatus === 404 ? 'not_found' : 'deleted',
  });
  json(res, 200, { success: true, objectKey: body.objectKey });
};

const handleVerifyObject = async (req, res) => {
  const body = await parseJsonBody(req);
  validateCredentials({
    accessKeyId: body.accessKeyId,
    secretAccessKey: body.secretAccessKey,
    host: body.host,
  });
  const objectKey = normalizeText(body.objectKey) || 'ping.txt';
  const targetUrl = buildTosWriteUrl({
    region: body.region,
    bucketName: body.bucketName,
    objectKey,
  }).toString();
  let verifyStatusCode = 200;
  const secretCandidates = getSecretCandidates(body.secretAccessKey);
  let lastError = null;
  for (const candidateSecret of secretCandidates) {
    const client = createTosClient({
      accessKeyId: body.accessKeyId,
      secretAccessKey: candidateSecret,
      region: body.region,
      bucketName: body.bucketName,
    });
    try {
      const verifyResponse = await client.getObjectV2({
        bucket: normalizeText(body.bucketName),
        key: objectKey,
        dataType: 'buffer',
      });
      verifyStatusCode = Number(verifyResponse?.statusCode || 200);
      lastError = null;
      break;
    } catch (error) {
      const statusCode = Number(
        error?.statusCode || error?.response?.statusCode || 500
      );
      const code = normalizeText(error?.code || error?.data?.Code);
      const message = normalizeText(error?.message || error?.data?.Message);
      const detail = code || message ? ` Code=${code || '-'} Message=${message || '-'}` : '';
      lastError = new Error(
        `GetObject 验证失败(${statusCode})，请确认桶内存在 ${objectKey} 文件且 AK/SK 具备读取权限。${detail}`
      );
      const hasNextCandidate = secretCandidates[secretCandidates.length - 1] !== candidateSecret;
      if (!(hasNextCandidate && /SignatureDoesNotMatch/i.test(`${code} ${message}`))) {
        throw lastError;
      }
      console.warn('[tos-proxy] verify signature mismatch, retrying with decoded secret candidate');
    }
  }
  if (lastError) {
    throw lastError;
  }
  console.info('[tos-proxy] verify-object', {
    operator: 'frontend-user',
    action: 'verify_object',
    objectKey,
    statusCode: verifyStatusCode,
    result: 'ok',
  });
  json(res, 200, {
    success: true,
    statusCode: verifyStatusCode,
    message: `验证通过：成功读取 ${objectKey}，URL: ${targetUrl}`,
  });
};

export const createTosProxyHandler = () => {
  return async (req, res, next) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;
    if (!pathname.startsWith('/api/tos/')) {
      if (typeof next === 'function') {
        next();
        return;
      }
      json(res, 404, { success: false, message: 'Not Found' });
      return;
    }
    try {
      if (pathname === '/api/tos/upload-by-url' && req.method === 'POST') {
        await handleUploadByUrl(req, res);
        return;
      }
      if (pathname === '/api/tos/upload-file' && req.method === 'POST') {
        await handleUploadFile(req, res);
        return;
      }
      if (pathname === '/api/tos/delete-object' && req.method === 'POST') {
        await handleDeleteObject(req, res);
        return;
      }
      if (pathname === '/api/tos/verify-object' && req.method === 'POST') {
        await handleVerifyObject(req, res);
        return;
      }
      json(res, 404, { success: false, message: 'TOS API Not Found' });
    } catch (error) {
      json(res, 500, {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
};
