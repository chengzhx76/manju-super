import React, { useEffect, useState } from 'react'
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Key,
  Loader2,
  RotateCcw
} from 'lucide-react'
import {
  getVolcengineTosConfig,
  setVolcengineTosConfig
} from '../../services/modelRegistry'
import { verifyVolcengineTosConfigByGetObject } from '../../services/assetRelayService'
import { useAlert } from '../GlobalAlert'

interface ObjectStorageSettingsProps {
  onRefresh: () => void
}

const ObjectStorageSettings: React.FC<ObjectStorageSettingsProps> = ({
  onRefresh
}) => {
  const [region, setRegion] = useState('')
  const [bucketName, setBucketName] = useState('')
  const [host, setHost] = useState('')
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const { showAlert } = useAlert()

  const loadConfig = () => {
    const config = getVolcengineTosConfig()
    setRegion(config.region || '')
    setBucketName(config.bucketName || '')
    setHost(config.host || '')
    setAccessKeyId(config.accessKeyId || '')
    setSecretAccessKey(config.secretAccessKey || '')
  }

  const updateExpanded = (next: boolean) => {
    setIsExpanded(next)
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleSave = () => {
    const normalizedRegion = region.trim()
    const normalizedBucketName = bucketName.trim()
    const normalizedHost = host.trim().replace(/\/+$/, '')
    const normalizedAccessKeyId = accessKeyId.trim()
    const normalizedSecretAccessKey = secretAccessKey.trim()

    const filledCount = [
      normalizedRegion,
      normalizedBucketName,
      normalizedHost,
      normalizedAccessKeyId,
      normalizedSecretAccessKey
    ].filter(Boolean).length
    if (filledCount > 0 && filledCount < 5) {
      showAlert('对象存储配置需全部填写或全部清空', { type: 'warning' })
      return
    }

    setVolcengineTosConfig({
      region: normalizedRegion,
      bucketName: normalizedBucketName,
      host: normalizedHost,
      accessKeyId: normalizedAccessKeyId,
      secretAccessKey: normalizedSecretAccessKey
    })
    showAlert(filledCount === 5 ? '对象存储配置已保存' : '对象存储配置已清空', {
      type: 'success'
    })
    updateExpanded(false)
    onRefresh()
  }

  const handleReset = () => {
    loadConfig()
    showAlert('已恢复为最近保存的对象存储配置', { type: 'success' })
  }

  const maskAccessKey = (value: string): string => {
    if (!value) return '未配置'
    if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`
    return `${value.slice(0, 4)}***${value.slice(-4)}`
  }

  const getDisplayName = (): string => {
    if (!host) return '对象存储'
    try {
      const parsed = new URL(host)
      return parsed.hostname || host
    } catch {
      return host
    }
  }

  const handleVerify = async () => {
    const config = {
      region: region.trim(),
      bucketName: bucketName.trim(),
      host: host.trim().replace(/\/+$/, ''),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim()
    }
    if (
      !config.region ||
      !config.bucketName ||
      !config.host ||
      !config.accessKeyId ||
      !config.secretAccessKey
    ) {
      showAlert('请先完整填写对象存储配置后再验证', { type: 'warning' })
      return
    }
    setIsVerifying(true)
    try {
      const result = await verifyVolcengineTosConfigByGetObject(config)
      showAlert(result.message, { type: 'success' })
    } catch (error) {
      showAlert(
        `验证失败：${error instanceof Error ? error.message : '未知错误'}`,
        { type: 'error' }
      )
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-4 h-4 text-[var(--accent-text)]" />
        <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
          对象存储配置
        </label>
      </div>

      <div className="border rounded-lg flex flex-col transition-all border-[var(--accent-border)] bg-[var(--accent-bg)]">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-[var(--text-tertiary)]" />
              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                {getDisplayName()}
              </h4>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono truncate mb-2">
              {host || '未配置 host'}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--text-tertiary)]">
                access_key: {maskAccessKey(accessKeyId)}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                secret_key: {secretAccessKey ? '已配置' : '未配置'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-colors border ${
                isVerifying
                  ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-transparent cursor-not-allowed opacity-60'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
              }`}
              title="验证配置"
            >
              {isVerifying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Key className="w-3 h-3" />
              )}
              验证
            </button>
            <span className="px-2.5 py-1 bg-[var(--accent-bg)] text-[var(--accent-text-hover)] text-[10px] font-bold rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              当前使用
            </span>
            <button
              onClick={() => updateExpanded(!isExpanded)}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors ml-2"
              title={isExpanded ? '收起配置' : '编辑配置'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 pt-0 border-t border-[var(--border-primary)] mt-2">
            <div className="pt-4 space-y-3">
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                  区域
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="如：cn-beijing"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                  桶名称
                </label>
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="如：my-bucket"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                  主机名或地址
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="如：https://cdn.example.com or tos-cn-beijing.volces.com"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                  访问KEY
                </label>
                <input
                  type="text"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="对象存储 AccessKeyId"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                  密钥
                </label>
                <input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder="对象存储 SecretAccessKey"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-secondary)] text-xs font-bold rounded hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  恢复
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  保存配置
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
        独立管理火山引擎对象存储参数；留空时会回退到非对象存储链路
      </p>
    </div>
  )
}

export default ObjectStorageSettings
