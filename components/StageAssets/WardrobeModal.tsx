import React, { useState } from 'react'
import {
  User,
  X,
  Shirt,
  Plus,
  RefreshCw,
  Loader2,
  Upload,
  AlertCircle
} from 'lucide-react'
import { Character, CharacterVariation } from '../../types'
import ImageUploadButton from './ImageUploadButton'
import { generateId } from './utils'

interface WardrobeModalProps {
  character: Character
  onClose: () => void
  onAddVariation: (charId: string, name: string, prompt: string) => void
  onDeleteVariation: (charId: string, varId: string) => void
  onGenerateVariation: (charId: string, varId: string, prompt?: string) => void
  onUploadVariation: (charId: string, varId: string, file: File) => void
  onSyncVariation: (charId: string, varId: string) => void
  isVariationSyncing: (varId: string) => boolean
  onImageClick: (imageUrl: string) => void
}

const WardrobeModal: React.FC<WardrobeModalProps> = ({
  character,
  onClose,
  onAddVariation,
  onDeleteVariation,
  onGenerateVariation,
  onUploadVariation,
  onSyncVariation,
  isVariationSyncing,
  onImageClick
}) => {
  const [newVarName, setNewVarName] = useState('')
  const [newVarPrompt, setNewVarPrompt] = useState('')
  const [editingVariationId, setEditingVariationId] = useState<string | null>(
    null
  )
  const [editingVariationPrompt, setEditingVariationPrompt] = useState('')

  const handleAddVariation = () => {
    if (newVarName && newVarPrompt) {
      onAddVariation(character.id, newVarName, newVarPrompt)
      setNewVarName('')
      setNewVarPrompt('')
    }
  }

  const openRegenerateDialog = (variation: CharacterVariation) => {
    if (variation.status === 'generating') return
    setEditingVariationId(variation.id)
    setEditingVariationPrompt(variation.visualPrompt || '')
  }

  const closeRegenerateDialog = () => {
    setEditingVariationId(null)
    setEditingVariationPrompt('')
  }

  const handleConfirmRegenerate = () => {
    if (!editingVariationId) return
    const normalizedPrompt = editingVariationPrompt.trim()
    if (!normalizedPrompt) return
    onGenerateVariation(character.id, editingVariationId, normalizedPrompt)
    closeRegenerateDialog()
  }

  return (
    <div className="absolute inset-0 z-40 bg-[var(--bg-base)]/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-primary)] w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-8 border-b border-[var(--border-primary)] flex items-center justify-between shrink-0 bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] overflow-hidden border border-[var(--border-secondary)]">
              {character.referenceImage && (
                <img
                  src={character.referenceImage}
                  className="w-full h-full object-cover"
                  alt={character.name}
                />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {character.name}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] font-mono uppercase tracking-wider">
                服装与变体
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Base Look */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> 基础形象
              </h4>
              <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-primary)]">
                <div
                  className="aspect-video bg-[var(--bg-elevated)] rounded-lg overflow-hidden mb-4 relative cursor-pointer"
                  onClick={() =>
                    character.referenceImage &&
                    onImageClick(character.referenceImage)
                  }
                >
                  {character.referenceImage ? (
                    <img
                      src={character.referenceImage}
                      className="w-full h-full object-cover"
                      alt="基础形象"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                      暂无图片
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-[var(--bg-base)]/60 backdrop-blur rounded text-[10px] text-[var(--text-primary)] font-bold uppercase border border-[var(--overlay-border)]">
                    默认
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed font-mono">
                  {character.visualPrompt}
                </p>
              </div>
            </div>

            {/* Variations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest flex items-center gap-2">
                  <Shirt className="w-4 h-4" /> 服装变体
                </h4>
              </div>

              <div className="space-y-4">
                {/* List */}
                {(character.variations || []).map((variation) => {
                  const isSyncing = isVariationSyncing(variation.id)
                  const canSync =
                    !variation.assetId && !!variation.referenceImage
                  return (
                    <div
                      key={variation.id}
                      className="flex gap-4 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl group hover:border-[var(--border-secondary)] transition-colors"
                    >
                      <div className="w-20 h-24 bg-[var(--bg-elevated)] rounded-lg flex-shrink-0 overflow-hidden relative border border-[var(--border-primary)]">
                        {variation.referenceImage ? (
                          <img
                            src={variation.referenceImage}
                            className="w-full h-full object-cover cursor-pointer"
                            alt={variation.name}
                            onClick={() =>
                              onImageClick(variation.referenceImage!)
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {variation.status === 'failed' ? (
                              <AlertCircle className="w-6 h-6 text-[var(--error)]" />
                            ) : (
                              <Shirt className="w-6 h-6 text-[var(--text-muted)]" />
                            )}
                          </div>
                        )}
                        {variation.status === 'generating' && (
                          <div className="absolute inset-0 bg-[var(--bg-base)]/60 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-[var(--text-primary)] animate-spin" />
                          </div>
                        )}
                        {variation.status === 'failed' &&
                          !variation.referenceImage && (
                            <div className="absolute bottom-0 left-0 right-0 bg-[var(--error-hover-bg-strong)] text-[var(--text-primary)] text-[8px] text-center py-0.5">
                              失败
                            </div>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-[var(--text-secondary)] text-sm">
                            {variation.name}
                          </h5>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!canSync || isSyncing}
                              onClick={() =>
                                canSync &&
                                !isSyncing &&
                                onSyncVariation(character.id, variation.id)
                              }
                              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wider ${
                                isSyncing
                                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-text)] opacity-70 cursor-not-allowed'
                                  : variation.assetId
                                    ? 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]'
                                    : canSync
                                      ? 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)] hover:opacity-80 cursor-pointer'
                                      : 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)] opacity-70 cursor-not-allowed'
                              }`}
                            >
                              {isSyncing
                                ? '同步中'
                                : variation.assetId
                                  ? '已同步'
                                  : '未同步'}
                            </button>
                            <button
                              onClick={() =>
                                onDeleteVariation(character.id, variation.id)
                              }
                              className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] line-clamp-2 mb-3 font-mono">
                          {variation.visualPrompt}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => openRegenerateDialog(variation)}
                            disabled={variation.status === 'generating'}
                            className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50 ${
                              variation.status === 'failed'
                                ? 'text-[var(--error-text)] hover:text-[var(--error-text)]'
                                : 'text-[var(--accent-text)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${variation.status === 'generating' ? 'animate-spin' : ''}`}
                            />
                            {variation.status === 'failed'
                              ? '重试'
                              : variation.referenceImage
                                ? '重新生成'
                                : '生成造型'}
                          </button>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--success-text)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer">
                            <Upload className="w-3 h-3" />
                            上传
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  onUploadVariation(
                                    character.id,
                                    variation.id,
                                    file
                                  )
                                  e.target.value = ''
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Add New */}
                <div className="p-4 border border-dashed border-[var(--border-primary)] rounded-xl bg-[var(--bg-primary)]/50">
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="变体名称（如：战术装备）"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-secondary)]"
                    />
                    <textarea
                      placeholder="服装/状态的视觉描述..."
                      value={newVarPrompt}
                      onChange={(e) => setNewVarPrompt(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-secondary)] resize-none h-16"
                    />
                    <button
                      onClick={handleAddVariation}
                      disabled={!newVarName || !newVarPrompt}
                      className="w-full py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> 添加变体
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {editingVariationId && (
        <div className="absolute inset-0 z-50 bg-[var(--bg-base)]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                编辑服装/状态描述
              </h4>
              <button
                onClick={closeRegenerateDialog}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={editingVariationPrompt}
              onChange={(e) => setEditingVariationPrompt(e.target.value)}
              placeholder="服装/状态的视觉描述..."
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-secondary)] resize-none h-36 font-mono"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeRegenerateDialog}
                className="px-4 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] rounded text-xs font-bold uppercase tracking-wider"
              >
                取消
              </button>
              <button
                onClick={handleConfirmRegenerate}
                disabled={!editingVariationPrompt.trim()}
                className="px-4 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50"
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

export default WardrobeModal
