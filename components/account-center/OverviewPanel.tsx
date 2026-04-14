import React from 'react';
import { Activity, CreditCard, Key, Loader2, RefreshCcw } from 'lucide-react';
import { NewApiSession, NewApiStatus } from '../../services/newApiService';
import { AccountTab } from './types';
import { formatQuotaInUsd } from './utils';
import { SectionCard, StatCard } from './ui';

interface OverviewPanelProps {
  status: NewApiStatus | null;
  session: NewApiSession;
  walletLoading: boolean;
  onRefreshProfile: () => Promise<void>;
  onTabChange: (tab: AccountTab) => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  status,
  session,
  walletLoading,
  onRefreshProfile,
  onTabChange,
}) => {
  const user = session.user;

  return (
    <div className="space-y-6">
      <SectionCard
        title="账号总览"
        description="把最常用的信息和动作放在第一屏，进入页面先看到余额和下一步。"
        action={(
          <button
            onClick={() => void onRefreshProfile()}
            disabled={walletLoading}
            className="flex items-center gap-2 px-4 py-3 border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors disabled:opacity-60"
          >
            {walletLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            <span className="font-medium text-xs tracking-widest uppercase">刷新账户</span>
          </button>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="当前余额" value={formatQuotaInUsd(user?.quota, status)} valueClassName="break-all" hint="用于当前账号可消费额度" />
          <StatCard label="累计消耗" value={formatQuotaInUsd(user?.used_quota, status)} valueClassName="break-all" hint="便于快速判断最近使用情况" />
          <StatCard label="请求次数" value={user?.request_count ?? 0} hint="来自当前账号累计调用记录" />
          <StatCard label="用户组" value={user?.group || '默认分组'} valueClassName="break-words" hint="决定当前账号可用的资源池与权限范围" />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="快捷动作" description="高频动作不需要再下翻整页寻找。">
          <div className="grid gap-4 md:grid-cols-3">
            <button onClick={() => onTabChange('billing')} className="p-4 border border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left">
              <div className="flex items-center gap-2 text-[var(--text-primary)] text-sm font-bold">
                <CreditCard className="w-4 h-4 text-[var(--accent-text)]" />
                去充值
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-2">余额不足时直接进入充值与兑换模块</div>
            </button>
            <button onClick={() => onTabChange('tokens')} className="p-4 border border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left">
              <div className="flex items-center gap-2 text-[var(--text-primary)] text-sm font-bold">
                <Key className="w-4 h-4 text-[var(--accent-text)]" />
                管理令牌
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-2">创建新密钥或一键回填到当前项目</div>
            </button>
            <button onClick={() => onTabChange('logs')} className="p-4 border border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left">
              <div className="flex items-center gap-2 text-[var(--text-primary)] text-sm font-bold">
                <Activity className="w-4 h-4 text-[var(--accent-text)]" />
                查看日志
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-2">快速定位消费、错误和模型使用情况</div>
            </button>
          </div>
        </SectionCard>

        <SectionCard title="账号信息" description="只保留用户真正关心的账号资料，不展示后台接入细节。">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2"><span className="text-[10px] font-mono uppercase tracking-widest">用户名</span></div>
              <div className="break-words text-2xl font-light text-[var(--text-primary)]">{user?.display_name || session.username}</div>
              <div className="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono leading-relaxed">登录后在当前站点内直接管理账户能力</div>
            </div>
            <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2"><span className="text-[10px] font-mono uppercase tracking-widest">邮箱</span></div>
              <div className="break-all text-2xl font-light text-[var(--text-primary)]">{user?.email || '未绑定邮箱'}</div>
              <div className="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono leading-relaxed">用于注册验证、找回密码或接收通知</div>
            </div>
            <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2"><span className="text-[10px] font-mono uppercase tracking-widest">邀请码</span></div>
              <div className="break-all text-2xl font-light text-[var(--text-primary)]">{user?.aff_code || '未生成'}</div>
              <div className="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono leading-relaxed">可用于邀请协作者或参与平台活动</div>
            </div>
            <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2"><span className="text-[10px] font-mono uppercase tracking-widest">账户状态</span></div>
              <div className="break-words text-2xl font-light text-[var(--text-primary)]">{user?.status === 1 ? '正常' : '可用'}</div>
              <div className="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono leading-relaxed">如有额度、令牌或支付异常，可先刷新账户信息</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
