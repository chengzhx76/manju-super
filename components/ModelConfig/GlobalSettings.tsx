/**
 * 全局配置组件
 * 包含 API Key 配置
 */

import React from 'react';
import ProviderList from './ProviderList';

interface GlobalSettingsProps {
  onRefresh: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onRefresh }) => {
  return (
    <div className="space-y-6">
      {/* 供应商配置 */}
      <ProviderList onRefresh={onRefresh} />

      {/* 提示 */}
      <div className="p-4 bg-[var(--bg-elevated)]/50 rounded-lg border border-[var(--border-primary)]">
        <h4 className="text-xs font-bold text-[var(--text-tertiary)] mb-2">配置说明</h4>
        <ul className="text-[10px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
          <li>你可以在各模型类别中调整模型参数（温度、Token 等）</li>
          <li>支持添加自定义模型，使用其他 API 服务</li>
          <li>所有配置仅保存在本地浏览器，不会上传到服务器</li>
        </ul>
      </div>
    </div>
  );
};

export default GlobalSettings;
