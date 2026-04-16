import React, { useEffect, useState } from 'react'
import { ProjectState, Shot } from '../../types'
import { useAlert } from '../GlobalAlert'
import { useProjectContext } from '../../contexts/ProjectContext'
import { getNextMainShotId, parseShotId } from '../../services/storyboardIdUtils'
import {
  Plus,
  Users,
  Image as ImageIcon,
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
  Sparkles
} from 'lucide-react'
import ScriptEditorRich from './editor/ScriptEditorRich'

interface Props {
  project: ProjectState
  updateProject: (
    updates: Partial<ProjectState> | ((prev: ProjectState) => ProjectState)
  ) => void
  onGeneratingChange?: (isGenerating: boolean) => void
}

const LarkDirector: React.FC<Props> = ({
  project,
  updateProject,
  onGeneratingChange
}) => {
  const { showAlert } = useAlert()
  const { project: seriesProject } = useProjectContext()

  const [activeClipIndex, setActiveClipIndex] = useState(0)

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
    const defaultSceneId = project.scriptData?.scenes?.[0]?.id || 'scene_unassigned'
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
            <button
              onClick={() => showAlert('功能暂未实现', { type: 'warning' })}
              className="p-1 hover:bg-[var(--bg-hover)] rounded"
            >
              <Plus className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {/* Characters */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
                <Users className="w-3 h-3" />
                <span>角色 ({project.scriptData?.characters.length || 0})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {project.scriptData?.characters.map((char) => (
                  <div
                    key={char.id}
                    className="flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <div className="aspect-[3/4] bg-[var(--bg-elevated)] rounded-lg overflow-hidden border border-[var(--border-primary)] group-hover:border-[var(--accent-border)] transition-colors relative">
                      {char.referenceImage ? (
                        <img
                          src={char.referenceImage}
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[10px]">
                          无图片
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] text-center truncate">
                      {char.name}-基础形象
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenes */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
                <ImageIcon className="w-3 h-3" />
                <span>场景 ({project.scriptData?.scenes.length || 0})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {project.scriptData?.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <div className="aspect-video bg-[var(--bg-elevated)] rounded-lg overflow-hidden border border-[var(--border-primary)] group-hover:border-[var(--accent-border)] transition-colors relative">
                      {scene.referenceImage ? (
                        <img
                          src={scene.referenceImage}
                          alt={scene.location}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[10px]">
                          无图片
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] text-center truncate">
                      {scene.location}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Props */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
                <Package className="w-3 h-3" />
                <span>道具 ({project.scriptData?.props.length || 0})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {project.scriptData?.props.map((prop) => (
                  <div
                    key={prop.id}
                    className="flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <div className="aspect-video bg-[var(--bg-elevated)] rounded-lg overflow-hidden border border-[var(--border-primary)] group-hover:border-[var(--accent-border)] transition-colors relative">
                      {prop.referenceImage ? (
                        <img
                          src={prop.referenceImage}
                          alt={prop.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[10px]">
                          无图片
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] text-center truncate">
                      {prop.name}
                    </div>
                  </div>
                ))}
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
                  placeholder="输入描述，@ 引用角色/道具/场景..."
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
                      <video src={clip.videoUrl} className="w-full h-full object-cover" />
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
    </div>
  )
}

export default LarkDirector
