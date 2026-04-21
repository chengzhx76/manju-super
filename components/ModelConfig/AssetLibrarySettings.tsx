import React, { useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Database,
  Key,
  Loader2,
  X
} from 'lucide-react'
import {
  getAssetLibraryConfig,
  getAssetLibraryConfigs,
  addAssetLibraryConfig,
  updateAssetLibraryConfig,
  removeAssetLibraryConfig,
  setDefaultAssetLibraryConfig
} from '../../services/modelRegistry'
import { verifyRelayConfigByListAssetGroups } from '../../services/assetRelayService'
import { useAlert } from '../GlobalAlert'
import { AssetLibraryConfig } from '../../types/model'

interface AssetLibrarySettingsProps {
  onRefresh: () => void
}

const AssetLibrarySettings: React.FC<AssetLibrarySettingsProps> = ({
  onRefresh
}) => {
  const [configs, setConfigs] = useState<AssetLibraryConfig[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [verifyingConfigId, setVerifyingConfigId] = useState<string | null>(
    null
  )
  const { showAlert } = useAlert()

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = () => {
    const currentConfig = getAssetLibraryConfig()
    const allConfigs = getAssetLibraryConfigs()
    const normalizedConfigs =
      allConfigs.length > 0
        ? allConfigs
        : currentConfig.address
          ? [currentConfig]
          : []
    setConfigs(normalizedConfigs)
  }

  const resetForm = () => {
    setAddress('')
    setAccessKey('')
    setSecretKey('')
  }

  const cancelEditOrAdd = () => {
    setIsAdding(false)
    setEditingConfigId(null)
    resetForm()
  }

  const handleAddOrUpdate = () => {
    const normalizedAddress = address.trim().replace(/\/+$/, '')
    const normalizedAccessKey = accessKey.trim()
    const normalizedSecretKey = secretKey.trim()
    if (!normalizedAddress || !normalizedAccessKey || !normalizedSecretKey) {
      showAlert('素材库配置需完整填写地址、access_key 和 secret_key', {
        type: 'warning'
      })
      return
    }

    if (editingConfigId) {
      const ok = updateAssetLibraryConfig(editingConfigId, {
        address: normalizedAddress,
        access_key: normalizedAccessKey,
        secret_key: normalizedSecretKey
      })
      if (!ok) {
        showAlert('更新素材库配置失败：未找到对应配置', { type: 'error' })
        return
      }
      showAlert('素材库配置已更新', { type: 'success' })
      setEditingConfigId(null)
    } else {
      addAssetLibraryConfig({
        address: normalizedAddress,
        access_key: normalizedAccessKey,
        secret_key: normalizedSecretKey
      })
      showAlert('素材库配置已添加', { type: 'success' })
      setIsAdding(false)
    }

    resetForm()
    loadConfigs()
    onRefresh()
  }

  const handleEdit = (config: AssetLibraryConfig) => {
    if (editingConfigId === config.id) {
      setEditingConfigId(null)
      resetForm()
      return
    }
    setIsAdding(false)
    setEditingConfigId(config.id)
    setAddress(config.address || config.host || '')
    setAccessKey(config.access_key || config.accessKeyId || '')
    setSecretKey(config.secret_key || config.secretAccessKey || '')
  }

  const handleDelete = (config: AssetLibraryConfig) => {
    const displayName = getDisplayName(config, 0)
    showAlert(`确定要删除素材库配置「${displayName}」吗？`, {
      type: 'warning',
      showCancel: true,
      onConfirm: () => {
        const ok = removeAssetLibraryConfig(config.id)
        if (!ok) {
          showAlert('删除失败：未找到对应配置', { type: 'error' })
          return
        }
        if (editingConfigId === config.id) {
          setEditingConfigId(null)
          resetForm()
        }
        loadConfigs()
        onRefresh()
        showAlert('已删除素材库配置', { type: 'success' })
      }
    })
  }

  const handleSetDefault = (config: AssetLibraryConfig) => {
    if (config.isDefault) return
    const ok = setDefaultAssetLibraryConfig(config.id)
    if (!ok) {
      showAlert('设置当前使用失败：未找到对应配置', { type: 'error' })
      return
    }
    loadConfigs()
    onRefresh()
    showAlert('已切换当前使用的素材库配置', { type: 'success' })
  }

  const handleVerify = async (config: AssetLibraryConfig) => {
    const normalizedAddress = config.address.trim().replace(/\/+$/, '')
    const normalizedAccessKey = config.access_key.trim()
    const normalizedSecretKey = config.secret_key.trim()

    if (!normalizedAddress || !normalizedAccessKey || !normalizedSecretKey) {
      showAlert('请先完整填写地址、access_key 和 secret_key 后再验证', {
        type: 'warning'
      })
      return
    }

    setVerifyingConfigId(config.id)
    try {
      let isValidUrl = true
      try {
        const url = new URL(normalizedAddress)
        isValidUrl = !!url.protocol && !!url.host
      } catch {
        isValidUrl = false
      }

      await new Promise((resolve) => setTimeout(resolve, 350))

      if (!isValidUrl) {
        showAlert('验证失败：地址格式不正确，请输入完整 URL', {
          type: 'error'
        })
        return
      }

      await verifyRelayConfigByListAssetGroups({
        ...config,
        address: normalizedAddress,
        access_key: normalizedAccessKey,
        secret_key: normalizedSecretKey
      })
      showAlert('验证通过：ListAssetGroups 返回 200', { type: 'success' })
    } catch (error) {
      showAlert(
        `验证失败：${error instanceof Error ? error.message : '未知错误'}`,
        { type: 'error' }
      )
    } finally {
      setVerifyingConfigId(null)
    }
  }

  const maskAccessKey = (value: string): string => {
    if (!value) return '未配置'
    if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`
    return `${value.slice(0, 4)}***${value.slice(-4)}`
  }

  const getDisplayName = (
    config: AssetLibraryConfig,
    index: number
  ): string => {
    const rawAddress = config.address
    if (!rawAddress) return `素材库 ${index + 1}`
    try {
      const url = new URL(rawAddress)
      return url.hostname || `素材库 ${index + 1}`
    } catch {
      return rawAddress
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[var(--accent-text)]" />
          <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
            素材库配置
          </label>
        </div>
        {!isAdding && (
          <button
            onClick={() => {
              setIsAdding(true)
              setEditingConfigId(null)
              resetForm()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-[var(--text-primary)] text-[10px] font-bold rounded hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加素材库
          </button>
        )}
      </div>

      {isAdding && (
        <div className="p-4 bg-[var(--bg-elevated)]/50 border border-[var(--border-primary)] rounded-lg space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[var(--text-primary)]">
              添加素材库配置
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
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                地址 *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="如：https://example.com"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                access_key *
              </label>
              <input
                type="text"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="素材库 access_key"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                secret_key *
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="素材库 secret_key"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
              />
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
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {configs.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-surface)]/50 px-4 py-5">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Database className="w-4 h-4 text-[var(--text-tertiary)]" />
              <span className="text-xs font-medium">暂无素材库配置</span>
            </div>
            <div className="mt-2 pl-6">
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                还没有数据，请点击右上角“添加素材库”进行配置
              </p>
            </div>
          </div>
        )}

        {configs.map((config, index) => (
          <div
            key={config.id}
            className={`border rounded-lg flex flex-col transition-all ${config.isDefault ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'bg-[var(--bg-surface)] border-[var(--border-primary)]'}`}
          >
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                    {getDisplayName(config, index)}
                  </h4>
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-mono truncate mb-2">
                  {config.address || '未配置地址'}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    access_key: {maskAccessKey(config.access_key)}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    secret_key: {config.secret_key ? '已配置' : '未配置'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVerify(config)}
                  disabled={
                    !config.address ||
                    !config.access_key ||
                    !config.secret_key ||
                    verifyingConfigId === config.id
                  }
                  className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-colors border ${
                    !config.address || !config.access_key || !config.secret_key
                      ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-transparent cursor-not-allowed opacity-60'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                  }`}
                  title={
                    !config.address || !config.access_key || !config.secret_key
                      ? '请先完整填写配置后再验证'
                      : '验证配置'
                  }
                >
                  {verifyingConfigId === config.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Key className="w-3 h-3" />
                  )}
                  验证
                </button>

                {!config.isDefault ? (
                  <button
                    onClick={() => handleSetDefault(config)}
                    className="px-2.5 py-1 bg-[var(--accent)] text-[var(--text-primary)] text-[10px] font-bold rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1"
                    title="设为当前使用"
                  >
                    <Circle className="w-3 h-3" />
                    使用
                  </button>
                ) : (
                  <span className="px-2.5 py-1 bg-[var(--accent-bg)] text-[var(--accent-text-hover)] text-[10px] font-bold rounded flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    当前使用
                  </span>
                )}

                <button
                  onClick={() => handleEdit(config)}
                  className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors ml-2"
                  title={
                    editingConfigId === config.id ? '收起配置' : '编辑配置'
                  }
                >
                  {editingConfigId === config.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {editingConfigId === config.id && (
              <div className="px-4 pb-4 pt-0 border-t border-[var(--border-primary)] mt-2">
                <div className="pt-4 space-y-3">
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                      地址 *
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="如：https://example.com"
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                      access_key *
                    </label>
                    <input
                      type="text"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      placeholder="素材库 access_key"
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                      secret_key *
                    </label>
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="素材库 secret_key"
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                    />
                  </div>

                  <div className="pt-3 flex justify-between items-center">
                    <button
                      onClick={() => handleDelete(config)}
                      className="text-[var(--error-text)] hover:text-[var(--error-text)]/80 text-xs flex items-center gap-1.5 transition-colors"
                      title="删除素材库配置"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
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
        ))}
      </div>

      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
        管理素材库 API 地址和访问凭证
      </p>
    </div>
  )
}

export default AssetLibrarySettings
