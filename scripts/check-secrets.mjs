import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.trae'
])

const TARGET_EXTS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs'
])

const IGNORE_FILES = new Set(['scripts/check-secrets.mjs'])

const RULES = [
  {
    name: 'TOS 签名 URL 参数',
    regex: /X-Tos-Credential=/gi
  },
  {
    name: '疑似火山 AK 前缀',
    regex: /AKLT[0-9A-Za-z_%\-]{8,}/g
  }
]

const ALLOW_PATTERNS = [/AKLT_REDACTED/gi, /X-Tos-Credential=AKLT_REDACTED/gi]

function walk(dir, collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      walk(fullPath, collector)
      continue
    }
    const ext = path.extname(entry.name).toLowerCase()
    if (TARGET_EXTS.has(ext)) {
      collector.push(fullPath)
    }
  }
}

function sanitizeLine(line) {
  let masked = line
  for (const allowRegex of ALLOW_PATTERNS) {
    masked = masked.replace(allowRegex, 'AKLT_REDACTED')
  }
  return masked
}

function scanFile(filePath) {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/')
  if (IGNORE_FILES.has(relativePath)) return []

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const findings = []

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1
    const originalLine = lines[i]
    if (
      originalLine.includes('`X-Tos-Credential=`') ||
      originalLine.includes('X-Tos-Credential=AKLT_REDACTED')
    ) {
      continue
    }
    if (ALLOW_PATTERNS.some((pattern) => pattern.test(originalLine))) {
      continue
    }
    const line = sanitizeLine(originalLine)
    for (const rule of RULES) {
      rule.regex.lastIndex = 0
      if (rule.regex.test(line)) {
        findings.push({
          filePath,
          lineNo,
          rule: rule.name,
          line: originalLine.trim().slice(0, 220)
        })
      }
    }
  }

  return findings
}

const files = []
walk(ROOT, files)

const allFindings = files.flatMap(scanFile)

if (allFindings.length > 0) {
  console.error('\n[check:secrets] 检测到疑似敏感信息，请先清理后再提交：\n')
  for (const finding of allFindings) {
    const relative = path.relative(ROOT, finding.filePath)
    console.error(
      `- ${relative}:${finding.lineNo} [${finding.rule}] ${finding.line}`
    )
  }
  console.error(
    '\n建议：将带签名 URL 与密钥替换为占位符（如 https://example.com/demo.png、AKLT_REDACTED）。\n'
  )
  process.exit(1)
}

console.log('[check:secrets] 未发现疑似敏感信息')
