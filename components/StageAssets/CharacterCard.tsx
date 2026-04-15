import React from 'react';
import { User, Check, Shirt, Trash2, Edit2, AlertCircle, FolderPlus, Grid3x3, Link2, Upload, X, Loader2, Sparkles } from 'lucide-react';
import { Character } from '../../types';
import PromptEditor from './PromptEditor';
import ImageUploadButton from './ImageUploadButton';
import InlineEditableText from './InlineEditableText';

interface CharacterCardProps {
  character: Character;
  isGenerating: boolean;
  shapeReferenceImage?: string;
  onGenerate: () => void;
  onUpload: (file: File) => void;
  onUploadShapeReference: (file: File) => void;
  onClearShapeReference: () => void;
  onPromptSave: (newPrompt: string) => void;
  onOpenWardrobe: () => void;
  onOpenTurnaround: () => void;
  onImageClick: (imageUrl: string) => void;
  onDelete: () => void;
  onUpdateInfo: (updates: { name?: string; gender?: string; age?: string; personality?: string }) => void;
  onAddToLibrary: () => void;
  onAddToProjectLibrary?: () => void;
  onReplaceFromLibrary: () => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
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
  onDelete,
  onUpdateInfo,
  onAddToLibrary,
  onAddToProjectLibrary,
  onReplaceFromLibrary,
}) => {
  const isLinked = !!character.libraryId;
  const handleShapeReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploadShapeReference(file);
    e.target.value = '';
  };

  return (
    <div className={`bg-[var(--bg-surface)] border rounded-xl overflow-hidden flex flex-col group transition-all hover:shadow-lg ${isLinked ? 'border-[var(--accent-border)] hover:border-[var(--accent)]' : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'}`}>
      {isLinked && (
        <div className="px-4 py-1.5 bg-[var(--accent-bg)] border-b border-[var(--accent-border)] flex items-center gap-1.5">
          <Link2 className="w-3 h-3 text-[var(--accent-text)]" />
          <span className="text-[9px] font-mono text-[var(--accent-text)] uppercase tracking-widest">项目角色</span>
        </div>
      )}
      <div className="flex gap-4 p-4 pb-0">
        {/* Character Image */}
        <div className="w-48 flex-shrink-0">
          <div
            className="aspect-video bg-[var(--bg-elevated)] relative rounded-lg overflow-hidden cursor-pointer"
            onClick={() => character.referenceImage && onImageClick(character.referenceImage)}
          >
            {character.referenceImage ? (
              <>
                <img src={character.referenceImage} alt={character.name} className="w-full h-full object-cover" />
                <div className="absolute top-1.5 right-1.5 p-1 bg-[var(--accent)] text-[var(--text-primary)] rounded shadow-lg">
                  <Check className="w-3 h-3" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-2 text-center">
                {character.status === 'failed' ? (
                  <>
                    <AlertCircle className="w-8 h-8 mb-2 text-[var(--error)]" />
                    <span className="text-[10px] text-[var(--error)] mb-2">生成失败</span>
                    <ImageUploadButton
                      variant="inline"
                      size="small"
                      onUpload={onUpload}
                      onGenerate={onGenerate}
                      isGenerating={isGenerating}
                      uploadLabel="上传"
                      generateLabel="重试"
                    />
                  </>
                ) : (
                  <>
                    <User className="w-8 h-8 mb-2 opacity-10" />
                    <ImageUploadButton
                      variant="inline"
                      size="small"
                      onUpload={onUpload}
                      onGenerate={onGenerate}
                      isGenerating={isGenerating}
                      uploadLabel="上传"
                      generateLabel="生成"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Character Info & Actions */}
        <div className="flex-1 flex flex-col min-w-0 justify-between">
          {/* Header */}
          <div>
            <InlineEditableText
              value={character.name}
              onSave={(next) => onUpdateInfo({ name: next })}
              inputClassName="font-bold text-[var(--text-primary)] text-base mb-1 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-2 py-1 w-full focus:outline-none focus:border-[var(--accent)]"
              renderDisplay={(value, startEdit) => (
                <div className="flex items-center gap-2 mb-1 group/name">
                  <h3 className="font-bold text-[var(--text-primary)] text-base">{value}</h3>
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

        </div>
      </div>

      {/* Action Buttons Row - Moved below image */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onOpenWardrobe}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors"
        >
          <Shirt className="w-3 h-3" />
          服装变体
        </button>

        <button
          onClick={onOpenTurnaround}
          className={`w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-colors ${
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
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3 h-3" />
          资产库替换
        </button>

        <label className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors cursor-pointer">
          <Upload className="w-3 h-3" />
          上传
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUpload(file);
                e.target.value = '';
              }
            }}
          />
        </label>

        <button
          onClick={onAddToLibrary}
          disabled={isGenerating}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3 h-3" />
          加入全局资产库
        </button>
        <button
          onClick={onAddToProjectLibrary}
          disabled={isGenerating}
          className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3 h-3" />
          加入项目角色库
        </button>
      </div>

      {/* Prompt Section & Generate Button */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Prompt Section */}
        <div className="flex-1 mb-3">
          <PromptEditor
            prompt={character.visualPrompt || ''}
            onSave={onPromptSave}
            label="角色提示词"
            placeholder="输入角色的视觉描述..."
          />
        </div>

        <div className="mb-3 border border-[var(--border-primary)] rounded-lg p-2.5 bg-[var(--bg-elevated)]/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">角色参考图</span>
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
            <span className="text-[9px] text-[var(--text-muted)]">仅参考角色外形，风格遵循剧本</span>
          </div>
          {shapeReferenceImage && (
            <button
              onClick={() => onImageClick(shapeReferenceImage)}
              className="mt-2 w-full flex items-center gap-2 p-2 rounded border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-colors text-left"
            >
              <img src={shapeReferenceImage} alt="角色参考图" className="w-10 h-10 rounded object-cover" />
              <span className="text-[10px] text-[var(--text-secondary)]">已设置角色参考图，下次生成将生效</span>
            </button>
          )}
        </div>

        {character.referenceImage && (
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full py-2 mt-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
          className="w-full py-2 mt-2 bg-transparent hover:bg-[var(--error-bg)] text-[var(--error-text)] hover:text-[var(--error-text)] border border-[var(--error-border)] hover:border-[var(--error-border)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3 h-3" />
          删除角色
        </button>
      </div>
    </div>
  );
};

export default CharacterCard;
