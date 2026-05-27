interface FriendlyModerationOptions {
  includeUnknownReasonCode?: boolean
}

interface FriendlyVideoFailureOptions extends FriendlyModerationOptions {
  status?: unknown
}

interface ModerationReasonCopy {
  label: string
  suggestion: string
}

const MODERATION_REASON_COPY: Record<string, ModerationReasonCopy> = {
  violence: {
    label: '涉及暴力或伤害内容',
    suggestion: '请弱化打斗、攻击、受伤、血腥、武器等描述。'
  },
  'graphic-violence': {
    label: '涉及明显血腥或重度暴力内容',
    suggestion: '请删除血浆、伤口特写、残肢等过于刺激的描述。'
  },
  sexual: {
    label: '涉及成人、裸露或性暗示内容',
    suggestion: '请改成非裸露、非挑逗、非性暗示的中性表达。'
  },
  'people-in-user-uploads': {
    label: '上传的参考图中包含人物或清晰人脸',
    suggestion: '请尽量改用不含人物主体的参考图，或先移除参考图后重试。'
  }
}

const normalizeModerationReason = (reason: string): string =>
  reason.trim().toLowerCase().replace(/_/g, '-')

const extractModerationReasons = (message: string): string[] => {
  const matched = message.match(/Possible reasons:\s*([^\n]+)/i)
  if (!matched?.[1]) return []

  const reasonSegment = matched[1].trim().replace(/[.。]+$/, '')
  return Array.from(
    new Set(
      reasonSegment.split(',').map(normalizeModerationReason).filter(Boolean)
    )
  )
}

const buildUnknownReasonCopy = (
  reason: string,
  includeUnknownReasonCode: boolean
): string => {
  if (!includeUnknownReasonCode) {
    return '触发了内容安全策略，请删减相关敏感描述或参考图后重试。'
  }

  return `触发了内容安全策略（${reason}），请删减相关敏感描述或参考图后重试。`
}

export const toFriendlyModerationMessage = (
  message?: string | null,
  options: FriendlyModerationOptions = {}
): string | null => {
  if (!message) return null
  if (
    !/blocked by our moderation system/i.test(message) &&
    !/Possible reasons:/i.test(message)
  ) {
    return null
  }

  const reasons = extractModerationReasons(message)
  const lines = ['内容审核未通过，请调整提示词或参考图后重试。']

  if (reasons.length === 0) {
    lines.push(
      '建议避免血腥暴力、成人性暗示内容；如上传了参考图，尽量不要包含人物或清晰人脸。'
    )
    return lines.join('\n')
  }

  lines.push('你可以这样修改：')
  reasons.forEach((reason) => {
    const copy = MODERATION_REASON_COPY[reason]
    lines.push(
      copy
        ? `- ${copy.label}：${copy.suggestion}`
        : `- ${buildUnknownReasonCopy(reason, !!options.includeUnknownReasonCode)}`
    )
  })

  return lines.join('\n')
}

export const toFriendlyVideoFailureMessage = (
  message?: string | null,
  options: FriendlyVideoFailureOptions = {}
): string | null => {
  if (!message) return null

  const moderationMessage = toFriendlyModerationMessage(message, options)
  if (moderationMessage) return moderationMessage

  const normalizedMessage = String(message || '').trim()
  const compactMessage = normalizedMessage.toLowerCase()
  const numericStatus = Number(options.status)

  if (
    normalizedMessage.includes('对象存储未配置') ||
    normalizedMessage.includes('当前项目上下文不可用，无法同步到对象存储')
  ) {
    return '对象存储未配置或项目上下文不完整，请先检查对象存储配置后再重试。'
  }

  if (
    normalizedMessage.includes('上传资源到对象存储失败') ||
    normalizedMessage.includes('对象存储上传失败') ||
    normalizedMessage.includes('TOS上传失败')
  ) {
    if (compactMessage.includes('failed to fetch')) {
      return [
        '视频已生成成功，但回填到对象存储时网络请求中断。',
        '这更像本地代理、浏览器扩展、网络抖动或页面热更新导致的中断。',
        '建议重试一次；如仍失败，请复制视频日志并附带终端里的 [tos-proxy] 日志。'
      ].join('\n')
    }

    if (
      normalizedMessage.includes('当前资源缺少可上传的公网 URL') ||
      normalizedMessage.includes('未返回可用公网URL')
    ) {
      return '视频已生成，但回填时没有拿到可用的公网地址，请检查对象存储配置或源视频链接后重试。'
    }

    if (normalizedMessage.includes('未返回 objectKey')) {
      return '对象存储已响应，但没有返回有效的 objectKey，请检查 TOS 代理服务和对象存储配置。'
    }

    return '视频已生成成功，但上传到对象存储时失败。请重试；如仍失败，请把复制的视频日志和终端里的 [tos-proxy] 日志发我。'
  }

  if (compactMessage.includes('failed to fetch')) {
    return [
      '网络请求未完成，可能是本地代理、浏览器扩展、网络中断或页面刷新导致。',
      '建议先重试一次；若仍失败，请把复制的视频日志发我排查。'
    ].join('\n')
  }

  if (
    normalizedMessage.includes('创建视频任务失败') ||
    normalizedMessage.includes('下载视频失败') ||
    normalizedMessage.includes('未返回任务 ID') ||
    normalizedMessage.includes('未返回任务ID') ||
    normalizedMessage.includes('No video URL returned') ||
    normalizedMessage.includes('视频转base64失败')
  ) {
    return '视频生成服务返回异常，问题更可能发生在任务创建、结果下载或结果解析阶段，请稍后重试。'
  }

  if (numericStatus === 400) {
    return '请求参数可能有误，或提示词触发了风控限制，请调整后重试。'
  }

  if (numericStatus === 500 || numericStatus === 503) {
    return '视频生成服务繁忙，请稍后重试。'
  }

  return null
}
