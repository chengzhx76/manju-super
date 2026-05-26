import { RenderLog } from '../types'

type VideoDebugLogLevel = 'info' | 'warn' | 'error'

interface VideoDebugLogEntryInput {
  traceId: string
  source: string
  stage: string
  level?: VideoDebugLogLevel
  details?: Record<string, unknown>
}

export interface VideoDebugLogEntry {
  id: string
  traceId: string
  source: string
  stage: string
  level: VideoDebugLogLevel
  timestamp: number
  details?: Record<string, string>
}

const STORAGE_KEY = 'bigbanana_video_debug_logs_v1'
const MAX_ENTRIES = 600

let memoryFallback: VideoDebugLogEntry[] = []

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readEntries = (): VideoDebugLogEntry[] => {
  if (!canUseStorage()) return memoryFallback
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VideoDebugLogEntry[]) : []
  } catch {
    return []
  }
}

const writeEntries = (entries: VideoDebugLogEntry[]) => {
  memoryFallback = entries
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Ignore storage quota and serialization failures to avoid affecting UX.
  }
}

const stringifyDetailValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const sanitizeDetails = (
  details?: Record<string, unknown>
): Record<string, string> | undefined => {
  if (!details) return undefined
  const normalizedEntries = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const stringValue = stringifyDetailValue(value).trim()
      const limited =
        stringValue.length > 500
          ? `${stringValue.slice(0, 500)}...(truncated)`
          : stringValue
      return [key, limited] as const
    })
    .filter(([, value]) => value)

  return normalizedEntries.length > 0
    ? Object.fromEntries(normalizedEntries)
    : undefined
}

export const appendVideoDebugLog = ({
  traceId,
  source,
  stage,
  level = 'info',
  details
}: VideoDebugLogEntryInput) => {
  const normalizedTraceId = String(traceId || '').trim()
  if (!normalizedTraceId) return

  const nextEntry: VideoDebugLogEntry = {
    id: `video-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    traceId: normalizedTraceId,
    source: String(source || '').trim() || 'unknown',
    stage: String(stage || '').trim() || 'unknown',
    level,
    timestamp: Date.now(),
    details: sanitizeDetails(details)
  }

  const current = readEntries()
  writeEntries([...current, nextEntry].slice(-MAX_ENTRIES))
}

export const getVideoDebugLogs = (traceId?: string): VideoDebugLogEntry[] => {
  const entries = readEntries()
  const normalizedTraceId = String(traceId || '').trim()
  const filtered = normalizedTraceId
    ? entries.filter((entry) => entry.traceId === normalizedTraceId)
    : entries
  return filtered.sort((a, b) => a.timestamp - b.timestamp)
}

const formatEntryDetails = (details?: Record<string, string>): string => {
  if (!details) return ''
  return Object.entries(details)
    .map(([key, value]) => `    - ${key}: ${value}`)
    .join('\n')
}

const formatRenderLogSummary = (log: RenderLog): string => {
  const lines = [
    `资源名称: ${log.resourceName || '-'}`,
    `资源编号: ${log.resourceId || '-'}`,
    `类型: ${log.type}`,
    `状态: ${log.status}`,
    `模型: ${log.model || '-'}`,
    `时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`,
    `耗时: ${typeof log.duration === 'number' ? `${log.duration}ms` : '-'}`,
    `错误: ${log.error || '-'}`,
    `提示词: ${log.prompt || '-'}`
  ]
  return lines.join('\n')
}

export const formatVideoDebugReport = (
  log: RenderLog,
  entries: VideoDebugLogEntry[]
): string => {
  const traceId = String(log.resourceId || '').trim()
  const header = [
    '请把下面这段完整日志发给 AI 排查视频生成问题：',
    '',
    '[渲染日志概要]',
    formatRenderLogSummary(log),
    ''
  ]

  if (entries.length === 0) {
    header.push(
      '[调试追踪]',
      traceId ? `traceId: ${traceId}` : 'traceId: 无',
      '未找到对应的调试追踪明细，当前仅包含渲染日志概要。'
    )
    return header.join('\n')
  }

  const traceLines = entries.map((entry, index) => {
    const detailsBlock = formatEntryDetails(entry.details)
    return [
      `${index + 1}. ${new Date(entry.timestamp).toLocaleString('zh-CN')} [${entry.level.toUpperCase()}] ${entry.source} -> ${entry.stage}`,
      detailsBlock
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    ...header,
    '[调试追踪]',
    `traceId: ${traceId || entries[0].traceId}`,
    ...traceLines
  ].join('\n')
}
