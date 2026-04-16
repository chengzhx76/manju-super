export type AccountTab = 'overview' | 'billing' | 'tokens' | 'logs'

export type LogView = 'usage' | 'tasks'

export interface LoginFormState {
  username: string
  password: string
  twoFactorCode: string
}

export interface RegisterFormState {
  username: string
  email: string
  verificationCode: string
  password: string
  confirmPassword: string
  affCode: string
}

export interface TokenFormState {
  name: string
  unlimitedQuota: boolean
  creditsLimit: string
  expiredAt: string
}
