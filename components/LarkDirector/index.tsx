import React, { useState } from 'react'
import { ProjectState, Shot } from '../../types'
import { useAlert } from '../GlobalAlert'
import { useProjectContext } from '../../contexts/ProjectContext'
import {
  Plus,
  Users,
  Image as ImageIcon,
  Package,
  Maximize2,
  Play,
  Volume2,
  Download,
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
            <button className="p-1 hover:bg-[var(--bg-hover)] rounded">
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
                  <h3 className="text-sm font-bold">片段 1</h3>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    片段时长请限制在4-15s，输入"@"可快速调整镜头时长、引用角色、场景、素材
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  参数设置：
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-sunken)]">
                <ScriptEditorRich
                  project={project}
                  projectLibrary={seriesProject}
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
              {clips.length > 0
                ? clips.map((clip, idx) => (
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
                          {idx + 1}
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
                  ))
                : // Empty state timeline items
                  Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-36 aspect-[16/10] rounded-xl shrink-0 border border-[var(--border-primary)] bg-[var(--bg-base)] p-1.5"
                    >
                      <div className="w-full h-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center relative">
                        <div className="absolute top-1 left-1 w-4 h-4 bg-[var(--bg-base)] rounded flex items-center justify-center text-[8px] text-[var(--text-tertiary)] z-10 border border-[var(--border-subtle)]">
                          {i + 1}
                        </div>
                        <button className="px-2 py-1 bg-[var(--bg-base)] border border-[var(--border-primary)] rounded text-[9px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          生成
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default LarkDirector
