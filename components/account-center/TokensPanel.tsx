import React from 'react';
import { Copy, Key, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { NewApiStatus, NewApiToken } from '../../services/newApiService';
import { TokenFormState } from './types';
import { formatDateTime, formatQuota, getTokenStatusMeta, maskTokenKey } from './utils';
import { EmptyState, SectionCard } from './ui';

interface TokensPanelProps {
  status: NewApiStatus | null;
  tokens: NewApiToken[];
  tokensLoading: boolean;
  tokenPage: number;
  tokenTotal: number;
  tokenPageSize: number;
  createTokenLoading: boolean;
  tokenForm: TokenFormState;
  setTokenForm: React.Dispatch<React.SetStateAction<TokenFormState>>;
  onCreateToken: () => Promise<boolean>;
  onRefreshTokens: () => Promise<void>;
  onPageChange: (page: number) => Promise<void>;
  onToggleToken: (token: NewApiToken) => Promise<void>;
  onDeleteToken: (token: NewApiToken) => Promise<void>;
  onCopyToken: (token: NewApiToken) => Promise<void>;
  onUseTokenInProject: (token: NewApiToken) => void;
}

export const TokensPanel: React.FC<TokensPanelProps> = ({
  status,
  tokens,
  tokensLoading,
  tokenPage,
  tokenTotal,
  tokenPageSize,
  createTokenLoading,
  tokenForm,
  setTokenForm,
  onCreateToken,
  onRefreshTokens,
  onPageChange,
  onToggleToken,
  onDeleteToken,
  onCopyToken,
  onUseTokenInProject,
}) => {
  const totalPages = Math.max(1, Math.ceil(tokenTotal / tokenPageSize));
  const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);

  const handleCreate = async () => {
    const created = await onCreateToken();
    if (created) {
      setIsCreateFormOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <SectionCard title="创建新令牌" description="先把当前项目最需要的创作密钥创建出来，再决定是否限额或设置到期时间。">
          {isCreateFormOpen ? (
            <div className="space-y-4">
              <input
                value={tokenForm.name}
                onChange={(event) => setTokenForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="令牌名称"
                className="w-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="datetime-local"
                  value={tokenForm.expiredAt}
                  onChange={(event) => setTokenForm((current) => ({ ...current, expiredAt: event.target.value }))}
                  className="w-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]"
                />

                <label className="flex items-center gap-3 border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={tokenForm.unlimitedQuota}
                    onChange={(event) => setTokenForm((current) => ({ ...current, unlimitedQuota: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  创建无限额度令牌
                </label>
              </div>

              {!tokenForm.unlimitedQuota && (
                <div className="border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-4 text-sm leading-6 text-[var(--text-tertiary)]">
                  已关闭无限额度时，系统会按默认的 1 点额度创建令牌，不再单独展示额度输入框。
                </div>
              )}

              <div className="border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-4 text-sm leading-6 text-[var(--text-tertiary)]">
                如果你准备把它直接用于当前项目，建议先创建一个名字明确、便于回填的令牌，例如 “BigBanana-创作主 Key”。
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setIsCreateFormOpen(false)}
                  disabled={createTokenLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  onClick={() => void handleCreate()}
                  disabled={createTokenLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                >
                  {createTokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  确认创建
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-6 text-center">
              <button
                onClick={() => setIsCreateFormOpen(true)}
                className="mt-5 flex items-center justify-center gap-2 px-5 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" /> 创建新令牌
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="令牌列表"
          description="把复制、启停、删除和回填当前项目这几件事收敛到一个列表操作区。"
          action={(
            <button
              onClick={() => void onRefreshTokens()}
              disabled={tokensLoading}
              className="flex items-center gap-2 px-4 py-3 border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors disabled:opacity-60"
            >
              {tokensLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              <span className="font-medium text-xs tracking-widest uppercase">刷新令牌</span>
            </button>
          )}
        >
          <div className="space-y-4">
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {tokensLoading ? (
                <div className="flex min-h-[220px] items-center justify-center text-[var(--text-tertiary)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : tokens.length === 0 ? (
                <EmptyState title="还没有令牌" description="先创建一个新的令牌，再把它一键设为当前项目的全局 API Key。" />
              ) : (
                tokens.map((token) => {
                  const statusMeta = getTokenStatusMeta(token.status);
                  return (
                    <div key={token.id} className="border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-sm font-bold text-[var(--text-primary)]">{token.name}</div>
                            <span className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${statusMeta.className}`}>{statusMeta.label}</span>
                          </div>
                          <div className="mt-2 break-all font-mono text-sm text-[var(--text-tertiary)]">{maskTokenKey(token.key)}</div>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <button onClick={() => void onCopyToken(token)} className="flex items-center gap-2 border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors">
                            <Copy className="w-3.5 h-3.5" /> 复制
                          </button>
                          <button onClick={() => onUseTokenInProject(token)} className="flex items-center gap-2 border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors">
                            <Key className="w-3.5 h-3.5" /> 设为项目 Key
                          </button>
                          {(token.status === 1 || token.status === 2) && (
                            <button onClick={() => void onToggleToken(token)} className="border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors">
                              {token.status === 1 ? '禁用' : '启用'}
                            </button>
                          )}
                          <button onClick={() => void onDeleteToken(token)} className="flex items-center gap-2 border border-rose-500/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> 删除
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">剩余额度</div>
                          <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{token.unlimited_quota ? '无限额度' : formatQuota(token.remain_quota, status)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">累计消耗</div>
                          <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{formatQuota(token.used_quota, status)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">创建时间</div>
                          <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{formatDateTime(token.created_time)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">到期时间</div>
                          <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{token.expired_time === -1 ? '永不过期' : formatDateTime(token.expired_time)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {tokenTotal > tokenPageSize && (
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                <span>第 {tokenPage} / {totalPages} 页，共 {tokenTotal} 条</span>
                <div className="flex gap-2">
                  <button onClick={() => void onPageChange(Math.max(1, tokenPage - 1))} disabled={tokenPage <= 1} className="border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors disabled:opacity-40">上一页</button>
                  <button onClick={() => void onPageChange(Math.min(totalPages, tokenPage + 1))} disabled={tokenPage >= totalPages} className="border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors disabled:opacity-40">下一页</button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
