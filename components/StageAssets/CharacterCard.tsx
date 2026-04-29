import React, { useEffect, useState } from 'react'
import {
  User,
  Shirt,
  Trash2,
  Edit2,
  AlertCircle,
  FolderPlus,
  FolderMinus,
  Grid3x3,
  Link2,
  Upload,
  Check,
  X,
  Loader2,
  Sparkles,
  Camera,
  History
} from 'lucide-react'
import { Character, CharacterGenerationHistoryItem } from '../../types'
import ImageUploadButton from './ImageUploadButton'
import InlineEditableText from './InlineEditableText'

interface CharacterCardProps {
  character: Character
  hasAssetId: boolean
  isInGlobalLibrary?: boolean
  isInProjectLibrary?: boolean
  isGenerating: boolean
  shapeReferenceImage?: string
  onGenerate: (promptOverride?: string) => void
  onUpload: (file: File) => void
  onUploadShapeReference: (file: File) => void
  onClearShapeReference: () => void
  onPromptSave: (newPrompt: string) => void
  onOpenWardrobe: () => void
  onOpenTurnaround: () => void
  onImageClick: (imageUrl: string) => void
  onSelectHistoryItem: (historyId: string) => void
  onDeleteHistoryItem: (historyId: string) => void
  onDelete: () => void
  onUpdateInfo: (updates: {
    name?: string
    gender?: string
    age?: string
    personality?: string
  }) => void
  onAddToLibrary: () => void
  onAddToProjectLibrary?: () => void
  onReplaceFromLibrary: () => void
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  hasAssetId,
  isInGlobalLibrary = false,
  isInProjectLibrary = false,
  isGenerating,
  shapeReferenceImage,
  onGenerate,
  onUpload,
  onUploadShapeReference,
  onClearShapeReference,
  onPromptSave,
  onOpenWardrobe,
  onOpenTurnaround,
  onImageClick,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onDelete,
  onUpdateInfo,
  onAddToLibrary,
  onAddToProjectLibrary,
  onReplaceFromLibrary
}) => {
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [promptDraft, setPromptDraft] = useState(character.visualPrompt || '')
  const isLinked = !!character.libraryId

  useEffect(() => {
    if (showGenerateModal) {
      setPromptDraft(character.visualPrompt || '')
    }
  }, [showGenerateModal, character.visualPrompt])

  const openGenerateModal = () => {
    if (isGenerating) return
    setShowGenerateModal(true)
  }

  const handleConfirmGenerate = () => {
    if (isGenerating) return
    const normalizedPrompt = promptDraft.trim()
    if (normalizedPrompt !== (character.visualPrompt || '')) {
      onPromptSave(normalizedPrompt)
    }
    setShowGenerateModal(false)
    onGenerate(normalizedPrompt)
  }

  const handleShapeReferenceChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    onUploadShapeReference(file)
    e.target.value = ''
  }

  const generationHistory: CharacterGenerationHistoryItem[] =
    character.generationHistory || []

  return (
    <div
      className={`relative bg-[var(--bg-surface)] border rounded-xl overflow-hidden flex flex-col group transition-all hover:shadow-lg ${
        hasAssetId
          ? 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
          : 'border-[var(--warning)] hover:border-[var(--warning)]'
      }`}
    >
      {!hasAssetId && (
        <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded border border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)] text-[9px] font-mono uppercase tracking-wider">
          未同步
        </div>
      )}
      <div className="aspect-video bg-[var(--bg-elevated)] relative">
        {isLinked && (
          <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-md flex items-center gap-1.5">
            <Link2 className="w-3 h-3 text-[var(--accent-text)]" />
            <span className="text-[9px] font-mono text-[var(--accent-text)] uppercase tracking-widest">
              项目角色
            </span>
          </div>
        )}
        {character.referenceImage ? (
          <>
            <img
              src={character.referenceImage}
              alt={character.name}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => onImageClick(character.referenceImage)}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-4 text-center">
            {character.status === 'failed' ? (
              <>
                <AlertCircle className="w-10 h-10 mb-3 text-[var(--error)]" />
                <span className="text-[10px] text-[var(--error)] mb-2">
                  生成失败
                </span>
                <ImageUploadButton
                  variant="inline"
                  size="medium"
                  onUpload={onUpload}
                  onGenerate={openGenerateModal}
                  isGenerating={isGenerating}
                  uploadLabel="上传"
                  generateLabel="重试"
                />
              </>
            ) : (
              <>
                <User className="w-10 h-10 mb-3 opacity-10" />
                <ImageUploadButton
                  variant="inline"
                  size="medium"
                  onUpload={onUpload}
                  onGenerate={openGenerateModal}
                  isGenerating={isGenerating}
                  uploadLabel="上传"
                  generateLabel="生成"
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border-primary)]">
        <InlineEditableText
          value={character.name}
          onSave={(next) => onUpdateInfo({ name: next })}
          inputClassName="font-bold text-[var(--text-primary)] text-base mb-1 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-2 py-1 w-full focus:outline-none focus:border-[var(--accent)]"
          renderDisplay={(value, startEdit) => (
            <div className="flex items-center gap-2 mb-1 group/name">
              <h3 className="font-bold text-[var(--text-primary)] text-base">
                {value}
              </h3>
              <button
                onClick={startEdit}
                className="opacity-0 group-hover/name:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-opacity"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        />
        <div className="flex items-center gap-2">
          <InlineEditableText
            value={character.gender}
            onSave={(next) => onUpdateInfo({ gender: next })}
            inputClassName="text-[10px] text-[var(--text-primary)] font-mono uppercase bg-[var(--bg-hover)] border border-[var(--border-secondary)] px-2 py-0.5 rounded focus:outline-none focus:border-[var(--accent)] w-20"
            renderDisplay={(value, startEdit) => (
              <span
                onClick={startEdit}
                className="text-[10px] text-[var(--text-tertiary)] font-mono uppercase bg-[var(--bg-elevated)] px-2 py-0.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {value}
              </span>
            )}
          />
          <InlineEditableText
            value={character.age}
            onSave={(next) => onUpdateInfo({ age: next })}
            inputClassName="text-[10px] text-[var(--text-primary)] bg-[var(--bg-hover)] border border-[var(--border-secondary)] px-2 py-0.5 rounded focus:outline-none focus:border-[var(--accent)] w-20"
            renderDisplay={(value, startEdit) => (
              <span
                onClick={startEdit}
                className="text-[10px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
              >
                {value}
              </span>
            )}
          />
          {character.variations && character.variations.length > 0 && (
            <span className="text-[9px] text-[var(--text-tertiary)] font-mono flex items-center gap-1 bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
              <Shirt className="w-2.5 h-2.5" /> +{character.variations.length}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons Row - Moved below image */}
      <div className="px-4 grid grid-cols-2 gap-2">
        <button
          onClick={onOpenWardrobe}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors"
        >
          <Shirt className="w-3 h-3" />
          服装变体
        </button>

        <button
          onClick={onOpenTurnaround}
          className={`w-full py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-colors ${
            character.turnaround?.status === 'completed'
              ? 'bg-[var(--accent-bg)] hover:bg-[var(--accent-hover-bg)] text-[var(--accent-text)] border-[var(--accent-border)]'
              : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border-[var(--border-primary)]'
          }`}
        >
          <Grid3x3 className="w-3 h-3" />
          造型九宫格
          {character.turnaround?.status === 'completed' && (
            <Check className="w-2.5 h-2.5" />
          )}
        </button>

        <button
          onClick={onReplaceFromLibrary}
          disabled={isGenerating}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3 h-3" />
          资产库替换
        </button>

        <label className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors cursor-pointer">
          <Upload className="w-3 h-3" />
          上传
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                onUpload(file)
                e.target.value = ''
              }
            }}
          />
        </label>

        <button
          onClick={onAddToLibrary}
          disabled={isGenerating}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isInGlobalLibrary ? (
            <FolderMinus className="w-3 h-3" />
          ) : (
            <FolderPlus className="w-3 h-3" />
          )}
          {isInGlobalLibrary ? '从全局资产库移除' : '加入全局资产库'}
        </button>
        <button
          onClick={onAddToProjectLibrary}
          disabled={isGenerating}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isInProjectLibrary ? (
            <FolderMinus className="w-3 h-3" />
          ) : (
            <FolderPlus className="w-3 h-3" />
          )}
          {isInProjectLibrary ? '从项目角色库移除' : '加入项目角色库'}
        </button>
      </div>

      <div className="px-4 pb-4 pt-2 flex-1 flex flex-col gap-2">
        <div className="border border-[var(--border-primary)] rounded-lg p-2.5 bg-[var(--bg-elevated)]/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3 h-3" />
              历史记录
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {generationHistory.length} 个版本
            </span>
          </div>
          {generationHistory.length === 0 ? (
            <div className="h-[74px] border border-dashed border-[var(--border-primary)] rounded-md flex items-center justify-center text-[10px] text-[var(--text-muted)]">
              暂无历史版本
            </div>
          ) : (
            <div className="flex gap-2 h-[74px] overflow-x-auto overflow-y-hidden pb-1">
              {generationHistory.map((item, index) => {
                const isActiveHistoryItem =
                  item.imageUrl === character.referenceImage
                return (
                  <div
                    key={item.id}
                    className="group/history relative h-16 w-16 min-w-16 rounded-md overflow-hidden border border-[var(--border-primary)] bg-[var(--bg-base)] flex-shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectHistoryItem(item.id)}
                      className="w-full h-full"
                      title={`设为当前主图（历史版本 ${generationHistory.length - index}）`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={`历史版本 ${generationHistory.length - index}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                    {isActiveHistoryItem ? (
                      <span
                        className="absolute top-1 right-1 p-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--accent-border)]"
                        title="当前激活版本"
                      >
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDeleteHistoryItem(item.id)}
                        className="absolute top-1 right-1 p-0.5 rounded bg-[var(--bg-base)]/90 text-[var(--text-tertiary)] hover:text-[var(--error-text)] opacity-0 group-hover/history:opacity-100 transition-opacity"
                        title="删除该历史版本"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {character.referenceImage && (
          <button
            onClick={openGenerateModal}
            disabled={isGenerating}
            className="w-full py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                重新生成
              </>
            )}
          </button>
        )}

        {/* Delete Button */}
        <button
          onClick={onDelete}
          disabled={isGenerating}
          className="w-full py-2 bg-transparent hover:bg-[var(--error-bg)] text-[var(--error-text)] hover:text-[var(--error-text)] border border-[var(--error-border)] hover:border-[var(--error-border)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3 h-3" />
          删除角色
        </button>
      </div>

      {showGenerateModal && (
        <div className="fixed inset-0 z-40 bg-[var(--bg-base)]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                编辑角色
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <Camera className="w-3 h-3" />
                  角色提示词
                </label>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--accent)] text-[var(--text-primary)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono leading-relaxed h-[220px]"
                  placeholder="输入角色的视觉描述..."
                  autoFocus
                />
              </div>

              <div className="border border-[var(--border-primary)] rounded-lg p-3 bg-[var(--bg-elevated)]/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
                    角色参考图
                  </span>
                  {shapeReferenceImage && (
                    <button
                      onClick={onClearShapeReference}
                      disabled={isGenerating}
                      className="text-[9px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      title="清除角色参考图"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    上传角色参考图
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleShapeReferenceChange}
                    />
                  </label>
                  <span className="text-[9px] text-[var(--text-muted)]">
                    仅参考角色外形，风格遵循剧本
                  </span>
                </div>
                {shapeReferenceImage && (
                  <button
                    onClick={() => onImageClick(shapeReferenceImage)}
                    className="mt-2 w-full flex items-center gap-2 p-2 rounded border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-colors text-left"
                  >
                    <img
                      src={shapeReferenceImage}
                      alt="角色参考图"
                      className="w-10 h-10 rounded object-cover"
                    />
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      已设置角色参考图，下次生成将生效
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-6 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmGenerate}
                disabled={isGenerating}
                className="px-6 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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

export default CharacterCard
