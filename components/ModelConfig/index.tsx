/**
 * 模型配置弹窗
 * 独立的模型管理界面
 */

import React, { useRef, useState, useEffect } from 'react';
import { X, Settings, MessageSquare, Image, Video, Mic, Key, ExternalLink, Gift, Sparkles, Download, Upload, Server } from 'lucide-react';
import { ModelType, ModelDefinition, ModelRegistryState } from '../../types/model';
import {
  getRegistryState,
  getModels,
  getActiveModelsConfig,
  setActiveModel,
  updateModel,
  registerModel,
  removeModel,
  saveRegistry
} from '../../services/modelRegistry';
import { verifyApiKey } from '../../services/modelService';
import ModelList from './ModelList';
import GlobalSettings from './GlobalSettings';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'global' | 'chat' | 'image' | 'video' | 'audio';

const ModelConfigModal: React.FC<ModelConfigModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [refreshKey, setRefreshKey] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerDownOutsideRef = useRef(false);

  const refresh = () => setRefreshKey(k => k + 1);

  const handleExport = () => {
    const state = getRegistryState();
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `bigbanana_model_config_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json === 'object' && Array.isArray(json.models) && Array.isArray(json.providers)) {
          saveRegistry(json as ModelRegistryState);
          refresh();
          alert('配置导入成功！页面将刷新以应用新配置。');
          window.location.reload();
        } else {
          alert('导入失败：无效的配置文件格式。');
        }
      } catch (err) {
        alert('导入失败：解析 JSON 文件出错。');
        console.error(err);
      }
    };
    reader.readAsText(file);
    // 重置 input 值，允许重复导入同一个文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'global', label: '全局配置', icon: <Key className="w-4 h-4" /> },
    { id: 'chat', label: '对话模型', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'image', label: '图片模型', icon: <Image className="w-4 h-4" /> },
    { id: 'video', label: '视频模型', icon: <Video className="w-4 h-4" /> },
    { id: 'audio', label: '配音模型', icon: <Mic className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onPointerDown={(e) => {
        // 仅当按下发生在弹窗外部时，才允许后续抬起关闭。
        const targetNode = e.target as Node;
        pointerDownOutsideRef.current = modalRef.current ? !modalRef.current.contains(targetNode) : true;
      }}
      onPointerUp={(e) => {
        // 避免在弹窗内选中文本/拖拽到外部抬起时误触发关闭
        if (!pointerDownOutsideRef.current) return;
        const targetNode = e.target as Node;
        const isOutside = modalRef.current ? !modalRef.current.contains(targetNode) : true;
        pointerDownOutsideRef.current = false;
        if (isOutside) onClose();
      }}
      onPointerCancel={() => {
        pointerDownOutsideRef.current = false;
      }}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm" />

      {/* 弹窗 */}
      <div
        className="relative z-10 w-full max-w-2xl mx-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[85vh] flex flex-col"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center">
              <Settings className="w-5 h-5 text-[var(--accent-text)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">模型配置</h2>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest font-mono">MODEL CONFIGURATION</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors rounded-full hover:bg-[var(--bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-[var(--border-subtle)] flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border-b-2 ${
                activeTab === tab.id
                  ? 'text-[var(--text-primary)] border-[var(--accent)] bg-[var(--bg-elevated)]/30'
                  : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6" key={refreshKey}>
          {activeTab === 'global' ? (
            <GlobalSettings onRefresh={refresh} />
          ) : (
            <ModelList
              type={activeTab as ModelType}
              onRefresh={refresh}
            />
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-sunken)] rounded-b-xl flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-xs font-bold rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
              title="导出所有模型配置"
            >
              <Download className="w-3.5 h-3.5" />
              导出配置
            </button>
            <button
              onClick={handleImport}
              className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-xs font-bold rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
              title="导入模型配置"
            >
              <Upload className="w-3.5 h-3.5" />
              导入配置
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <p className="text-[10px] text-[var(--text-muted)] font-mono ml-2 hidden sm:block">
              配置仅保存在本地浏览器
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-xs font-bold rounded-lg hover:bg-[var(--btn-primary-hover)] transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelConfigModal;
