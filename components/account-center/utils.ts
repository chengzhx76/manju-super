import { NewApiPayMethod, NewApiStatus } from '../../services/newApiService';

export const TOKEN_STATUS_ENABLED = 1;
export const TOKEN_STATUS_DISABLED = 2;
export const TOKEN_STATUS_EXPIRED = 3;
export const TOKEN_STATUS_EXHAUSTED = 4;

export const formatDateTimeInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toUnixTimestamp = (value: string): number | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.floor(timestamp / 1000);
};

export const formatDateTime = (timestamp?: number) => {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleString('zh-CN', { hour12: false });
};

export const getQuotaPerUnit = (status: NewApiStatus | null) => {
  const value = Number(status?.quota_per_unit ?? 500000);
  return Number.isFinite(value) && value > 0 ? value : 500000;
};

const formatUsdCredits = (credits: number) => `$${credits.toFixed(2)}`;

export const formatQuotaInUsd = (quota: number | undefined, status: NewApiStatus | null) => {
  if (quota === undefined || quota === null) return '—';
  const credits = quota / getQuotaPerUnit(status);
  return formatUsdCredits(credits);
};

export const formatQuota = (quota: number | undefined, status: NewApiStatus | null) => {
  if (quota === undefined || quota === null) return '—';
  const credits = quota / getQuotaPerUnit(status);
  const symbol = status?.custom_currency_symbol || '$';
  const exchangeRate = Number(status?.custom_currency_exchange_rate ?? 1);

  if (status?.display_in_currency && Number.isFinite(exchangeRate) && exchangeRate > 0) {
    return `${symbol}${(credits * exchangeRate).toFixed(2)}`;
  }

  return formatUsdCredits(credits);
};

export const formatPayableAmount = (amount: number | null, status: NewApiStatus | null) => {
  if (amount === null) return '未计算';
  return `${status?.custom_currency_symbol || '￥'}${amount.toFixed(2)}`;
};

export const creditsToQuota = (credits: number, status: NewApiStatus | null) => {
  return Math.max(0, Math.round(credits * getQuotaPerUnit(status)));
};

export const maskTokenKey = (key: string) => {
  if (!key) return '—';
  if (key.length <= 8) return `sk-${key}`;
  return `sk-${key.slice(0, 4)}********${key.slice(-4)}`;
};

export const normalizePayMethods = (value: NewApiPayMethod[] | string | undefined): NewApiPayMethod[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as NewApiPayMethod[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getTokenStatusMeta = (status: number) => {
  switch (status) {
    case TOKEN_STATUS_ENABLED:
      return { label: '已启用', className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' };
    case TOKEN_STATUS_DISABLED:
      return { label: '已禁用', className: 'bg-slate-500/10 text-slate-300 border border-slate-500/30' };
    case TOKEN_STATUS_EXPIRED:
      return { label: '已过期', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' };
    case TOKEN_STATUS_EXHAUSTED:
      return { label: '已耗尽', className: 'bg-rose-500/10 text-rose-400 border border-rose-500/30' };
    default:
      return { label: '未知', className: 'bg-slate-500/10 text-slate-300 border border-slate-500/30' };
  }
};

export const submitPaymentForm = (url: string, params: Record<string, string>) => {
  const form = document.createElement('form');
  form.action = url;
  form.method = 'POST';
  form.target = '_blank';

  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};
