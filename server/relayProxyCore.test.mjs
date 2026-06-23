import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { createRelayProxyHandler } from './relayProxyCore.mjs';

const nativeFetch = globalThis.fetch.bind(globalThis);

const createTestServer = async () => {
  const handler = createRelayProxyHandler();
  const server = http.createServer((req, res) => handler(req, res));

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('无法创建测试服务器');
  }

  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
};

const closeServer = async (server) => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const postSignedCall = async (origin, payload) => {
  const response = await nativeFetch(`${origin}/api/relay/signed-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: JSON.parse(text),
  };
};

const withMutedRelayLogs = async (run) => {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    return await run();
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
};

test('默认未填写 address 时，relay 使用官方 BaseURL 并生成签名头', async () => {
  const serverContext = await createTestServer();
  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  let upstreamInit;

  globalThis.fetch = async (url, init) => {
    upstreamUrl = String(url);
    upstreamInit = init;
    return new Response(JSON.stringify({ Result: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await withMutedRelayLogs(() =>
      postSignedCall(serverContext.origin, {
        action: 'ListAssetGroups',
        payload: { ProjectName: 'project-a' },
        config: {
          accessKeyId: 'ak-test-1234',
          secretAccessKey: 'sk-test-5678',
        },
      })
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);

    const requestUrl = new URL(upstreamUrl);
    assert.equal(requestUrl.origin, 'https://ark.cn-beijing.volcengineapi.com');
    assert.equal(requestUrl.searchParams.get('Action'), 'ListAssetGroups');
    assert.equal(requestUrl.searchParams.get('Version'), '2024-01-01');

    assert.equal(upstreamInit.method, 'POST');
    assert.match(upstreamInit.headers.Authorization, /^HMAC-SHA256 Credential=ak-test-1234\//);
    assert.ok(upstreamInit.headers['X-Date']);
    assert.ok(upstreamInit.headers['X-Content-Sha256']);
    assert.equal(upstreamInit.headers.Host, 'ark.cn-beijing.volcengineapi.com');
  } finally {
    globalThis.fetch = originalFetch;
    await closeServer(serverContext.server);
  }
});

test('即使传入自定义 address，relay 仍固定使用官方 BaseURL', async () => {
  const serverContext = await createTestServer();
  const originalFetch = globalThis.fetch;
  let upstreamUrl;

  globalThis.fetch = async (url) => {
    upstreamUrl = String(url);
    return new Response(JSON.stringify({ Result: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await withMutedRelayLogs(() =>
      postSignedCall(serverContext.origin, {
        action: 'ListAssetGroups',
        payload: { ProjectName: 'project-a' },
        config: {
          accessKeyId: 'ak-test-1234',
          secretAccessKey: 'sk-test-5678',
        },
      })
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    const requestUrl = new URL(upstreamUrl);
    assert.equal(requestUrl.origin, 'https://ark.cn-beijing.volcengineapi.com');
  } finally {
    globalThis.fetch = originalFetch;
    await closeServer(serverContext.server);
  }
});

test('上游错误会透传 requestId 和 traceId 到响应头与响应体', async () => {
  const serverContext = await createTestServer();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ResponseMetadata: {
          RequestId: 'req-upstream-123',
          TraceId: 'trace-upstream-456',
        },
        Error: {
          Message: 'upstream denied',
        },
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  try {
    const result = await withMutedRelayLogs(() =>
      postSignedCall(serverContext.origin, {
        action: 'ListAssetGroups',
        payload: { ProjectName: 'project-a' },
        config: {
          accessKeyId: 'ak-test-1234',
          secretAccessKey: 'sk-test-5678',
        },
      })
    );

    assert.equal(result.status, 403);
    assert.equal(result.body.success, false);
    assert.equal(result.body.message, 'upstream denied');
    assert.equal(result.body.requestId, 'req-upstream-123');
    assert.equal(result.body.traceId, 'trace-upstream-456');
    assert.ok(result.body.relayRequestId);
    assert.equal(
      result.headers.get('x-relay-upstream-request-id'),
      'req-upstream-123'
    );
    assert.equal(
      result.headers.get('x-relay-upstream-trace-id'),
      'trace-upstream-456'
    );
  } finally {
    globalThis.fetch = originalFetch;
    await closeServer(serverContext.server);
  }
});
