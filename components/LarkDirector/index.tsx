import React, { useEffect, useState } from 'react'
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
  Upload
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
}

const LarkDirector: React.FC<Props> = ({
  project,
  updateProject,
  onGeneratingChange
}) => {
  const { showAlert } = useAlert()
  const { project: seriesProject } = useProjectContext()

  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [editingAsset, setEditingAsset] = useState<EditingAssetDraft | null>(
    null
  )
  const [showAddAssetMenu, setShowAddAssetMenu] = useState(false)
  const [newMediaAsset, setNewMediaAsset] = useState<NewMediaAssetDraft | null>(
    null
  )

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

  const activeClipTitle = activeClip
    ? `片段 ${getClipDisplayNumber(activeClip, activeClipIndex)}`
    : '片段'
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
    video: 'video/*',
    audio: 'audio/*'
  }
  const mediaMaxSizeMap: Record<MediaAssetType, number> = {
    image: 10 * 1024 * 1024,
    video: 50 * 1024 * 1024,
    audio: 20 * 1024 * 1024
  }
  const assetSectionTitleClass =
    'flex items-center gap-2 mb-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest'
  const assetGridClass = 'grid grid-cols-2 gap-3'
  const assetCardClass = 'flex flex-col gap-1.5 cursor-pointer group'
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
    const displayName = `片段 ${getClipDisplayNumber(clips[targetIndex], targetIndex)}`

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

  const handleSaveActiveClipText = (text: string) => {
    if (!activeClip) return
    const targetId = activeClip.id
    updateProject((prev) => ({
      ...prev,
      shots: (prev.shots || []).map((shot) =>
        shot.id === targetId ? { ...shot, actionSummary: text } : shot
      )
    }))
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

  const validateMediaFile = (
    file: File,
    type: MediaAssetType
  ): string | null => {
    const expectedPrefix =
      type === 'image' ? 'image/' : type === 'video' ? 'video/' : 'audio/'
    if (!file.type.startsWith(expectedPrefix)) {
      return `文件类型不正确，请上传${mediaTypeText[type]}文件`
    }
    const maxSize = mediaMaxSizeMap[type]
    if (file.size > maxSize) {
      const maxSizeMb = Math.floor(maxSize / (1024 * 1024))
      return `${mediaTypeText[type]}文件过大，最大支持 ${maxSizeMb}MB`
    }
    return null
  }

  const openNewMediaAssetModal = (type: MediaAssetType) => {
    setShowAddAssetMenu(false)
    setNewMediaAsset({
      type,
      name: '',
      mimeType: '',
      dataUrl: ''
    })
  }

  const handleUploadNewMediaAsset = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !newMediaAsset) return

    const err = validateMediaFile(file, newMediaAsset.type)
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
              dataUrl
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

  const handleSaveNewMediaAsset = () => {
    if (!newMediaAsset) return
    const nextName = newMediaAsset.name.trim()
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

    const now = Date.now()
    const mediaAsset: MediaAsset = {
      id: `media_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: nextName,
      type: newMediaAsset.type,
      mimeType: newMediaAsset.mimeType || 'application/octet-stream',
      dataUrl: newMediaAsset.dataUrl,
      createdAt: now,
      updatedAt: now
    }

    updateProject((prev) => {
      if (!prev.scriptData) {
        showAlert('当前剧本数据不可用，无法新增资源', { type: 'warning' })
        return prev
      }
      return {
        ...prev,
        scriptData: {
          ...prev.scriptData,
          mediaAssets: [...(prev.scriptData.mediaAssets || []), mediaAsset]
        }
      }
    })

    console.info('[LarkDirector] 媒体资源新增成功', {
      actor: 'user',
      action: 'create-media-asset',
      mediaType: mediaAsset.type,
      mediaAssetId: mediaAsset.id,
      mediaAssetName: mediaAsset.name
    })
    setNewMediaAsset(null)
    showAlert(`${mediaTypeText[mediaAsset.type]}资源已添加`, { type: 'success' })
  }

  const openAssetEditor = (type: EditingAssetType, id: string) => {
    if (!project.scriptData) {
      showAlert('当前剧本数据不可用', { type: 'warning' })
      return
    }

    if (type === 'character') {
      const character = project.scriptData.characters.find((item) => item.id === id)
      if (!character) return
      setEditingAsset({
        type,
        id,
        name: character.name || '',
        description: character.visualPrompt || '',
        imageUrl: character.referenceImage || '',
        shapeReferenceImage: character.shapeReferenceImage || ''
      })
      return
    }

    if (type === 'scene') {
      const scene = project.scriptData.scenes.find((item) => item.id === id)
      if (!scene) return
      setEditingAsset({
        type,
        id,
        name: scene.location || '',
        description: scene.visualPrompt || '',
        imageUrl: scene.referenceImage || '',
        shapeReferenceImage: scene.shapeReferenceImage || ''
      })
      return
    }

    const prop = (project.scriptData.props || []).find((item) => item.id === id)
    if (!prop) return
    setEditingAsset({
      type,
      id,
      name: prop.name || '',
      description: prop.visualPrompt || '',
      imageUrl: prop.referenceImage || '',
      shapeReferenceImage: prop.shapeReferenceImage || ''
    })
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

    setEditingAsset(null)
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

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] overflow-hidden text-[var(--text-primary)] select-none">
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
              onMouseEnter={() => setShowAddAssetMenu(true)}
              onMouseLeave={() => setShowAddAssetMenu(false)}
            >
              <button className="p-1 hover:bg-[var(--bg-hover)] rounded">
                <Plus className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              {showAddAssetMenu && (
                <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] shadow-xl p-1.5">
                  <button
                    onClick={() => openNewMediaAssetModal('image')}
                    className="w-full px-2 py-2 rounded-lg text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    图片
                  </button>
                  <button
                    onClick={() => openNewMediaAssetModal('video')}
                    className="w-full px-2 py-2 rounded-lg text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <Film className="w-3.5 h-3.5" />
                    视频
                  </button>
                  <button
                    onClick={() => openNewMediaAssetModal('audio')}
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
                    className={assetCardClass}
                    onClick={() => openAssetEditor('character', char.id)}
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
                    className={assetCardClass}
                    onClick={() => openAssetEditor('scene', scene.id)}
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
                    className={assetCardClass}
                    onClick={() => openAssetEditor('prop', prop.id)}
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
                      <div key={item.id} className={assetCardClass}>
                        <div className={assetImageWrapClass}>
                          <img
                            src={item.dataUrl}
                            alt={item.name}
                            className={assetImageClass}
                          />
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
                      <div key={item.id} className={assetCardClass}>
                        <div className={assetImageWrapClass}>
                          <video src={item.dataUrl} className={assetImageClass} />
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
                      <div key={item.id} className={assetCardClass}>
                        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] p-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mb-2">
                            <Music2 className="w-3.5 h-3.5" />
                            音频
                          </div>
                          <audio
                            src={item.dataUrl}
                            controls
                            className="w-full h-8"
                          />
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
                  initialText={activeClip?.actionSummary ?? ''}
                  placeholder="输入描述，@ 引用角色/道具/场景/媒体..."
                  autoFocusWhenEmpty={true}
                  onSaveText={handleSaveActiveClipText}
                />
              </div>
            </div>

            {/* Video Player Area */}
            <div className="w-[360px] bg-black shrink-0 relative flex flex-col">
              <div className="flex-1 relative flex items-center justify-center">
                {activeClip?.videoUrl ? (
                  <video
                    src={activeClip.videoUrl}
                    className="w-full h-full object-cover"
                    controls={false}
                  />
                ) : (
                  <div className="text-[var(--text-muted)] text-xs">
                    视频预览区
                  </div>
                )}

                {/* Fake Video Controls Overlay */}
                <div className="absolute top-4 right-4">
                  <button className="p-1.5 bg-black/40 text-white rounded-full backdrop-blur hover:bg-black/60 transition-colors">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
              <button className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                多选
              </button>
            </div>

            <div className="flex-1 overflow-x-auto px-4 py-3 flex items-center gap-4 custom-scrollbar">
              {clips.map((clip, idx) => (
                <div
                  key={clip.id}
                  className={`w-36 aspect-[16/12] rounded-xl shrink-0 border cursor-pointer relative p-1.5 ${
                    activeClipIndex === idx
                      ? 'border-[var(--accent)] bg-[var(--bg-base)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-base)] hover:border-[var(--border-secondary)]'
                  } transition-colors`}
                  onClick={() => setActiveClipIndex(idx)}
                >
                  <div className="relative w-full h-full rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
                    <div className="absolute top-1 left-1 w-4 h-4 bg-black/45 rounded flex items-center justify-center text-[8px] text-white z-10 backdrop-blur-sm">
                      {getClipDisplayNumber(clip, idx)}
                    </div>

                    {clip.videoUrl ? (
                      <video
                        src={clip.videoUrl}
                        className="w-full h-full object-cover"
                      />
                    ) : clip.keyframes?.[0]?.imageUrl ? (
                      <img
                        src={clip.keyframes[0].imageUrl}
                        className="w-full h-full object-cover"
                        alt="start frame"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[10px]">
                        无画面
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/45 rounded text-[8px] text-white font-mono z-10 backdrop-blur-sm">
                      00:
                      {Math.floor(clip.duration || 5)
                        .toString()
                        .padStart(2, '0')}
                    </div>
                  </div>
                </div>
              ))}

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
            </div>
          </div>
        </main>
      </div>
      {editingAsset && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-base)]/75 p-6"
          onClick={() => setEditingAsset(null)}
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
                onClick={() => setEditingAsset(null)}
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
                onClick={() => setEditingAsset(null)}
                className="px-6 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditingAsset}
                className="px-6 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-sm font-medium transition-colors"
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
          onClick={() => setNewMediaAsset(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                新增{mediaTypeText[newMediaAsset.type]}资源
              </h3>
              <button
                onClick={() => setNewMediaAsset(null)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="关闭"
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

              <label className="block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer overflow-hidden">
                <div className="aspect-video w-full flex items-center justify-center p-4">
                  {newMediaAsset.dataUrl ? (
                    newMediaAsset.type === 'image' ? (
                      <img
                        src={newMediaAsset.dataUrl}
                        alt={newMediaAsset.name || '图片预览'}
                        className="max-h-full max-w-full object-contain"
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
                          ? '支持常见图片格式，最大 10MB'
                          : newMediaAsset.type === 'video'
                            ? '支持常见视频格式，最大 50MB'
                            : '支持常见音频格式，最大 20MB'}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept={mediaAcceptType[newMediaAsset.type]}
                  className="hidden"
                  onChange={handleUploadNewMediaAsset}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setNewMediaAsset(null)}
                className="px-6 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveNewMediaAsset}
                className="px-6 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-sm font-medium transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LarkDirector
