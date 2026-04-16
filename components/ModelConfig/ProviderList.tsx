import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, X, Server, Edit2, Circle, ChevronDown, ChevronUp, Key, Loader2 } from 'lucide-react';
import { ModelProvider } from '../../types/model';
import { getProviders, addProvider, removeProvider, getModels, updateProvider, setDefaultProvider } from '../../services/modelRegistry';
import { verifyApiKey } from '../../services/modelService';
import { useAlert } from '../GlobalAlert';

interface ProviderListProps {
  onRefresh: () => void;
}

const ProviderList: React.FC<ProviderListProps> = ({ onRefresh }) => {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [verifyingProviderId, setVerifyingProviderId] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    loadProviders();
    setModels(getModels());
  }, []);

  const loadProviders = () => {
    setProviders(getProviders());
    setModels(getModels());
  };

  const handleAddOrUpdate = () => {
    if (!newName.trim() || !newBaseUrl.trim()) {
      showAlert('请填写供应商名称和基础 URL', { type: 'warning' });
      return;
    }

    const sanitizedBaseUrl = newBaseUrl.trim().replace(/\/+$/, '');

    if (editingProviderId) {
      // Update existing provider
      updateProvider(editingProviderId, {
        name: newName.trim(),
        baseUrl: sanitizedBaseUrl,
        apiKey: newApiKey.trim() || undefined,
      });
      showAlert('更新供应商成功', { type: 'success' });
      setEditingProviderId(null);
    } else {
      // Add new provider
      addProvider({
        name: newName.trim(),
        baseUrl: sanitizedBaseUrl,
        apiKey: newApiKey.trim() || undefined,
        isDefault: false,
      });
      showAlert('添加供应商成功', { type: 'success' });
      setIsAdding(false);
    }

    setNewName('');
    setNewBaseUrl('');
    setNewApiKey('');
    loadProviders();
    onRefresh();
  };

  const handleEdit = (provider: ModelProvider) => {
    if (editingProviderId === provider.id) {
      // 收起
      setEditingProviderId(null);
    } else {
      // 展开
      setEditingProviderId(provider.id);
      setIsAdding(false);
      setNewName(provider.name);
      setNewBaseUrl(provider.baseUrl);
      setNewApiKey(provider.apiKey || '');
    }
  };

  const cancelEditOrAdd = () => {
    setIsAdding(false);
    setEditingProviderId(null);
    setNewName('');
    setNewBaseUrl('');
    setNewApiKey('');
  };

  const handleDelete = (provider: ModelProvider) => {
    if (provider.isBuiltIn) {
      showAlert('内置供应商无法删除', { type: 'error' });
      return;
    }

    showAlert(`确定要删除供应商「${provider.name}」吗？`, {
      type: 'warning',
      showCancel: true,
      onConfirm: () => {
        if (removeProvider(provider.id)) {
          loadProviders();
          onRefresh();
          showAlert('已删除供应商', { type: 'success' });
        } else {
          showAlert('无法删除：该供应商下可能仍有模型，请先删除关联模型', { type: 'error' });
        }
      }
    });
  };

  const handleSetDefault = (provider: ModelProvider) => {
    if (setDefaultProvider(provider.id)) {
      loadProviders();
      onRefresh();
      showAlert(`已将 ${provider.name} 设为默认供应商`, { type: 'success' });
    }
  };

  const handleVerifyProviderKey = async (e: React.MouseEvent, provider: ModelProvider) => {
    e.stopPropagation();

    // 只验证提供商专属 Key，如果需求是要回退全局则加上 globalKey
    // 但用户说"如果供应商中没有配置key则是未激活状态"，所以这里直接用 provider.apiKey
    const keyToVerify = provider.apiKey;
    if (!keyToVerify) {
      showAlert('未配置供应商专属 Key，无法验证', { type: 'error' });
      return;
    }

    setVerifyingProviderId(provider.id);
    try {
      const result = await verifyApiKey(keyToVerify, provider.baseUrl);
      if (result.success) {
        showAlert(`${provider.name} Key 验证成功`, { type: 'success' });
      } else {
        showAlert(`验证失败: ${result.message}`, { type: 'error' });
      }
    } catch (error: any) {
      showAlert(`验证异常: ${error.message}`, { type: 'error' });
    } finally {
      setVerifyingProviderId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--accent-text)]" />
          <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
            模型供应商
          </label>
        </div>
        {!isAdding && (
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingProviderId(null);
              setNewName('');
              setNewBaseUrl('');
              setNewApiKey('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-[var(--text-primary)] text-[10px] font-bold rounded hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加供应商
          </button>
        )}
      </div>

      {isAdding && (
        <div className="p-4 bg-[var(--bg-elevated)]/50 border border-[var(--border-primary)] rounded-lg space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[var(--text-primary)]">
              添加新供应商
            </h4>
            <button
              onClick={cancelEditOrAdd}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">供应商名称 *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：OpenAI 官方"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">基础 URL *</label>
              <input
                type="text"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                placeholder="如：https://api.openai.com"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API Key（可选）</label>
              <input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="留空则使用全局 API Key"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
              />
              <p className="text-[9px] text-[var(--text-muted)] mt-1">为此供应商下的所有模型设置默认 API Key</p>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={cancelEditOrAdd}
                className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-secondary)] text-xs font-bold rounded hover:bg-[var(--bg-hover)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddOrUpdate}
                className="px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                保存供应商
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {providers.map((provider) => {
          const usedModelsCount = models.filter(m => m.providerId === provider.id).length;

          return (
          <div key={provider.id} className={`border rounded-lg flex flex-col transition-all ${provider.isDefault ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'bg-[var(--bg-surface)] border-[var(--border-primary)]'}`}>
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{provider.name}</h4>
                  {provider.isBuiltIn && (
                    <span className="px-1.5 py-0.5 bg-[var(--bg-hover)] text-[var(--text-muted)] text-[9px] rounded uppercase font-mono">内置</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-mono truncate mb-2">{provider.baseUrl}</p>

                <div className="flex items-center gap-3">
                  {provider.apiKey ? (
                    <span className="text-[10px] text-[var(--success)] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      已配置专属 Key
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--text-tertiary)]">未配置专属 Key</span>
                  )}

                  <span className={`text-[10px] ${usedModelsCount > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    关联了 {usedModelsCount} 个模型
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 验证 Key 按钮 */}
                <button
                  onClick={(e) => handleVerifyProviderKey(e, provider)}
                  disabled={!provider.apiKey || verifyingProviderId === provider.id}
                  className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-colors border ${
                    !provider.apiKey
                      ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-transparent cursor-not-allowed opacity-60'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                  }`}
                  title={!provider.apiKey ? '未配置专属 Key，无法验证' : '验证 API Key'}
                >
                  {verifyingProviderId === provider.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                  验证
                </button>

                {/* 使用此供应商按钮 */}
                {!provider.isDefault && (
                  <button
                    onClick={() => handleSetDefault(provider)}
                    className="px-2.5 py-1 bg-[var(--accent)] text-[var(--text-primary)] text-[10px] font-bold rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1"
                    title="设为默认供应商"
                  >
                    <Circle className="w-3 h-3" />
                    使用
                  </button>
                )}

                {/* 当前激活标记 */}
                {provider.isDefault && (
                  <span className="px-2.5 py-1 bg-[var(--accent-bg)] text-[var(--accent-text-hover)] text-[10px] font-bold rounded flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    当前使用
                  </span>
                )}

                {/* 展开/收起按钮 */}
                {!provider.isBuiltIn && (
                  <button
                    onClick={() => handleEdit(provider)}
                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors ml-2"
                    title={editingProviderId === provider.id ? '收起配置' : '编辑配置'}
                  >
                    {editingProviderId === provider.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 展开的编辑区域 */}
            {editingProviderId === provider.id && (
              <div className="px-4 pb-4 pt-0 border-t border-[var(--border-primary)] mt-2">
                <div className="pt-4 space-y-3">
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">供应商名称 *</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="如：OpenAI 官方"
                      className={`w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] ${provider.isBuiltIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={provider.isBuiltIn}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">基础 URL *</label>
                    <input
                      type="text"
                      value={newBaseUrl}
                      onChange={(e) => setNewBaseUrl(e.target.value)}
                      placeholder="如：https://api.openai.com"
                      className={`w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono ${provider.isBuiltIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={provider.isBuiltIn}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API Key（可选）</label>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="设置专属 API Key"
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                    />
                    <p className="text-[9px] text-[var(--text-muted)] mt-1">为此供应商下的所有模型设置默认 API Key</p>
                  </div>

                  <div className="pt-3 flex justify-between items-center">
                    {provider.isBuiltIn ? (
                      <div className="text-[var(--text-muted)] text-[10px]">内置供应商不可删除和修改基础配置</div>
                    ) : (
                      <button
                        onClick={() => handleDelete(provider)}
                        className="text-[var(--error-text)] hover:text-[var(--error-text)]/80 text-xs flex items-center gap-1.5 transition-colors"
                        title="删除供应商"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    )}

                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={cancelEditOrAdd}
                        className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-secondary)] text-xs font-bold rounded hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddOrUpdate}
                        className="px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        保存配置
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )})}
      </div>

      {/* 底部文案 */}
      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
        管理支持自定义模型的 API 接口地址
      </p>
    </div>
  );
};

export default ProviderList;
