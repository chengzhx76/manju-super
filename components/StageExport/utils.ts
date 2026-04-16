/**
 * StageExport 工具函数
 */
import { ProjectState, RenderLog } from '../../types'

/**
 * 收集并排序渲染日志
 */
export const collectRenderLogs = (project: ProjectState): RenderLog[] => {
  const logs = project.renderLogs || []
  return logs.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * 计算总时长
 */
export const calculateEstimatedDuration = (project: ProjectState): number => {
  return project.shots.reduce(
    (acc, shot) => acc + (shot.interval?.duration || 10),
    0
  )
}

/**
 * 获取完成的镜头列表
 */
export const getCompletedShots = (project: ProjectState) => {
  return project.shots.filter((s) => s.interval?.videoUrl)
}

/**
 * 计算进度百分比
 */
export const calculateProgress = (project: ProjectState): number => {
  const totalShots = project.shots.length
  const completedShots = getCompletedShots(project).length
  return totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0
}

/**
 * 格式化时间戳
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 格式化持续时间(毫秒转秒)
 */
export const formatDuration = (duration: number): string => {
  return `${(duration / 1000).toFixed(1)}秒`
}

/**
 * 检查是否有可下载的资源
 */
export const hasDownloadableAssets = (project: ProjectState): boolean => {
  return (
    project.scriptData?.characters.some(
      (c) => c.referenceImage || c.variations?.some((v) => v.referenceImage)
    ) ||
    project.scriptData?.scenes.some((s) => s.referenceImage) ||
    project.shots.some(
      (s) => s.keyframes?.some((k) => k.imageUrl) || s.interval?.videoUrl
    )
  )
}

/**
 * 统计日志状态
 */
export const getLogStats = (logs: RenderLog[]) => {
  return {
    total: logs.length,
    success: logs.filter((l) => l.status === 'success').length,
    failed: logs.filter((l) => l.status === 'failed').length
  }
}

/**
 * 获取日志类型图标
 */
export const getLogTypeIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    character: '👤',
    'character-variation': '👤',
    scene: '🎬',
    prop: '🧰',
    keyframe: '🖼️',
    video: '🎥',
    'script-parsing': '📝'
  }
  return iconMap[type] || '📝'
}

/**
 * 获取日志状态文案
 */
export const getLogStatusLabel = (status: string): string => {
  const labelMap: Record<string, string> = {
    success: '成功',
    failed: '失败',
    pending: '等待中'
  }

  return labelMap[status] || status
}

/**
 * 获取日志类型文案
 */
export const getLogTypeLabel = (type: string): string => {
  const labelMap: Record<string, string> = {
    character: '角色',
    'character-variation': '角色变体',
    scene: '场景',
    prop: '道具',
    keyframe: '关键帧',
    video: '视频',
    'script-parsing': '剧本解析'
  }

  return labelMap[type] || type
}

/**
 * 获取状态颜色类名
 */
export const getStatusColorClass = (status: string): string => {
  const colorMap: Record<string, string> = {
    success:
      'text-[var(--success-text)] bg-[var(--success-bg)] border-[var(--success-border)]',
    failed:
      'text-[var(--error-text)] bg-[var(--error-bg)] border-[var(--error-border)]',
    pending:
      'text-[var(--warning-text)] bg-[var(--warning-bg)] border-[var(--warning-border)]'
  }
  return (
    colorMap[status] ||
    'text-[var(--text-tertiary)] bg-[var(--border-secondary)]/10 border-[var(--border-secondary)]/30'
  )
}

/**
 * 检查日志是否有详细信息
 */
export const hasLogDetails = (log: RenderLog): boolean => {
  return !!(log.prompt || log.resourceId || log.inputTokens || log.outputTokens)
}
