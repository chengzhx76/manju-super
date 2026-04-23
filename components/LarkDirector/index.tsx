import React, { useEffect, useRef, useState } from 'react'
import {
  Character,
  MediaAsset,
  MediaAssetType,
  ProjectState,
  Prop,
  Scene,
  Shot
} from '../../types'
import { useAlert } from '../GlobalAlert'
import { useProjectContext } from '../../contexts/ProjectContext'
import { convertImageToBase64 } from '../../services/storageService'
import {
  hasAssetRelayConfig,
  hasVolcengineTosConfig,
  resolveTosPublicUrlFromAssetId,
  uploadMediaAssetFile
} from '../../services/assetRelayService'
import {
  getNextMainShotId,
  parseShotId
} from '../../services/storyboardIdUtils'
import {
  Plus,
  Users,
  Image as ImageIcon,
  Film,
  Music2,
  Package,
  Maximize2,
  Play,
  Volume2,
  Download,
  Trash2,
  Edit2,
  RotateCw,
  LayoutGrid,
  Monitor,
  Smartphone,
  Sparkles,
  X,
  Upload,
  Loader2
} from 'lucide-react'
import ScriptEditorRich from './editor/ScriptEditorRich'

interface Props {
  project: ProjectState
  updateProject: (
    updates: Partial<ProjectState> | ((prev: ProjectState) => ProjectState)
  ) => void
  onGeneratingChange?: (isGenerating: boolean) => void
}

type EditingAssetType = 'character' | 'scene' | 'prop'

interface EditingAssetDraft {
  type: EditingAssetType
  id: string
  name: string
  description: string
  imageUrl: string
  shapeReferenceImage: string
}

interface NewMediaAssetDraft {
  type: MediaAssetType
  name: string
  mimeType: string
  dataUrl: string
  file?: File
}

