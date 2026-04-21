import crypto from 'node:crypto';
import { TosClient } from '@volcengine/tos-sdk';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const normalizeText = (value) => String(value || '').trim();

const encodeRfc3986 = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const sanitizePath = (value) =>
  String(value || '')
    .split('/')
    .map((part) => encodeRfc3986(part))
    .join('/');

const hmacSha256 = (key, value, encoding) =>
  crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);

const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');

const buildSigningHeaders = ({
  method,
  url,
  bodyBuffer,
  accessKeyId,
  secretAccessKey,
  region,
  service,
}) => {
  const now = new Date();
  const tosDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const shortDate = tosDate.slice(0, 8);
  const bodyHash = sha256Hex(bodyBuffer);
  const canonicalHeaders = [
    ['host', url.host],
    ['x-tos-content-sha256', bodyHash],
    ['x-tos-date', tosDate],
  ];
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(';');
  const canonicalRequest = [
    method.toUpperCase(),
    `/${sanitizePath(url.pathname.replace(/^\/+/, ''))}`,
    '',
    canonicalHeaders.map(([key, value]) => `${key}:${value}\n`).join(''),
    signedHeaders,
    bodyHash,
  ].join('\n');
  const credentialScope = `${shortDate}/${region}/${service}/request`;
  const stringToSign = [
    'TOS4-HMAC-SHA256',
    tosDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest, 'utf8')),
  ].join('\n');
  const kDate = hmacSha256(`TOS4${secretAccessKey}`, shortDate);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'request');
  const signature = hmacSha256(kSigning, stringToSign, 'hex');
  return {
    host: url.host,
    'x-tos-content-sha256': bodyHash,
    'x-tos-date': tosDate,
    Authorization: `TOS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
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
  const targetUrl = buildTosWriteUrl({ region, bucketName, objectKey });
  const signedHeaders = buildSigningHeaders({
    method: 'PUT',
    url: targetUrl,
    bodyBuffer,
    accessKeyId: normalizeText(accessKeyId),
    secretAccessKey: normalizeText(secretAccessKey),
    region: normalizeText(region),
    service: 'tos',
  });
  const response = await fetch(targetUrl.toString(), {
    method: 'PUT',
    headers: {
      ...signedHeaders,
      'Content-Type': normalizeText(contentType) || 'application/octet-stream',
      'Content-Length': String(bodyBuffer.byteLength),
    },
    body: bodyBuffer,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TOS 上传失败(${response.status}) ${detail || ''}`.trim());
  }
  const publicUrl = `${normalizeText(host).replace(/\/+$/, '')}/${String(objectKey).replace(/^\/+/, '')}`;
  return { objectKey: String(objectKey), url: publicUrl };
};

const handleUploadByUrl = async (req, res) => {
  const body = await parseJsonBody(req);
  const sourceUrl = normalizeText(body.sourceUrl);
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
  const targetUrl = buildTosWriteUrl({
    region: body.region,
    bucketName: body.bucketName,
    objectKey: body.objectKey,
  });
  const signedHeaders = buildSigningHeaders({
    method: 'DELETE',
    url: targetUrl,
    bodyBuffer: Buffer.alloc(0),
    accessKeyId: normalizeText(body.accessKeyId),
    secretAccessKey: normalizeText(body.secretAccessKey),
    region: normalizeText(body.region),
    service: 'tos',
  });
  const response = await fetch(targetUrl.toString(), {
    method: 'DELETE',
    headers: signedHeaders,
  });
  if (!response.ok && response.status !== 404) {
    const detail = await response.text();
    throw new Error(`TOS 删除失败(${response.status}) ${detail || ''}`.trim());
  }
  console.info('[tos-proxy] delete-object', {
    operator: 'frontend-user',
    action: 'delete_object',
    objectKey: body.objectKey,
    result: response.status === 404 ? 'not_found' : 'deleted',
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
  const client = createTosClient({
    accessKeyId: body.accessKeyId,
    secretAccessKey: body.secretAccessKey,
    region: body.region,
    bucketName: body.bucketName,
  });
  let verifyStatusCode = 200;
  try {
    const verifyResponse = await client.getObjectV2({
      bucket: normalizeText(body.bucketName),
      key: objectKey,
      dataType: 'buffer',
    });
    verifyStatusCode = Number(verifyResponse?.statusCode || 200);
  } catch (error) {
    const statusCode = Number(
      error?.statusCode || error?.response?.statusCode || 500
    );
    const code = normalizeText(error?.code || error?.data?.Code);
    const message = normalizeText(error?.message || error?.data?.Message);
    const detail = code || message ? ` Code=${code || '-'} Message=${message || '-'}` : '';
    throw new Error(
      `GetObject 验证失败(${statusCode})，请确认桶内存在 ${objectKey} 文件且 AK/SK 具备读取权限。${detail}`
    );
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
