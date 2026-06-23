import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const targetFile = path.resolve(currentDir, '../services/assetRelayService.ts');
const source = await readFile(targetFile, 'utf8');

assert.match(
  source,
  /const injectProjectName = \(\s*payload: Record<string, unknown>,\s*projectName: string\s*\): Record<string, unknown> => \{/s,
  '缺少 ProjectName 注入函数'
);

assert.match(
  source,
  /if \(currentProjectName\) \{\s*return payload\s*\}/s,
  '现有 ProjectName 不应被重复覆盖'
);

assert.match(
  source,
  /return \{\s*\.\.\.payload,\s*ProjectName: projectName\s*\}/s,
  '缺少默认 ProjectName 注入逻辑'
);

assert.match(
  source,
  /return callRelay<T>\(\s*action,\s*injectProjectName\(payload, context\.projectName\),/s,
  '素材库 API 调用未接入 ProjectName 注入'
);

console.log('assetRelayService ProjectName 注入断言通过');