const LarkDirector: React.FC<Props> = ({
  project,
  updateProject,
  onGeneratingChange
}) => {
  const { showAlert } = useAlert()
  const {
    project: seriesProject,
    allSeries,
    allEpisodes,
    currentEpisode
  } = useProjectContext()

  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [editingAsset, setEditingAsset] = useState<EditingAssetDraft | null>(
    null
  )
  const [originalEditingAsset, setOriginalEditingAsset] =
    useState<EditingAssetDraft | null>(null)
  const [showAddAssetMenu, setShowAddAssetMenu] = useState(false)
  const addAssetMenuCloseTimerRef = useRef<number | null>(null)
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null)
  const [newMediaAsset, setNewMediaAsset] = useState<NewMediaAssetDraft | null>(
    null
  )
  const [editingMediaAsset, setEditingMediaAsset] = useState<MediaAsset | null>(
    null
  )
  const [isSavingMediaAsset, setIsSavingMediaAsset] = useState(false)
  const [mediaUploadMessage, setMediaUploadMessage] = useState('')
  const [mediaUploadLogs, setMediaUploadLogs] = useState<string[]>([])

  // 临时使用 scenes 模拟 clip (因为我们目前没有 clip 结构，可以用 shot 或者 scene 来展示)
  const clips = project.shots || []
  const activeClip = clips[activeClipIndex] || null

  const getClipDisplayNumber = (clip: Shot, fallbackIndex: number): string => {
    const parsed = parseShotId(clip.id)
    if (parsed.mode === 'canonical') {
      return parsed.subIndex === undefined
        ? String(parsed.mainIndex)
        : `${parsed.mainIndex}-${parsed.subIndex}`
    }
    if (parsed.mode === 'scene-scoped') {
      return parsed.subIndex === undefined
        ? `${parsed.sceneIndex}-${parsed.shotIndex}`
        : `${parsed.sceneIndex}-${parsed.shotIndex}-${parsed.subIndex}`
    }
    return String(fallbackIndex + 1)
  }

  const activeClipTitle = activeClip ? `片段 ${activeClipIndex + 1}` : '片段'
  const normalizeRemoteUrl = (value: unknown): string =>
    String(value || '')
      .trim()
      .replace(/^[`'"\s]+|[`'"\s]+$/g, '')
      .trim()
  const resolveMediaRenderUrl = (asset: MediaAsset): string => {
    const directRemoteUrl = normalizeRemoteUrl(asset.remoteUrl)
    if (directRemoteUrl) return directRemoteUrl
    const tosRemoteUrl = normalizeRemoteUrl(
      resolveTosPublicUrlFromAssetId(asset.tosAssetId)
    )
    if (tosRemoteUrl) return tosRemoteUrl
    return String(asset.dataUrl || '').trim()
  }
  const mediaAssets = project.scriptData?.mediaAssets || []
  const mediaImages = mediaAssets.filter((item) => item.type === 'image')
  const mediaVideos = mediaAssets.filter((item) => item.type === 'video')
  const mediaAudios = mediaAssets.filter((item) => item.type === 'audio')
  const mediaTypeText: Record<MediaAssetType, string> = {
    image: '图片',
    video: '视频',
    audio: '音频'
  }
  const mediaAcceptType: Record<MediaAssetType, string> = {
    image: 'image/*',
    video: '.mp4,.mov,video/mp4,video/quicktime',
    audio: '.wav,.mp3,audio/wav,audio/x-wav,audio/mpeg'
  }
  const mediaMaxSizeMap: Record<MediaAssetType, number> = {
    image: 30 * 1024 * 1024,
    video: 50 * 1024 * 1024,
    audio: 15 * 1024 * 1024
  }

  useEffect(() => {
    if (isSavingMediaAsset || mediaUploadLogs.length === 0) return
    if (mediaUploadMessage === '上传失败') return
    const timer = window.setTimeout(() => {
      setMediaUploadLogs([])
      setMediaUploadMessage('')
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [isSavingMediaAsset, mediaUploadLogs, mediaUploadMessage])

  useEffect(() => {
    return () => {
      if (addAssetMenuCloseTimerRef.current !== null) {
        window.clearTimeout(addAssetMenuCloseTimerRef.current)
      }
    }
  }, [])

  const clearAddAssetMenuCloseTimer = () => {
    if (addAssetMenuCloseTimerRef.current !== null) {
      window.clearTimeout(addAssetMenuCloseTimerRef.current)
      addAssetMenuCloseTimerRef.current = null
    }
  }

  const openAddAssetMenu = () => {
    clearAddAssetMenuCloseTimer()
    setShowAddAssetMenu(true)
  }

  const scheduleCloseAddAssetMenu = () => {
    clearAddAssetMenuCloseTimer()
    addAssetMenuCloseTimerRef.current = window.setTimeout(() => {
      setShowAddAssetMenu(false)
      addAssetMenuCloseTimerRef.current = null
    }, 180)
  }
  const assetSectionTitleClass =
    'flex items-center gap-2 mb-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest'
  const assetGridClass = 'grid grid-cols-2 gap-3'
  const assetCardClass = 'flex flex-col gap-1.5 group'
  const assetImageWrapClass =
    'aspect-video bg-[var(--bg-elevated)] rounded-lg overflow-hidden border border-[var(--border-primary)] group-hover:border-[var(--accent-border)] transition-colors relative'
  const assetImageClass = 'w-full h-full object-cover'
  const assetEmptyClass =
    'w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[10px]'
  const assetNameClass =
    'text-[10px] text-[var(--text-secondary)] text-center truncate'

  useEffect(() => {
    if (clips.length === 0) {
      if (activeClipIndex !== 0) setActiveClipIndex(0)
      return
    }
    if (activeClipIndex >= clips.length) {
      setActiveClipIndex(clips.length - 1)
    }
  }, [clips.length, activeClipIndex])

  const createNewClip = (): Shot => {
    const newId = getNextMainShotId(clips.map((shot) => shot.id))
    const defaultSceneId =
      project.scriptData?.scenes?.[0]?.id || 'scene_unassigned'
    return {
      id: newId,
      sceneId: defaultSceneId,
      actionSummary: '',
      larkActionSummary: '',
      larkActionSummaryHtml: '',
      cameraMovement: '平移',
      shotSize: '中景',
      characters: [],
      keyframes: [
        {
          id: `kf-${newId}-start`,
          type: 'start',
          visualPrompt: '',
          status: 'pending'
        }
      ]
    }
  }

  const handleAddClip = () => {
    const nextIndex = clips.length
    const newClip = createNewClip()
    updateProject((prev) => ({
      ...prev,
      shots: [...(prev.shots || []), newClip]
    }))
    setActiveClipIndex(nextIndex)
  }

  const handleInsertClip = (insertIndex: number) => {
    const safeIndex = Math.max(0, Math.min(insertIndex, clips.length))
    const newClip = createNewClip()
    updateProject((prev) => {
      const nextShots = [...(prev.shots || [])]
      nextShots.splice(safeIndex, 0, newClip)
      return {
        ...prev,
        shots: nextShots
      }
    })
    setActiveClipIndex(safeIndex)
  }

  const handleDeleteActiveClip = () => {
    if (clips.length === 0 || !activeClip) {
      showAlert('当前没有可删除的片段', { type: 'warning' })
      return
    }

    const targetIndex = activeClipIndex
    const targetClipId = clips[targetIndex]?.id
    if (!targetClipId) {
      showAlert('当前激活片段无效，请重新选择', { type: 'warning' })
      return
    }
    const displayName = `片段 ${targetIndex + 1}`

    showAlert(`确定要删除${displayName}吗？此操作不可撤销。`, {
      type: 'warning',
      showCancel: true,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: () => {
        const nextIndex = Math.max(0, Math.min(targetIndex, clips.length - 2))
        updateProject((prev) => ({
          ...prev,
          shots: (prev.shots || []).filter((shot) => shot.id !== targetClipId)
        }))
        setActiveClipIndex(nextIndex)
        showAlert(`${displayName} 已删除`, { type: 'success' })
      }
    })
  }

  const handleSaveActiveClipText = ({
    text,
    html
  }: {
    text: string
    html: string
  }) => {
    if (!activeClip) return
    const targetId = activeClip.id
    updateProject((prev) => ({
      ...prev,
      shots: (prev.shots || []).map((shot) =>
        shot.id === targetId
          ? { ...shot, larkActionSummary: text, larkActionSummaryHtml: html }
          : shot
      )
    }))
  }

  const getLarkEditorText = (clip?: Shot | null): string => {
    if (!clip) return ''
    if (typeof clip.larkActionSummary === 'string') return clip.larkActionSummary
    return ''
  }

  const getLarkEditorHtml = (clip?: Shot | null): string => {
    if (!clip) return ''
    if (typeof clip.larkActionSummaryHtml === 'string') return clip.larkActionSummaryHtml
    return ''
  }

  const hasClipScriptContent = (clip?: Shot | null): boolean => {
    if (!clip) return false
    const plainText = String(getLarkEditorText(clip) || '').trim()
    if (plainText.length > 0) return true
    const html = String(getLarkEditorHtml(clip) || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim()
    return html.length > 0
  }

  const getClipRenderState = (
    clip?: Shot | null
  ): 'generated' | 'ready_to_generate' | 'empty' => {
    if (!clip) return 'empty'
    if (String(clip.videoUrl || '').trim()) return 'generated'
    return hasClipScriptContent(clip) ? 'ready_to_generate' : 'empty'
  }

  const convertFileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('文件读取失败'))
          return
        }
        resolve(result)
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })

  const appendMediaUploadLog = (line: string) => {
    setMediaUploadLogs((prev) => [...prev, line])
  }

  const getFileExtension = (fileName: string): string =>
    String(fileName || '')
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase() || ''

  const validateMediaFileBasic = (
    file: File,
    type: MediaAssetType
  ): string | null => {
    const ext = getFileExtension(file.name)
    const expectedPrefix =
      type === 'image' ? 'image/' : type === 'video' ? 'video/' : 'audio/'
    const mimeMatched = file.type.startsWith(expectedPrefix)
    const extMatched =
      type === 'image'
        ? [
            'jpg',
            'jpeg',
            'png',
            'webp',
            'gif',
            'bmp',
            'tif',
            'tiff',
            'heic',
            'heif'
          ].includes(ext)
        : type === 'video'
          ? ['mp4', 'mov'].includes(ext)
          : ['wav', 'mp3'].includes(ext)
    if (!mimeMatched && !extMatched) {
      return `文件类型不正确，请上传${mediaTypeText[type]}文件`
    }
    const maxSize = mediaMaxSizeMap[type]
    const exceedsLimit =
      type === 'image' ? file.size >= maxSize : file.size > maxSize
    if (exceedsLimit) {
      const maxSizeMb = Math.floor(maxSize / (1024 * 1024))
      if (type === 'image') {
        return `${mediaTypeText[type]}文件过大，需小于 ${maxSizeMb}MB`
      }
      return `${mediaTypeText[type]}文件过大，最大支持 ${maxSizeMb}MB`
    }
    return null
  }

  const readMediaElementMetadata = <T extends HTMLMediaElement>(
    element: T,
    sourceUrl: string
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const onLoaded = () => resolve(element)
      const onError = () => reject(new Error('媒体文件解析失败'))
      element.preload = 'metadata'
      element.onloadedmetadata = onLoaded
      element.onerror = onError
      element.src = sourceUrl
    })

  const estimateVideoFps = async (video: HTMLVideoElement): Promise<number> => {
    const requestFrame = (video as any).requestVideoFrameCallback
    if (typeof requestFrame !== 'function') {
      throw new Error('当前浏览器不支持视频帧率检测')
    }
    return new Promise((resolve, reject) => {
      let frameCount = 0
      let firstMediaTime: number | null = null
      let lastMediaTime: number | null = null
      let completed = false

      const finalize = (fps: number) => {
        if (completed) return
        completed = true
        video.pause()
        if (!Number.isFinite(fps) || fps <= 0) {
          reject(new Error('无法检测到有效视频帧率'))
          return
        }
        resolve(fps)
      }

      const onFrame = (_now: number, metadata: { mediaTime: number }) => {
        if (completed) return
        const mediaTime = Number(metadata?.mediaTime || 0)
        if (firstMediaTime === null) firstMediaTime = mediaTime
        lastMediaTime = mediaTime
        frameCount += 1
        const elapsed = Math.max(
          0,
          (lastMediaTime || 0) - (firstMediaTime || 0)
        )
        if (frameCount >= 36 || elapsed >= 1 || video.ended) {
          finalize(frameCount / Math.max(elapsed, 1 / 24))
          return
        }
        requestFrame.call(video, onFrame)
      }

      window.setTimeout(() => {
        if (completed) return
        const elapsed = Math.max(
          0,
          (lastMediaTime || 0) - (firstMediaTime || 0)
        )
        finalize(frameCount / Math.max(elapsed, 1 / 24))
      }, 5000)

      video.currentTime = 0
      video
        .play()
        .then(() => {
          requestFrame.call(video, onFrame)
        })
        .catch(() => {
          reject(new Error('视频帧率检测失败，请更换文件后重试'))
        })
    })
  }

  const validateMediaFileAdvanced = async (
    file: File,
    type: MediaAssetType
  ): Promise<{
    durationSec?: number
    width?: number
    height?: number
    fps?: number
  }> => {
    const ext = getFileExtension(file.name)
    if (type === 'image') {
      if (
        ![
          'jpg',
          'jpeg',
          'png',
          'webp',
          'bmp',
          'tif',
          'tiff',
          'gif',
          'heic',
          'heif'
        ].includes(ext)
      ) {
        throw new Error(
          '图片格式仅支持 jpeg、png、webp、bmp、tiff、gif、heic/heif'
        )
      }
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('图片文件解析失败'))
          img.src = objectUrl
        })
        const width = Number(img.naturalWidth || 0)
        const height = Number(img.naturalHeight || 0)
        if (!(width > 300 && width < 6000 && height > 300 && height < 6000)) {
          throw new Error('图片宽高需在 (300, 6000) 像素区间内')
        }
        const ratio = width / Math.max(height, 1)
        if (!(ratio > 0.4 && ratio < 2.5)) {
          throw new Error('图片宽高比（宽/高）需在 (0.4, 2.5) 区间内')
        }
        return { width, height }
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    if (type === 'audio') {
      if (!['wav', 'mp3'].includes(ext)) {
        throw new Error('音频格式仅支持 wav、mp3')
      }
      const objectUrl = URL.createObjectURL(file)
      const audio = new Audio()
      try {
        const parsed = await readMediaElementMetadata(audio, objectUrl)
        const durationSec = Number(parsed.duration || 0)
        if (!Number.isFinite(durationSec) || durationSec < 2 || durationSec > 15) {
          throw new Error('音频时长需在 2-15 秒之间')
        }
        return { durationSec }
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    if (type === 'video') {
      if (!['mp4', 'mov'].includes(ext)) {
        throw new Error('视频格式仅支持 mp4、mov')
      }
      const objectUrl = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.muted = true
      ;(video as any).playsInline = true
      try {
        const parsed = await readMediaElementMetadata(video, objectUrl)
        const durationSec = Number(parsed.duration || 0)
        const width = Number(parsed.videoWidth || 0)
        const height = Number(parsed.videoHeight || 0)
        if (!Number.isFinite(durationSec) || durationSec < 2 || durationSec > 15) {
          throw new Error('视频时长需在 2-15 秒之间')
        }
        if (width < 300 || width > 6000 || height < 300 || height > 6000) {
          throw new Error('视频宽高需在 300-6000 像素之间')
        }
        const ratio = width / Math.max(height, 1)
        if (ratio < 0.4 || ratio > 2.5) {
          throw new Error('视频宽高比（宽/高）需在 0.4-2.5 之间')
        }
        const pixels = width * height
        if (pixels < 409600 || pixels > 927408) {
          throw new Error(
            '视频总像素需在 409600-927408 之间（宽×高）'
          )
        }
        const shortEdge = Math.min(width, height)
        if (![480, 720].includes(shortEdge)) {
          throw new Error('视频分辨率需为 480p 或 720p（按短边判定）')
        }
        const fps = await estimateVideoFps(video)
        if (fps < 24 || fps > 60) {
          throw new Error('视频帧率需在 24-60 FPS 之间')
        }
        return {
          durationSec,
          width,
          height,
          fps: Number(fps.toFixed(2))
        }
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    return {}
  }

  const openNewMediaAssetModal = (type: MediaAssetType) => {
    setShowAddAssetMenu(false)
    setEditingMediaAsset(null)
    setNewMediaAsset({
      type,
      name: '',
      mimeType: '',
      dataUrl: '',
      file: undefined
    })
    setIsSavingMediaAsset(false)
    setMediaUploadMessage('')
    setMediaUploadLogs([])
  }

  const openExistingMediaAssetModal = (asset: MediaAsset) => {
    setShowAddAssetMenu(false)
    setEditingMediaAsset(asset)
    setNewMediaAsset({
      type: asset.type,
      name: asset.name,
      mimeType: asset.mimeType || '',
      dataUrl: asset.dataUrl || '',
      file: undefined
    })
    setIsSavingMediaAsset(false)
    setMediaUploadMessage('')
    setMediaUploadLogs([])
  }

  const closeMediaAssetModal = () => {
    setNewMediaAsset(null)
    setEditingMediaAsset(null)
    setIsSavingMediaAsset(false)
    setMediaUploadMessage('')
    setMediaUploadLogs([])
  }

  const closeEditingAssetModal = () => {
    setEditingAsset(null)
    setOriginalEditingAsset(null)
  }

  const handleReplaceMediaFile = () => {
    if (isSavingMediaAsset) return
    mediaFileInputRef.current?.click()
  }

  const buildMediaDownloadName = (): string => {
    if (!newMediaAsset) return 'media-asset'
    if (newMediaAsset.file?.name) return newMediaAsset.file.name
    if (editingMediaAsset?.sourceFileName) return editingMediaAsset.sourceFileName
    const name = (newMediaAsset.name || 'media-asset').trim() || 'media-asset'
    const mime = newMediaAsset.mimeType || editingMediaAsset?.mimeType || ''
    if (mime.includes('jpeg')) return `${name}.jpg`
    if (mime.includes('png')) return `${name}.png`
    if (mime.includes('webp')) return `${name}.webp`
    if (mime.includes('gif')) return `${name}.gif`
    if (mime.includes('bmp')) return `${name}.bmp`
    if (mime.includes('mp4')) return `${name}.mp4`
    if (mime.includes('quicktime')) return `${name}.mov`
    if (mime.includes('wav')) return `${name}.wav`
    if (mime.includes('mpeg') || mime.includes('mp3')) return `${name}.mp3`
    return name
  }

  const handleDownloadMediaFile = () => {
    if (!newMediaAsset?.dataUrl) return
    const anchor = document.createElement('a')
    anchor.href = newMediaAsset.dataUrl
    anchor.download = buildMediaDownloadName()
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  const handleUploadNewMediaAsset = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !newMediaAsset) return

    const err = validateMediaFileBasic(file, newMediaAsset.type)
    if (err) {
      showAlert(err, { type: 'warning' })
      return
    }

    try {
      const dataUrl = await convertFileToDataUrl(file)
      setNewMediaAsset((prev) =>
        prev
          ? {
              ...prev,
              mimeType: file.type,
              dataUrl,
              file
            }
          : prev
      )
      console.info('[LarkDirector] 媒体资源上传成功', {
        actor: 'user',
        action: 'upload-media-asset',
        mediaType: newMediaAsset.type,
        fileName: file.name
      })
    } catch (error) {
      showAlert(
        `上传失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { type: 'error' }
      )
    }
  }

  const handleSaveNewMediaAsset = async () => {
    if (!newMediaAsset) return
    if (editingMediaAsset && editingMediaAsset.type !== newMediaAsset.type) {
      showAlert('媒体类型不匹配，请重新选择资源', { type: 'warning' })
      return
    }
    const isEditing = !!editingMediaAsset
    const editingAssetId = editingMediaAsset?.id || ''
    const editingAssetCreatedAt = editingMediaAsset?.createdAt
    const currentRelayAssetId = editingMediaAsset?.relayAssetId
    const hasFileChanged = !!newMediaAsset.file
    const nextName = newMediaAsset.name.trim()
    const originalName = editingMediaAsset?.name?.trim() || ''
    const hasNameChanged = !isEditing || nextName !== originalName
    if (!nextName) {
      showAlert('资源名不能为空', { type: 'warning' })
      return
    }
    if (!newMediaAsset.dataUrl) {
      showAlert(`请先上传${mediaTypeText[newMediaAsset.type]}文件`, {
        type: 'warning'
      })
      return
    }

    if (!hasFileChanged && isEditing && !hasNameChanged) {
      showAlert('资源未发生变化，无需更新', { type: 'warning' })
      closeMediaAssetModal()
      return
    }

    if (!hasFileChanged && isEditing && hasNameChanged) {
      const now = Date.now()
      updateProject((prev) => {
        if (!prev.scriptData) return prev
        return {
          ...prev,
          scriptData: {
            ...prev.scriptData,
            mediaAssets: (prev.scriptData.mediaAssets || []).map((item) =>
              item.id === editingAssetId
                ? {
                    ...item,
                    name: nextName,
                    updatedAt: now
                  }
                : item
            )
          }
        }
      })
      console.info('[LarkDirector] 媒体资源标题更新成功', {
        actor: 'user',
        action: 'rename-media-asset',
        mediaType: newMediaAsset.type,
        mediaAssetId: editingAssetId,
        mediaAssetName: nextName
      })
      closeMediaAssetModal()
      showAlert(`${mediaTypeText[newMediaAsset.type]}资源名称已更新`, {
        type: 'success'
      })
      return
    }

    if (!seriesProject || !currentEpisode) {
      showAlert('当前项目上下文不可用，无法上传资源', { type: 'warning' })
      return
    }
    if (!newMediaAsset.file) {
      showAlert('文件读取失败，请重新选择资源文件', { type: 'warning' })
      return
    }

    setIsSavingMediaAsset(true)
    setMediaUploadMessage('上传中...')
    setMediaUploadLogs([])
    appendMediaUploadLog('开始上传资源')
    appendMediaUploadLog(
      `上传配置：TOS=${hasVolcengineTosConfig() ? '已开启' : '未开启'}，素材库=${hasAssetRelayConfig() ? '已开启' : '未开启'}`
    )

    try {
      appendMediaUploadLog('开始校验资源约束')
      const mediaMeta = await validateMediaFileAdvanced(
        newMediaAsset.file,
        newMediaAsset.type
      )
      appendMediaUploadLog('资源约束校验通过')

      const now = Date.now()
      const mediaAssetId = isEditing
        ? editingAssetId
        : `media_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`
      const uploadResult = await uploadMediaAssetFile({
        project: seriesProject,
        seriesList: allSeries || [],
        episodes: allEpisodes || [],
        episode: currentEpisode,
        mediaType: newMediaAsset.type,
        resourceId: mediaAssetId,
        file: newMediaAsset.file,
        currentAssetId: currentRelayAssetId,
        onStage: (stage) => {
          if (stage === 'start_tos_upload') {
            appendMediaUploadLog('开始上传资源到TOS')
          } else if (stage === 'tos_upload_success') {
            appendMediaUploadLog('上传资源到TOS成功')
          } else if (stage === 'start_relay_upload') {
            appendMediaUploadLog('开始上传资源到素材库')
          }
        }
      })

      if (uploadResult.tosStatus !== 'success') {
        throw new Error(uploadResult.tosMessage || uploadResult.reason || 'TOS上传失败')
      }
      appendMediaUploadLog(uploadResult.tosMessage || '上传资源到TOS成功')

      if (newMediaAsset.type === 'audio') {
        appendMediaUploadLog('音频资源无需上传素材库，已跳过')
      } else if (uploadResult.relayStatus === 'success') {
        appendMediaUploadLog(uploadResult.relayMessage || '上传资源到素材库成功')
      } else if (uploadResult.relayStatus === 'failed') {
        throw new Error(uploadResult.relayMessage || '上传资源到素材库失败')
      } else {
        appendMediaUploadLog(uploadResult.relayMessage || '素材库上传已跳过')
      }

      const tosAssetId = uploadResult.objectKey
        ? `tos:${uploadResult.objectKey}`
        : undefined
      const uploadRemoteUrl = normalizeRemoteUrl(uploadResult.url)
      const resolvedTosRemoteUrl = normalizeRemoteUrl(
        resolveTosPublicUrlFromAssetId(tosAssetId)
      )
      const ensuredRemoteUrl =
        uploadRemoteUrl || resolvedTosRemoteUrl || newMediaAsset.dataUrl

      if (!uploadRemoteUrl && resolvedTosRemoteUrl) {
        appendMediaUploadLog('上传返回URL缺失，已使用TOS objectKey回填公网URL')
      } else if (!uploadRemoteUrl && !resolvedTosRemoteUrl) {
        appendMediaUploadLog('上传返回URL缺失且TOS URL回填失败，已回退本地预览URL')
        console.warn('[LarkDirector] 媒体资源URL回填失败，已回退本地预览URL', {
          actor: 'system',
          action: 'fallback-media-remote-url',
          mediaAssetId,
          objectKey: uploadResult.objectKey
        })
      }

      const mediaAsset: MediaAsset = {
        id: mediaAssetId,
        name: nextName,
        type: newMediaAsset.type,
        mimeType: newMediaAsset.mimeType || 'application/octet-stream',
        dataUrl: newMediaAsset.dataUrl,
        sourceFileName: newMediaAsset.file.name,
        sourceFileSize: newMediaAsset.file.size,
        sourceDurationSec: mediaMeta.durationSec,
        sourceWidth: mediaMeta.width,
        sourceHeight: mediaMeta.height,
        sourceFps: mediaMeta.fps,
        tosAssetId,
        relayAssetId:
          uploadResult.relayStatus === 'success' ? uploadResult.assetId : undefined,
        objectKey: uploadResult.objectKey,
        remoteUrl: ensuredRemoteUrl,
        createdAt: editingAssetCreatedAt || now,
        updatedAt: now
      }

      updateProject((prev) => {
        if (!prev.scriptData) return prev
        const exists = (prev.scriptData.mediaAssets || []).some(
          (item) => item.id === mediaAsset.id
        )
        return {
          ...prev,
          scriptData: {
            ...prev.scriptData,
            mediaAssets: exists
              ? (prev.scriptData.mediaAssets || []).map((item) =>
                  item.id === mediaAsset.id ? mediaAsset : item
                )
              : [...(prev.scriptData.mediaAssets || []), mediaAsset]
          }
        }
      })

      console.info('[LarkDirector] 媒体资源保存成功', {
        actor: 'user',
        action: isEditing ? 'update-media-asset' : 'create-media-asset',
        mediaType: mediaAsset.type,
        mediaAssetId: mediaAsset.id,
        mediaAssetName: mediaAsset.name,
        remoteUrl: mediaAsset.remoteUrl,
        relayAssetId: mediaAsset.relayAssetId,
        objectKey: mediaAsset.objectKey
      })
      setMediaUploadMessage('上传完成')
      appendMediaUploadLog('上传流程完成')
      closeMediaAssetModal()
      showAlert(
        isEditing
          ? `${mediaTypeText[mediaAsset.type]}资源已更新`
          : `${mediaTypeText[mediaAsset.type]}资源已添加`,
        { type: 'success' }
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setMediaUploadMessage('上传失败')
      appendMediaUploadLog(`上传失败：${errorMessage}`)
      showAlert(`上传失败：${errorMessage}`, { type: 'error' })
    } finally {
      setIsSavingMediaAsset(false)
    }
  }

  const mediaDraftName = (newMediaAsset?.name || '').trim()
  const editingDraftName = (editingMediaAsset?.name || '').trim()
  const isEditingMediaDraft = !!editingMediaAsset
  const isMediaDraftFileChanged = !!newMediaAsset?.file
  const isMediaDraftNameChanged = isEditingMediaDraft
    ? mediaDraftName !== editingDraftName
    : mediaDraftName.length > 0
  const isMediaDraftChanged = !isEditingMediaDraft
    ? true
    : isMediaDraftFileChanged || isMediaDraftNameChanged
  const canSubmitMediaAsset =
    !!newMediaAsset &&
    !isSavingMediaAsset &&
    mediaDraftName.length > 0 &&
    !!newMediaAsset.dataUrl &&
    isMediaDraftChanged

  const openAssetEditor = (type: EditingAssetType, id: string) => {
    if (!project.scriptData) {
      showAlert('当前剧本数据不可用', { type: 'warning' })
      return
    }

    if (type === 'character') {
      const character = project.scriptData.characters.find((item) => item.id === id)
      if (!character) return
      const draft: EditingAssetDraft = {
        type,
        id,
        name: character.name || '',
        description: character.visualPrompt || '',
        imageUrl: character.referenceImage || '',
        shapeReferenceImage: character.shapeReferenceImage || ''
      }
      setEditingAsset(draft)
      setOriginalEditingAsset(draft)
      return
    }

    if (type === 'scene') {
      const scene = project.scriptData.scenes.find((item) => item.id === id)
      if (!scene) return
      const draft: EditingAssetDraft = {
        type,
        id,
        name: scene.location || '',
        description: scene.visualPrompt || '',
        imageUrl: scene.referenceImage || '',
        shapeReferenceImage: scene.shapeReferenceImage || ''
      }
      setEditingAsset(draft)
      setOriginalEditingAsset(draft)
      return
    }

    const prop = (project.scriptData.props || []).find((item) => item.id === id)
    if (!prop) return
    const draft: EditingAssetDraft = {
      type,
      id,
      name: prop.name || '',
      description: prop.visualPrompt || '',
      imageUrl: prop.referenceImage || '',
      shapeReferenceImage: prop.shapeReferenceImage || ''
    }
    setEditingAsset(draft)
    setOriginalEditingAsset(draft)
  }

  const handleUploadShapeReference = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const base64 = await convertImageToBase64(file)
      setEditingAsset((prev) =>
        prev ? { ...prev, shapeReferenceImage: base64 } : prev
      )
    } catch (error) {
      showAlert(
        `上传失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { type: 'error' }
      )
    }
  }

  const handleUploadMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const base64 = await convertImageToBase64(file)
      setEditingAsset((prev) => (prev ? { ...prev, imageUrl: base64 } : prev))
    } catch (error) {
      showAlert(
        `上传失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { type: 'error' }
      )
    }
  }

  const handleSaveEditingAsset = () => {
    if (!editingAsset) return
    const nextName = editingAsset.name.trim()
    const nextDescription = editingAsset.description.trim()
    const nextImage = editingAsset.imageUrl.trim()
    const nextShapeReferenceImage = editingAsset.shapeReferenceImage.trim()

    if (!nextName) {
      showAlert('名称不能为空', { type: 'warning' })
      return
    }
    if (!canSubmitEditingAsset) {
      return
    }

    updateProject((prev) => {
      if (!prev.scriptData) return prev

      if (editingAsset.type === 'character') {
        return {
          ...prev,
          scriptData: {
            ...prev.scriptData,
            characters: prev.scriptData.characters.map((item: Character) =>
              item.id === editingAsset.id
                ? {
                    ...item,
                    name: nextName,
                    visualPrompt: nextDescription,
                    referenceImage: nextImage || item.referenceImage,
                    shapeReferenceImage: nextShapeReferenceImage || undefined
                  }
                : item
            )
          }
        }
      }

      if (editingAsset.type === 'scene') {
        return {
          ...prev,
          scriptData: {
            ...prev.scriptData,
            scenes: prev.scriptData.scenes.map((item: Scene) =>
              item.id === editingAsset.id
                ? {
                    ...item,
                    location: nextName,
                    visualPrompt: nextDescription,
                    referenceImage: nextImage || item.referenceImage,
                    shapeReferenceImage: nextShapeReferenceImage || undefined
                  }
                : item
            )
          }
        }
      }

      return {
        ...prev,
        scriptData: {
          ...prev.scriptData,
          props: (prev.scriptData.props || []).map((item: Prop) =>
            item.id === editingAsset.id
              ? {
                  ...item,
                  name: nextName,
                  visualPrompt: nextDescription,
                  referenceImage: nextImage || item.referenceImage,
                  shapeReferenceImage: nextShapeReferenceImage || undefined
                }
              : item
          )
        }
      }
    })

    closeEditingAssetModal()
    showAlert('保存成功', { type: 'success' })
  }

  const editorTitle =
    editingAsset?.type === 'scene'
      ? '编辑场景'
      : editingAsset?.type === 'prop'
        ? '编辑道具'
        : '编辑角色'
  const editorNameLabel =
    editingAsset?.type === 'scene'
      ? '场景名称'
      : editingAsset?.type === 'prop'
        ? '道具名称'
        : '角色名称'
  const editorDescLabel =
    editingAsset?.type === 'scene'
      ? '场景描述'
      : editingAsset?.type === 'prop'
        ? '道具描述'
        : '角色描述'
  const editorAssetTypeLabel =
    editingAsset?.type === 'scene'
      ? '场景'
      : editingAsset?.type === 'prop'
        ? '道具'
        : '角色'
  const editorReferenceHint =
    editingAsset?.type === 'scene'
      ? '仅参考场景构图，风格遵循剧本'
      : editingAsset?.type === 'prop'
        ? '仅参考道具外形，风格遵循剧本'
        : '仅参考角色外形，风格遵循剧本'

  const editingAssetName = (editingAsset?.name || '').trim()
  const editingAssetDesc = (editingAsset?.description || '').trim()
  const editingAssetImage = (editingAsset?.imageUrl || '').trim()
  const editingAssetShape = (editingAsset?.shapeReferenceImage || '').trim()
  const originalAssetName = (originalEditingAsset?.name || '').trim()
  const originalAssetDesc = (originalEditingAsset?.description || '').trim()
  const originalAssetImage = (originalEditingAsset?.imageUrl || '').trim()
  const originalAssetShape = (originalEditingAsset?.shapeReferenceImage || '').trim()
  const hasEditingAssetChanged =
    editingAssetName !== originalAssetName ||
    editingAssetDesc !== originalAssetDesc ||
    editingAssetImage !== originalAssetImage ||
    editingAssetShape !== originalAssetShape
  const canSubmitEditingAsset =
    !!editingAsset && editingAssetName.length > 0 && hasEditingAssetChanged

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] overflow-hidden text-[var(--text-primary)] select-none">
      {mediaUploadLogs.length > 0 && (
        <div className="fixed right-4 top-4 z-[9999] w-full max-w-md rounded-xl border border-[var(--border-default)] bg-black/80 px-4 py-3 shadow-2xl backdrop-blur transition-all duration-200">
          <div className="flex items-center gap-3">
            <div
              className={`h-4 w-4 rounded-full border-2 ${
                isSavingMediaAsset
                  ? 'animate-spin border-zinc-500 border-t-white'
                  : 'border-emerald-400 bg-emerald-400'
              }`}
            />
            <div className="text-sm text-white">
              {mediaUploadMessage || '上传中...'}
            </div>
          </div>
          <div className="mt-2 max-h-44 space-y-1 overflow-auto text-xs text-zinc-300">
            {mediaUploadLogs.map((line, index) => (
              <div key={`${line}-${index}`} className="whitespace-pre-wrap break-words">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="h-16 border-b border-[var(--border-primary)] bg-[var(--bg-elevated)] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-3">
            <LayoutGrid className="w-5 h-5 text-[var(--accent)]" />
            导演工作台(小云雀版)
            <span className="text-xs text-[var(--text-muted)] font-mono font-normal uppercase tracking-wider bg-[var(--bg-base)]/30 px-2 py-1 rounded">
              Director Workbench
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase">
              比例
            </span>
            <div className="flex gap-1">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all bg-[var(--accent)] text-[var(--text-primary)] cursor-pointer"
                title="横屏 (1280x720)"
              >
                <Monitor className="w-4 h-4" />
                <span>横屏</span>
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:bg-[var(--border-secondary)] hover:text-[var(--text-secondary)] cursor-pointer"
                title="竖屏 (720x1280)"
              >
                <Smartphone className="w-4 h-4" />
                <span>竖屏</span>
              </button>
            </div>
          </div>
          <div className="w-px h-6 bg-[var(--bg-hover)]"></div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-base)]/30 border border-[var(--border-primary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-[var(--text-tertiary)]">
                AI增强提示词
              </span>
              <input
                className="w-3.5 h-3.5 rounded border-[var(--border-secondary)] bg-[var(--bg-hover)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
                type="checkbox"
              />
            </label>
          </div>
          <span className="text-xs font-mono px-2 py-1 rounded border text-amber-300 border-amber-500/40 bg-amber-500/10">
            质检分 70
          </span>
          <span className="text-xs text-[var(--text-tertiary)] mr-4 font-mono">
            1 / 12 完成
          </span>
          <button className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 bg-[var(--bg-surface)] text-[var(--text-tertiary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)]">
            <Sparkles className="w-3 h-3" />
            重新生成所有首帧
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - Asset Library */}
        <aside className="w-80 border-r border-[var(--border-primary)] bg-[var(--bg-surface)] flex flex-col h-full shrink-0">
          <div className="h-14 border-b border-[var(--border-primary)] flex items-center justify-between px-6 shrink-0">
            <h2 className="text-sm font-bold tracking-wider">本集资产库</h2>
            <div
              className="relative"
              onMouseEnter={openAddAssetMenu}
              onMouseLeave={scheduleCloseAddAssetMenu}
            >
              <button
                className="p-1 hover:bg-[var(--bg-hover)] rounded"
                onClick={() => {
                  clearAddAssetMenuCloseTimer()
                  setShowAddAssetMenu((prev) => !prev)
                }}
              >
                <Plus className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              {showAddAssetMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] shadow-xl p-1.5"
                  onMouseEnter={openAddAssetMenu}
                  onMouseLeave={scheduleCloseAddAssetMenu}
                >
                  <button
                    onClick={() => {
                      clearAddAssetMenuCloseTimer()
                      openNewMediaAssetModal('image')
                    }}
                    className="w-full px-2 py-2 rounded-lg text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    图片
                  </button>
                  <button
                    onClick={() => {
                      clearAddAssetMenuCloseTimer()
                      openNewMediaAssetModal('video')
                    }}
                    className="w-full px-2 py-2 rounded-lg text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <Film className="w-3.5 h-3.5" />
                    视频
                  </button>
                  <button
                    onClick={() => {
                      clearAddAssetMenuCloseTimer()
                      openNewMediaAssetModal('audio')
                    }}
                    className="w-full px-2 py-2 rounded-lg text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <Music2 className="w-3.5 h-3.5" />
                    音频
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {/* Characters */}
            <div>
              <div className={assetSectionTitleClass}>
                <Users className="w-3 h-3" />
                <span>角色 ({project.scriptData?.characters.length || 0})</span>
              </div>
              <div className={assetGridClass}>
                {project.scriptData?.characters.map((char) => (
                  <div
                    key={char.id}
                    className={`${assetCardClass} group`}
                  >
                    <div className={assetImageWrapClass}>
                      {char.referenceImage ? (
                        <img
                          src={char.referenceImage}
                          alt={char.name}
                          className={assetImageClass}
                        />
                      ) : (
                        <div className={assetEmptyClass}>
                          无图片
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openAssetEditor('character', char.id)
                        }}
                        className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full border border-black/10 bg-white/95 text-black shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white cursor-pointer"
                        title="编辑资源"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={assetNameClass}>
                      {char.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenes */}
            <div>
              <div className={assetSectionTitleClass}>
                <ImageIcon className="w-3 h-3" />
                <span>场景 ({project.scriptData?.scenes.length || 0})</span>
              </div>
              <div className={assetGridClass}>
                {project.scriptData?.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={`${assetCardClass} group`}
                  >
                    <div className={assetImageWrapClass}>
                      {scene.referenceImage ? (
                        <img
                          src={scene.referenceImage}
                          alt={scene.location}
                          className={assetImageClass}
                        />
                      ) : (
                        <div className={assetEmptyClass}>
                          无图片
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openAssetEditor('scene', scene.id)
                        }}
                        className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full border border-black/10 bg-white/95 text-black shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white cursor-pointer"
                        title="编辑资源"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={assetNameClass}>
                      {scene.location}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Props */}
            <div>
              <div className={assetSectionTitleClass}>
                <Package className="w-3 h-3" />
                <span>道具 ({project.scriptData?.props.length || 0})</span>
              </div>
              <div className={assetGridClass}>
                {project.scriptData?.props.map((prop) => (
                  <div
                    key={prop.id}
                    className={`${assetCardClass} group`}
                  >
                    <div className={assetImageWrapClass}>
                      {prop.referenceImage ? (
                        <img
                          src={prop.referenceImage}
                          alt={prop.name}
                          className={assetImageClass}
                        />
                      ) : (
                        <div className={assetEmptyClass}>
                          无图片
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openAssetEditor('prop', prop.id)
                        }}
                        className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full border border-black/10 bg-white/95 text-black shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white cursor-pointer"
                        title="编辑资源"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={assetNameClass}>
                      {prop.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Media Assets */}
            <div>
              <div className={assetSectionTitleClass}>
                <ImageIcon className="w-3 h-3" />
                <span>媒体资源 ({mediaAssets.length})</span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                    图片 ({mediaImages.length})
                  </div>
                  <div className={assetGridClass}>
                    {mediaImages.map((item) => (
                      <div
                        key={item.id}
                        className={`${assetCardClass} group`}
                      >
                        <div className={assetImageWrapClass}>
                          <img
                            src={resolveMediaRenderUrl(item)}
                            alt={item.name}
                            className={assetImageClass}
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openExistingMediaAssetModal(item)
                            }}
                            className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full border border-black/10 bg-white/95 text-black shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white cursor-pointer"
                            title="编辑资源"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className={assetNameClass}>{item.name}</div>
                      </div>
                    ))}
                    {mediaImages.length === 0 && (
                      <div className="col-span-2 text-[10px] text-[var(--text-muted)] border border-dashed border-[var(--border-primary)] rounded-lg py-3 text-center">
                        暂无图片资源
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                    视频 ({mediaVideos.length})
                  </div>
                  <div className={assetGridClass}>
                    {mediaVideos.map((item) => (
                      <div
                        key={item.id}
                        className={`${assetCardClass} group`}
                      >
                        <div className={assetImageWrapClass}>
                          <video
                            src={resolveMediaRenderUrl(item)}
                            className={assetImageClass}
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openExistingMediaAssetModal(item)
                            }}
                            className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full border border-black/10 bg-white/95 text-black shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white cursor-pointer"
                            title="编辑资源"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className={assetNameClass}>{item.name}</div>
                      </div>
                    ))}
                    {mediaVideos.length === 0 && (
                      <div className="col-span-2 text-[10px] text-[var(--text-muted)] border border-dashed border-[var(--border-primary)] rounded-lg py-3 text-center">
                        暂无视频资源
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                    音频 ({mediaAudios.length})
                  </div>
                  <div className={assetGridClass}>
                    {mediaAudios.map((item) => (
                      <div
                        key={item.id}
                        className={`${assetCardClass} group`}
                      >
                        <div className="relative rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] p-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mb-2">
                            <Music2 className="w-3.5 h-3.5" />
                            音频
                          </div>
                          <audio
                            src={resolveMediaRenderUrl(item)}
                            controls
                            className="w-full h-8"
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openExistingMediaAssetModal(item)
                            }}
                            className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full border border-black/10 bg-white/95 text-black shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white cursor-pointer"
                            title="编辑资源"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className={assetNameClass}>{item.name}</div>
                      </div>
                    ))}
                    {mediaAudios.length === 0 && (
                      <div className="col-span-2 text-[10px] text-[var(--text-muted)] border border-dashed border-[var(--border-primary)] rounded-lg py-3 text-center">
                        暂无音频资源
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full min-w-0">
          {/* Top Section - Editor & Video */}
          <div className="flex-1 flex min-h-0 border-b border-[var(--border-primary)]">
            {/* Script Editor Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border-primary)] bg-[var(--bg-base)]">
              <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold">{activeClipTitle}</h3>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    片段时长请限制在4-15s，输入"@"可快速调整镜头时长、引用角色、场景、素材
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteActiveClip}
                    disabled={!activeClip}
                    className="px-2 py-1 rounded border border-[var(--error-border)] text-[10px] text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="删除当前片段"
                  >
                    <Trash2 className="w-3 h-3" />
                    删除
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-sunken)]">
                <ScriptEditorRich
                  key={activeClip?.id || 'empty-clip'}
                  project={project}
                  projectLibrary={seriesProject}
                  clipId={activeClip?.id}
                  initialContent={getLarkEditorHtml(activeClip)}
                  initialText={getLarkEditorText(activeClip)}
                  placeholder="输入描述，@ 引用角色/道具/场景/媒体..."
                  autoFocusWhenEmpty={true}
                  onSaveContent={handleSaveActiveClipText}
                />
              </div>
            </div>

            {/* Video Player Area */}
            <div className="w-[360px] bg-[var(--bg-sunken)] shrink-0 relative flex flex-col">
              <div className="flex-1 relative flex items-center justify-center">
                {activeClip?.videoUrl ? (
                  <video
                    src={activeClip.videoUrl}
                    className="w-full h-full object-cover"
                    controls={false}
                  />
                ) : (
                  <div className="w-full h-full p-4">
                    <div className="w-full h-full rounded-xl bg-[var(--bg-base)] border border-[var(--border-primary)] flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                      <Film className="w-8 h-8 text-[var(--text-muted)]" />
                      <span className="text-xs">未生成内容</span>
                    </div>
                  </div>
                )}

                {/* Fake Video Controls Overlay */}
                {activeClip?.videoUrl && (
                  <div className="absolute top-4 right-4">
                    <button className="p-1.5 bg-black/40 text-white rounded-full backdrop-blur hover:bg-black/60 transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {activeClip?.videoUrl && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-3">
                    <button className="text-white hover:text-[var(--accent)] transition-colors">
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <div className="text-white text-[10px] font-mono">
                      00:01 / 00:10
                    </div>
                    <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden relative">
                      <div className="absolute left-0 top-0 bottom-0 w-[10%] bg-white rounded-full"></div>
                    </div>
                    <button className="text-white hover:text-gray-300 transition-colors">
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button className="text-white hover:text-gray-300 transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-white hover:text-gray-300 transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section - Timeline / Storyboard */}
          <div className="h-44 bg-[var(--bg-surface)] shrink-0 flex flex-col">
            <div className="h-10 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 fill-[var(--text-primary)]" />
                <span className="text-xs font-mono">00:01 / 00:22</span>
              </div>
              <button
                onClick={() => showAlert('功能暂未实现', { type: 'warning' })}
                className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                多选
              </button>
            </div>

            <div className="flex-1 overflow-x-auto px-4 py-3 flex items-center gap-2 custom-scrollbar">
              <button
                onClick={() => handleInsertClip(0)}
                className="w-5 h-20 shrink-0 rounded-full border border-[var(--border-primary)] bg-[var(--bg-base)] text-[var(--text-tertiary)] flex items-center justify-center hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
                title="在首位前新增片段"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {clips.map((clip, idx) => {
                const renderState = getClipRenderState(clip)
                return (
                  <React.Fragment key={clip.id}>
                    <div
                      className={`w-36 aspect-[16/12] rounded-xl shrink-0 border cursor-pointer relative p-1.5 ${
                        activeClipIndex === idx
                          ? 'border-[var(--accent)] bg-[var(--bg-base)]'
                          : 'border-[var(--border-primary)] bg-[var(--bg-base)] hover:border-[var(--border-secondary)]'
                      } transition-colors`}
                      onClick={() => setActiveClipIndex(idx)}
                    >
                      <div className="relative w-full h-full rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
                        <div className="absolute top-1 left-1 w-4 h-4 bg-black/45 rounded flex items-center justify-center text-[8px] text-white z-10 backdrop-blur-sm">
                          {idx + 1}
                        </div>

                        {renderState === 'generated' ? (
                          <>
                            <video src={clip.videoUrl} className="w-full h-full object-cover" />
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/45 rounded text-[8px] text-white font-mono z-10 backdrop-blur-sm">
                              00:
                              {Math.floor(clip.duration || 5)
                                .toString()
                                .padStart(2, '0')}
                            </div>
                          </>
                        ) : renderState === 'ready_to_generate' ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#b89b6a] text-[#1f1f1f] text-[10px] font-medium px-2 py-1">
                              <Film className="w-3 h-3" />
                              生成
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[10px]">
                            暂无内容
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleInsertClip(idx + 1)}
                      className="w-5 h-20 shrink-0 rounded-full border border-[var(--border-primary)] bg-[var(--bg-base)] text-[var(--text-tertiary)] flex items-center justify-center hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
                      title={`在片段${idx + 1}后新增片段`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </React.Fragment>
                )
              })}
              {clips.length === 0 && (
                <button
                  onClick={handleAddClip}
                  className="w-36 aspect-[16/12] rounded-xl shrink-0 border border-dashed border-[var(--border-secondary)] bg-[var(--bg-base)] p-1.5 hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="新增片段"
                >
                  <div className="w-full h-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col items-center justify-center gap-1.5 text-[var(--text-tertiary)]">
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      新增片段
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
      {editingAsset && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-base)]/75 p-6"
          onClick={closeEditingAssetModal}
        >
          <div
            className="w-full max-w-[1120px] max-h-[90vh] overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {editorTitle}
              </h3>
              <button
                onClick={closeEditingAssetModal}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-[340px_1fr] gap-6">
              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
                    {editorNameLabel}
                  </div>
                  <input
                    value={editingAsset.name}
                    readOnly
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-primary)] text-sm text-[var(--text-muted)] outline-none rounded-lg cursor-not-allowed"
                  />
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
                    {editorDescLabel}
                  </div>
                  <textarea
                    value={editingAsset.description}
                    onChange={(e) =>
                      setEditingAsset((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev
                      )
                    }
                    rows={7}
                    className="w-full bg-[var(--bg-base)] border border-[var(--accent)] text-[var(--text-primary)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono leading-relaxed h-[220px]"
                  />
                </div>

                <div className="border border-[var(--border-primary)] rounded-lg p-3 bg-[var(--bg-elevated)]/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
                      {editorAssetTypeLabel}参考图
                    </div>
                    {editingAsset.shapeReferenceImage && (
                      <button
                        onClick={() =>
                          setEditingAsset((prev) =>
                            prev ? { ...prev, shapeReferenceImage: '' } : prev
                          )
                        }
                        className="text-[9px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        title={`清除${editorAssetTypeLabel}参考图`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px] text-[var(--text-muted)]">
                      {editorReferenceHint}
                    </div>
                    <label className="ml-auto px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      上传{editorAssetTypeLabel}参考图
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadShapeReference}
                      />
                    </label>
                  </div>
                  {editingAsset.shapeReferenceImage && (
                    <div className="mt-2 flex items-center gap-2 border border-[var(--border-primary)] rounded px-2 py-1.5 bg-[var(--bg-base)]">
                      <img
                        src={editingAsset.shapeReferenceImage}
                        alt={`${editorAssetTypeLabel}参考图`}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <div className="text-[9px] text-[var(--text-muted)]">
                        已设置{editorAssetTypeLabel}参考图，下次生成生效
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <label className="h-full min-h-[420px] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center cursor-pointer overflow-hidden">
                {editingAsset.imageUrl ? (
                  <img
                    src={editingAsset.imageUrl}
                    alt="参考图"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-[var(--text-muted)]">
                    <Plus className="w-12 h-12 mx-auto mb-2" />
                    <div className="text-base">上传图片</div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadMainImage}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditingAssetModal}
                className="px-6 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditingAsset}
                disabled={!canSubmitEditingAsset}
                className="px-6 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {newMediaAsset && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--bg-base)]/75 p-6"
          onClick={() => {
            if (!isSavingMediaAsset) closeMediaAssetModal()
          }}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {editingMediaAsset ? '编辑' : '新增'}
                {mediaTypeText[newMediaAsset.type]}资源
              </h3>
              <button
                onClick={() => {
                  if (!isSavingMediaAsset) closeMediaAssetModal()
                }}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="关闭"
                disabled={isSavingMediaAsset}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
                  资源名称
                </div>
                <input
                  value={newMediaAsset.name}
                  onChange={(e) =>
                    setNewMediaAsset((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev
                    )
                  }
                  placeholder={`输入${mediaTypeText[newMediaAsset.type]}资源名`}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] outline-none rounded-lg focus:border-[var(--accent)]"
                />
              </div>

              <label className="block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer overflow-hidden relative">
                <div
                  className={`aspect-video w-full flex items-center justify-center ${
                    newMediaAsset.type === 'audio' ? 'p-4' : ''
                  }`}
                >
                  {newMediaAsset.dataUrl ? (
                    newMediaAsset.type === 'image' ? (
                      <img
                        src={newMediaAsset.dataUrl}
                        alt={newMediaAsset.name || '图片预览'}
                        className="w-full h-full object-cover"
                      />
                    ) : newMediaAsset.type === 'video' ? (
                      <video
                        src={newMediaAsset.dataUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full max-w-md text-center">
                        <Music2 className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
                        <audio
                          src={newMediaAsset.dataUrl}
                          controls
                          className="w-full"
                        />
                      </div>
                    )
                  ) : (
                    <div className="text-center text-[var(--text-muted)]">
                      <Plus className="w-10 h-10 mx-auto mb-2" />
                      <div className="text-sm">
                        点击上传{mediaTypeText[newMediaAsset.type]}文件
                      </div>
                      <div className="text-[10px] mt-1">
                        {newMediaAsset.type === 'image'
                          ? '支持 jpeg/png/webp/bmp/tiff/gif/heic/heif，宽高(300,6000)，宽高比(0.4,2.5)，<30MB'
                          : newMediaAsset.type === 'video'
                            ? '仅支持 mp4/mov，2-15s，短边480或720，FPS 24-60，<=50MB'
                            : '仅支持 wav/mp3，2-15s，<=15MB'}
                      </div>
                    </div>
                  )}
                </div>
                {isSavingMediaAsset && (
                  <div className="absolute inset-0 bg-[var(--bg-base)]/70 flex flex-col items-center justify-center text-[var(--text-primary)]">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--accent)]" />
                  </div>
                )}
                {newMediaAsset.dataUrl && (
                  <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleReplaceMediaFile()
                      }}
                      disabled={isSavingMediaAsset}
                      className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      更换
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDownloadMediaFile()
                      }}
                      disabled={isSavingMediaAsset}
                      className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept={mediaAcceptType[newMediaAsset.type]}
                  className="hidden"
                  ref={mediaFileInputRef}
                  onChange={handleUploadNewMediaAsset}
                  disabled={isSavingMediaAsset}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (!isSavingMediaAsset) closeMediaAssetModal()
                }}
                disabled={isSavingMediaAsset}
                className="px-6 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSaveNewMediaAsset}
                disabled={!canSubmitMediaAsset}
                className="px-6 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isSavingMediaAsset ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上传中
                  </>
                ) : (
                  editingMediaAsset ? '保存' : '确定'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LarkDirector
