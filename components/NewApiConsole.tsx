import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  CreditCard,
  Key,
  Loader2,
  Power,
  RefreshCcw,
  User
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from './GlobalAlert'
import { setGlobalApiKey } from '../services/aiService'
import {
  NewApiLog,
  NewApiLogStats,
  NewApiSession,
  NewApiSubscriptionSelf,
  NewApiStatus,
  NewApiSubscriptionPlanItem,
  NewApiTask,
  NewApiToken,
  NewApiTopupInfo,
  bootstrapNewApiSession,
  clearNewApiSession,
  createNewApiToken,
  deleteNewApiToken,
  fetchNewApiStatus,
  getNewApiEndpoint,
  getNewApiLogs,
  getNewApiLogsStat,
  getNewApiSession,
  getNewApiSelf,
  getNewApiSubscriptionPlans,
  getNewApiSubscriptionSelf,
  getNewApiTasks,
  getNewApiTokens,
  getNewApiTopupInfo,
  loginNewApiUser,
  logoutNewApiUser,
  redeemNewApiCode,
  registerNewApiUser,
  requestNewApiAmount,
  requestNewApiPay,
  requestNewApiSubscriptionCreemPay,
  requestNewApiSubscriptionEpayPay,
  requestNewApiSubscriptionStripePay,
  sendNewApiVerificationCode,
  updateNewApiTokenStatus,
  verifyNewApiTwoFactor
} from '../services/newApiService'
import { AuthView } from './account-center/AuthView'
import { BillingPanel } from './account-center/BillingPanel'
import { AuthTab } from './account-center/internal'
import { LogsPanel } from './account-center/LogsPanel'
import { OverviewPanel } from './account-center/OverviewPanel'
import {
  AccountTab,
  LoginFormState,
  LogView,
  RegisterFormState,
  TokenFormState
} from './account-center/types'
import {
  creditsToQuota,
  formatDateTimeInput,
  formatQuotaInUsd,
  normalizePayMethods,
  submitPaymentForm,
  toUnixTimestamp,
  TOKEN_STATUS_DISABLED,
  TOKEN_STATUS_ENABLED
} from './account-center/utils'
import { cardClassName, SectionCard } from './account-center/ui'
import { TokensPanel } from './account-center/TokensPanel'

const createDefaultTokenForm = (): TokenFormState => ({
  name: 'BigBanana',
  unlimitedQuota: true,
  creditsLimit: '1',
  expiredAt: ''
})

const ACCOUNT_TABS = [
  {
    key: 'overview' as AccountTab,
    label: '总览',
    description: '看余额、状态和下一步动作',
    icon: User
  },
  {
    key: 'billing' as AccountTab,
    label: '充值',
    description: '充值、预估金额、兑换码',
    icon: CreditCard
  },
  {
    key: 'tokens' as AccountTab,
    label: '令牌',
    description: '创建和管理项目密钥',
    icon: Key
  },
  {
    key: 'logs' as AccountTab,
    label: '日志',
    description: '查看消费、错误与模型调用',
    icon: Activity
  }
]

const NewApiConsole: React.FC = () => {
  const navigate = useNavigate()
  const { showAlert } = useAlert()
  const activeEndpoint = getNewApiEndpoint()

  const [status, setStatus] = useState<NewApiStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [session, setSession] = useState<NewApiSession | null>(() =>
    getNewApiSession()
  )
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [activeTab, setActiveTab] = useState<AccountTab>('overview')

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    username: '',
    password: '',
    twoFactorCode: ''
  })
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    username: '',
    email: '',
    verificationCode: '',
    password: '',
    confirmPassword: '',
    affCode: ''
  })

  const [verificationLoading, setVerificationLoading] = useState(false)
  const [walletLoading, setWalletLoading] = useState(false)

  const [topupInfo, setTopupInfo] = useState<NewApiTopupInfo | null>(null)
  const [topupInfoLoading, setTopupInfoLoading] = useState(false)
  const [payableAmount, setPayableAmount] = useState<number | null>(null)
  const [topupAmount, setTopupAmount] = useState('10')
  const [redeemCode, setRedeemCode] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [subscriptionPlans, setSubscriptionPlans] = useState<
    NewApiSubscriptionPlanItem[]
  >([])
  const [subscriptionSelf, setSubscriptionSelf] =
    useState<NewApiSubscriptionSelf | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  const [tokens, setTokens] = useState<NewApiToken[]>([])
  const [tokensLoading, setTokensLoading] = useState(false)
  const [tokenPage, setTokenPage] = useState(1)
  const [tokenTotal, setTokenTotal] = useState(0)
  const [tokenPageSize] = useState(10)
  const [createTokenLoading, setCreateTokenLoading] = useState(false)
  const [tokenForm, setTokenForm] = useState<TokenFormState>(
    createDefaultTokenForm()
  )

  const defaultStart = useMemo(
    () => formatDateTimeInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    []
  )
  const defaultEnd = useMemo(() => formatDateTimeInput(new Date()), [])
  const [logView, setLogView] = useState<LogView>('usage')
  const [logType, setLogType] = useState(2)
  const [logStart, setLogStart] = useState(defaultStart)
  const [logEnd, setLogEnd] = useState(defaultEnd)
  const [logChannelId, setLogChannelId] = useState('')
  const [logTokenName, setLogTokenName] = useState('')
  const [logModelName, setLogModelName] = useState('')
  const [logs, setLogs] = useState<NewApiLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logPage, setLogPage] = useState(1)
  const [logPageSize] = useState(20)
  const [logTotal, setLogTotal] = useState(0)
  const [logStats, setLogStats] = useState<NewApiLogStats | null>(null)
  const [taskStart, setTaskStart] = useState(defaultStart)
  const [taskEnd, setTaskEnd] = useState(defaultEnd)
  const [taskTaskId, setTaskTaskId] = useState('')
  const [taskStatus, setTaskStatus] = useState('')
  const [taskPlatform, setTaskPlatform] = useState('')
  const [tasks, setTasks] = useState<NewApiTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskPage, setTaskPage] = useState(1)
  const [taskPageSize] = useState(20)
  const [taskTotal, setTaskTotal] = useState(0)

  const [profileLoaded, setProfileLoaded] = useState(false)
  const [topupLoaded, setTopupLoaded] = useState(false)
  const [tokensLoaded, setTokensLoaded] = useState(false)
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const estimateRequestIdRef = useRef(0)

  const sessionUserId = session?.userId ?? null
  const topupMethods = useMemo(
    () =>
      normalizePayMethods(topupInfo?.pay_methods).filter(
        (item) => item?.name && item?.type
      ),
    [topupInfo]
  )
  const activeSubscriptions = subscriptionSelf?.subscriptions ?? []
  const allSubscriptions = subscriptionSelf?.all_subscriptions ?? []
  const billingPreference =
    subscriptionSelf?.billing_preference ?? 'wallet_first'

  const resetWorkspaceState = useCallback(() => {
    estimateRequestIdRef.current += 1
    setTopupInfo(null)
    setPayableAmount(null)
    setTopupAmount('10')
    setRedeemCode('')
    setSelectedPaymentMethod('')
    setEstimateLoading(false)
    setEstimateError(null)
    setSubscriptionPlans([])
    setSubscriptionSelf(null)
    setSubscriptionLoading(false)
    setTokens([])
    setTokenPage(1)
    setTokenTotal(0)
    setTokenForm(createDefaultTokenForm())
    setLogs([])
    setLogPage(1)
    setLogTotal(0)
    setLogStats(null)
    setLogView('usage')
    setLogChannelId('')
    setTasks([])
    setTaskPage(1)
    setTaskTotal(0)
    setProfileLoaded(false)
    setTopupLoaded(false)
    setTokensLoaded(false)
    setLogsLoaded(false)
    setTasksLoaded(false)
    setActiveTab('overview')
  }, [])

  const loadStatusAndSession = useCallback(
    async (endpoint: string, silent = false) => {
      setStatusLoading(true)
      try {
        setStatus(await fetchNewApiStatus(endpoint))
      } catch (error) {
        setStatus(null)
        if (!silent) {
          showAlert(
            error instanceof Error ? error.message : '获取 new-api 状态失败',
            { type: 'error' }
          )
        }
      }

      try {
        setSession(await bootstrapNewApiSession(endpoint))
      } catch {
        setSession(null)
      } finally {
        setStatusLoading(false)
      }
    },
    [showAlert]
  )

  const refreshProfile = useCallback(async () => {
    setWalletLoading(true)
    try {
      const user = await getNewApiSelf(activeEndpoint)
      setSession((current) =>
        current ? { ...current, user, username: user.username } : current
      )
      setProfileLoaded(true)
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '刷新账户信息失败', {
        type: 'error'
      })
      throw error
    } finally {
      setWalletLoading(false)
    }
  }, [activeEndpoint, showAlert])

  const refreshSubscriptionSelf = useCallback(async () => {
    setSubscriptionLoading(true)
    try {
      const payload = await getNewApiSubscriptionSelf()
      setSubscriptionSelf(payload)
      return payload
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '获取订阅信息失败', {
        type: 'error'
      })
      throw error
    } finally {
      setSubscriptionLoading(false)
    }
  }, [showAlert])

  const loadTopupInfo = useCallback(async () => {
    setTopupInfoLoading(true)
    setSubscriptionLoading(true)
    try {
      const [topupInfoResult, subscriptionPlansResult, subscriptionSelfResult] =
        await Promise.allSettled([
          getNewApiTopupInfo(),
          getNewApiSubscriptionPlans(),
          getNewApiSubscriptionSelf()
        ])

      if (topupInfoResult.status === 'rejected') {
        throw topupInfoResult.reason
      }

      const info = topupInfoResult.value
      const methods = normalizePayMethods(info.pay_methods).filter(
        (item) => item?.name && item?.type
      )
      const defaultTopupMethod =
        methods.find((item) => !['stripe', 'creem'].includes(item.type))
          ?.type ||
        methods[0]?.type ||
        ''
      setTopupInfo(info)
      setSubscriptionPlans(
        subscriptionPlansResult.status === 'fulfilled'
          ? (subscriptionPlansResult.value || []).filter(
              (item) => item?.plan?.id
            )
          : []
      )
      setSubscriptionSelf(
        subscriptionSelfResult.status === 'fulfilled'
          ? subscriptionSelfResult.value
          : null
      )
      setSelectedPaymentMethod((current) => current || defaultTopupMethod)
      if ((info.amount_options?.length || 0) > 0) {
        setTopupAmount(
          (current) => current || String(info.amount_options?.[0] ?? '10')
        )
      }
      setTopupLoaded(true)
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '获取充值配置失败', {
        type: 'error'
      })
      throw error
    } finally {
      setTopupInfoLoading(false)
      setSubscriptionLoading(false)
    }
  }, [showAlert])

  const loadTokens = useCallback(
    async (page = 1) => {
      setTokensLoading(true)
      try {
        const payload = await getNewApiTokens(page, tokenPageSize)
        setTokens(payload.items || [])
        setTokenPage(payload.page || page)
        setTokenTotal(payload.total || 0)
        setTokensLoaded(true)
      } catch (error) {
        showAlert(error instanceof Error ? error.message : '获取令牌列表失败', {
          type: 'error'
        })
        throw error
      } finally {
        setTokensLoading(false)
      }
    },
    [showAlert, tokenPageSize]
  )

  const loadLogs = useCallback(
    async (page = 1) => {
      setLogsLoading(true)
      try {
        const startTimestamp = toUnixTimestamp(logStart)
        const endTimestamp = toUnixTimestamp(logEnd)
        const [pageData, statsData] = await Promise.all([
          getNewApiLogs({
            page,
            pageSize: logPageSize,
            type: logType,
            channelId: logChannelId,
            tokenName: logTokenName,
            modelName: logModelName,
            startTimestamp,
            endTimestamp
          }),
          getNewApiLogsStat({
            type: logType,
            channelId: logChannelId,
            tokenName: logTokenName,
            modelName: logModelName,
            startTimestamp,
            endTimestamp
          })
        ])
        setLogs(pageData.items || [])
        setLogPage(pageData.page || page)
        setLogTotal(pageData.total || 0)
        setLogStats(statsData)
        setLogsLoaded(true)
      } catch (error) {
        showAlert(error instanceof Error ? error.message : '获取使用日志失败', {
          type: 'error'
        })
        throw error
      } finally {
        setLogsLoading(false)
      }
    },
    [
      logChannelId,
      logEnd,
      logModelName,
      logPageSize,
      logStart,
      logTokenName,
      logType,
      showAlert
    ]
  )

  const loadTasks = useCallback(
    async (page = 1) => {
      setTasksLoading(true)
      try {
        const startTimestamp = toUnixTimestamp(taskStart)
        const endTimestamp = toUnixTimestamp(taskEnd)
        const pageData = await getNewApiTasks({
          page,
          pageSize: taskPageSize,
          taskId: taskTaskId,
          platform: taskPlatform,
          status: taskStatus,
          startTimestamp,
          endTimestamp
        })
        setTasks(pageData.items || [])
        setTaskPage(pageData.page || page)
        setTaskTotal(pageData.total || 0)
        setTasksLoaded(true)
      } catch (error) {
        showAlert(error instanceof Error ? error.message : '获取任务日志失败', {
          type: 'error'
        })
        throw error
      } finally {
        setTasksLoading(false)
      }
    },
    [
      showAlert,
      taskEnd,
      taskPageSize,
      taskPlatform,
      taskStart,
      taskStatus,
      taskTaskId
    ]
  )

  useEffect(() => {
    loadStatusAndSession(activeEndpoint, true).catch(() => undefined)
  }, [activeEndpoint, loadStatusAndSession])

  useEffect(() => {
    if (!sessionUserId) {
      resetWorkspaceState()
      return
    }
    if (!profileLoaded) {
      refreshProfile().catch(() => undefined)
      return
    }
    if (activeTab === 'billing' && !topupLoaded) {
      loadTopupInfo().catch(() => undefined)
      return
    }
    if (activeTab === 'tokens' && !tokensLoaded) {
      loadTokens(1).catch(() => undefined)
      return
    }
    if (activeTab === 'logs' && logView === 'usage' && !logsLoaded) {
      loadLogs(1).catch(() => undefined)
      return
    }
    if (activeTab === 'logs' && logView === 'tasks' && !tasksLoaded) {
      loadTasks(1).catch(() => undefined)
    }
  }, [
    sessionUserId,
    activeTab,
    logView,
    profileLoaded,
    topupLoaded,
    tokensLoaded,
    logsLoaded,
    tasksLoaded,
    refreshProfile,
    loadTopupInfo,
    loadTokens,
    loadLogs,
    loadTasks,
    resetWorkspaceState
  ])

  useEffect(() => {
    if (!sessionUserId || activeTab !== 'billing' || !topupLoaded) {
      estimateRequestIdRef.current += 1
      setEstimateLoading(false)
      return
    }

    const amountValue = Number(topupAmount)
    const requestId = estimateRequestIdRef.current + 1
    estimateRequestIdRef.current = requestId

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setEstimateLoading(false)
      setEstimateError(null)
      setPayableAmount(null)
      return
    }

    setEstimateLoading(true)
    setEstimateError(null)
    setPayableAmount(null)

    const timer = window.setTimeout(async () => {
      try {
        const estimatedAmount = await requestNewApiAmount(amountValue)
        if (estimateRequestIdRef.current !== requestId) {
          return
        }
        setPayableAmount(estimatedAmount)
      } catch {
        if (estimateRequestIdRef.current !== requestId) {
          return
        }
        setPayableAmount(null)
        setEstimateError('暂时无法获取预估金额，请以支付页显示为准。')
      } finally {
        if (estimateRequestIdRef.current === requestId) {
          setEstimateLoading(false)
        }
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [activeTab, sessionUserId, topupAmount, topupLoaded])

  const handleLogin = async () => {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      showAlert('请输入用户名和密码。', { type: 'warning' })
      return
    }
    if (status?.turnstile_check) {
      showAlert(
        '当前账号系统启用了额外安全验证，本页暂不支持，请联系管理员处理。',
        { type: 'warning' }
      )
      return
    }
    setAuthLoading(true)
    try {
      const result = await loginNewApiUser(
        { username: loginForm.username.trim(), password: loginForm.password },
        activeEndpoint
      )
      if (result.requireTwoFactor) {
        setNeedsTwoFactor(true)
        showAlert('该账号开启了 2FA，请继续输入一次性验证码。', {
          type: 'info'
        })
        return
      }
      resetWorkspaceState()
      setNeedsTwoFactor(false)
      setSession(result.session || null)
      showAlert('登录成功。', { type: 'success' })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '登录失败', {
        type: 'error'
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyTwoFactor = async () => {
    if (!loginForm.twoFactorCode.trim()) {
      showAlert('请输入 2FA 验证码。', { type: 'warning' })
      return
    }
    setAuthLoading(true)
    try {
      const result = await verifyNewApiTwoFactor(
        loginForm.twoFactorCode.trim(),
        activeEndpoint
      )
      resetWorkspaceState()
      setNeedsTwoFactor(false)
      setSession(result.session || null)
      showAlert('登录成功。', { type: 'success' })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '2FA 校验失败', {
        type: 'error'
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!registerForm.username.trim()) {
      showAlert('请输入用户名。', { type: 'warning' })
      return
    }
    if (registerForm.password.length < 8) {
      showAlert('密码长度至少 8 位。', { type: 'warning' })
      return
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      showAlert('两次输入的密码不一致。', { type: 'warning' })
      return
    }
    if (
      status?.email_verification &&
      (!registerForm.email.trim() || !registerForm.verificationCode.trim())
    ) {
      showAlert('当前注册流程需要邮箱验证，请填写邮箱和验证码。', {
        type: 'warning'
      })
      return
    }
    if (status?.turnstile_check) {
      showAlert(
        '当前账号系统启用了额外安全验证，本页暂不支持，请联系管理员处理。',
        { type: 'warning' }
      )
      return
    }
    setAuthLoading(true)
    try {
      await registerNewApiUser(
        {
          username: registerForm.username.trim(),
          password: registerForm.password,
          email: registerForm.email.trim() || undefined,
          verification_code: registerForm.verificationCode.trim() || undefined,
          aff_code: registerForm.affCode.trim() || undefined
        },
        activeEndpoint
      )
      setAuthTab('login')
      setLoginForm((current) => ({
        ...current,
        username: registerForm.username.trim(),
        password: ''
      }))
      showAlert('注册成功，请直接登录。', { type: 'success' })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '注册失败', {
        type: 'error'
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSendVerificationCode = async () => {
    if (!registerForm.email.trim()) {
      showAlert('请先填写邮箱地址。', { type: 'warning' })
      return
    }
    if (status?.turnstile_check) {
      showAlert(
        '当前账号系统启用了额外安全验证，本页暂不支持发送验证码，请联系管理员处理。',
        { type: 'warning' }
      )
      return
    }
    setVerificationLoading(true)
    try {
      await sendNewApiVerificationCode(
        registerForm.email.trim(),
        activeEndpoint
      )
      showAlert('验证码已发送，请检查邮箱。', { type: 'success' })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '验证码发送失败', {
        type: 'error'
      })
    } finally {
      setVerificationLoading(false)
    }
  }

  const handleLogout = async () => {
    setAuthLoading(true)
    try {
      await logoutNewApiUser()
      clearNewApiSession()
      resetWorkspaceState()
      setNeedsTwoFactor(false)
      setSession(null)
      showAlert('已退出登录。', { type: 'success' })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '退出登录失败', {
        type: 'error'
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleOnlinePay = async () => {
    const amountValue = Number(topupAmount)
    if (!selectedPaymentMethod) {
      showAlert('请选择支付方式。', { type: 'warning' })
      return
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showAlert('请输入正确的充值数量。', { type: 'warning' })
      return
    }
    setPaymentLoading(true)
    try {
      const { url, params } = await requestNewApiPay(
        amountValue,
        selectedPaymentMethod
      )
      if (!url) throw new Error('支付链接为空')
      submitPaymentForm(url, params)
      showAlert('支付页面已在新窗口中拉起。支付完成后可点击刷新余额。', {
        type: 'success'
      })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '拉起支付失败', {
        type: 'error'
      })
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleSubscriptionPay = async (
    planId: number,
    paymentMethod: string
  ) => {
    if (!planId) {
      showAlert('订阅套餐配置不完整。', { type: 'warning' })
      return
    }

    setPaymentLoading(true)
    try {
      if (paymentMethod === 'stripe') {
        const { pay_link } = await requestNewApiSubscriptionStripePay(planId)
        if (!pay_link) throw new Error('Stripe 支付链接为空')
        window.open(pay_link, '_blank', 'noopener,noreferrer')
      } else if (paymentMethod === 'creem') {
        const { checkout_url } = await requestNewApiSubscriptionCreemPay(planId)
        if (!checkout_url) throw new Error('Creem 支付链接为空')
        window.open(checkout_url, '_blank', 'noopener,noreferrer')
      } else {
        const { url, params } = await requestNewApiSubscriptionEpayPay(
          planId,
          paymentMethod
        )
        if (!url) throw new Error('支付链接为空')
        submitPaymentForm(url, params)
      }

      showAlert('订阅支付页面已在新窗口中拉起。', { type: 'success' })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '拉起订阅支付失败', {
        type: 'error'
      })
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleRedeemCode = async () => {
    if (!redeemCode.trim()) {
      showAlert('请输入兑换码。', { type: 'warning' })
      return
    }
    setPaymentLoading(true)
    try {
      const quota = await redeemNewApiCode(redeemCode.trim())
      setRedeemCode('')
      await refreshProfile()
      showAlert(`兑换成功，到账额度：${formatQuotaInUsd(quota, status)}。`, {
        type: 'success'
      })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '兑换失败', {
        type: 'error'
      })
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleCreateToken = async (): Promise<boolean> => {
    if (!tokenForm.name.trim()) {
      showAlert('请输入令牌名称。', { type: 'warning' })
      return false
    }
    const creditsLimit = Number(tokenForm.creditsLimit || '0')
    if (
      !tokenForm.unlimitedQuota &&
      (!Number.isFinite(creditsLimit) || creditsLimit < 0)
    ) {
      showAlert('请输入正确的额度上限。', { type: 'warning' })
      return false
    }
    setCreateTokenLoading(true)
    try {
      await createNewApiToken({
        name: tokenForm.name.trim(),
        unlimited_quota: tokenForm.unlimitedQuota,
        remain_quota: tokenForm.unlimitedQuota
          ? 0
          : creditsToQuota(creditsLimit, status),
        expired_time: tokenForm.expiredAt
          ? Math.floor(Date.parse(tokenForm.expiredAt) / 1000)
          : -1
      })
      await loadTokens(1)
      setTokenForm(createDefaultTokenForm())
      showAlert('令牌已创建，请在列表中复制或直接设为当前创作 Key。', {
        type: 'success'
      })
      return true
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '创建令牌失败', {
        type: 'error'
      })
      return false
    } finally {
      setCreateTokenLoading(false)
    }
  }

  const handleToggleToken = async (token: NewApiToken) => {
    const nextStatus =
      token.status === TOKEN_STATUS_ENABLED
        ? TOKEN_STATUS_DISABLED
        : TOKEN_STATUS_ENABLED
    setTokensLoading(true)
    try {
      await updateNewApiTokenStatus(token.id, nextStatus)
      await loadTokens(tokenPage)
      showAlert(
        nextStatus === TOKEN_STATUS_ENABLED ? '令牌已启用。' : '令牌已禁用。',
        { type: 'success' }
      )
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '更新令牌状态失败', {
        type: 'error'
      })
    } finally {
      setTokensLoading(false)
    }
  }

  const handleDeleteToken = async (token: NewApiToken) => {
    showAlert(`确定删除令牌「${token.name}」吗？`, {
      type: 'warning',
      showCancel: true,
      onConfirm: async () => {
        try {
          await deleteNewApiToken(token.id)
          await loadTokens(Math.max(1, tokenPage))
          showAlert('令牌已删除。', { type: 'success' })
        } catch (error) {
          showAlert(error instanceof Error ? error.message : '删除令牌失败', {
            type: 'error'
          })
        }
      }
    })
  }

  const handleCopyToken = async (token: NewApiToken) => {
    await navigator.clipboard.writeText(`sk-${token.key}`)
    showAlert('令牌已复制到剪贴板。', { type: 'success' })
  }

  const handleUseTokenInProject = (token: NewApiToken) => {
    const fullKey = `sk-${token.key}`
    localStorage.setItem('antsk_api_key', fullKey)
    setGlobalApiKey(fullKey)
    showAlert('已将该令牌设为当前项目的全局 API Key。', { type: 'success' })
  }

  const currentTab =
    ACCOUNT_TABS.find((item) => item.key === activeTab) || ACCOUNT_TABS[0]

  return (
    <div className="h-screen overflow-y-auto bg-[var(--bg-base)] text-[var(--text-secondary)] p-8 md:p-12 font-sans selection:bg-[var(--selection-bg)]">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 border-b border-[var(--border-subtle)] pb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{' '}
              返回
            </button>
            <h1 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mb-2 flex items-center gap-3">
              账号中心
              <span className="text-[var(--text-muted)] text-lg">/</span>
              <span className="text-[var(--text-muted)] text-sm font-mono tracking-widest uppercase">
                Account Center
              </span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void loadStatusAndSession(activeEndpoint)}
              className="group flex items-center gap-2 px-4 py-3 border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors"
            >
              {statusLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4" />
              )}
              <span className="font-medium text-xs tracking-widest uppercase">
                刷新数据
              </span>
            </button>
            {session && (
              <button
                onClick={() => void handleLogout()}
                disabled={authLoading}
                className="group flex items-center gap-2 px-4 py-3 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-60"
              >
                <Power className="w-4 h-4" />
                <span className="font-medium text-xs tracking-widest uppercase">
                  退出登录
                </span>
              </button>
            )}
          </div>
        </header>

        {!session ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-full max-w-2xl">
              <AuthView
                status={status}
                authTab={authTab}
                setAuthTab={setAuthTab}
                needsTwoFactor={needsTwoFactor}
                authLoading={authLoading}
                verificationLoading={verificationLoading}
                loginForm={loginForm}
                setLoginForm={setLoginForm}
                registerForm={registerForm}
                setRegisterForm={setRegisterForm}
                onLogin={handleLogin}
                onVerifyTwoFactor={handleVerifyTwoFactor}
                onRegister={handleRegister}
                onSendVerificationCode={handleSendVerificationCode}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
              <div className={`${cardClassName} min-w-0 p-5`}>
                <div className="w-12 h-12 border border-[var(--border-secondary)] flex items-center justify-center bg-[var(--accent-bg)] text-[var(--accent-text)]">
                  <User className="w-6 h-6" />
                </div>
                <div className="mt-4 break-words text-sm font-bold text-[var(--text-primary)] tracking-wide">
                  {session.username}
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-tertiary)] font-mono">
                  已登录，可直接管理余额、令牌与日志
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                      余额
                    </div>
                    <div className="mt-2 break-all text-2xl font-light text-[var(--text-primary)]">
                      {formatQuotaInUsd(session.user?.quota, status)}
                    </div>
                  </div>
                  <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                      用户组
                    </div>
                    <div className="mt-2 break-words text-sm font-medium text-[var(--text-secondary)]">
                      {session.user?.group || '默认分组'}
                    </div>
                  </div>
                </div>
              </div>
              <div className={`${cardClassName} p-3`}>
                {ACCOUNT_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-l-2 ${isActive ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      <Icon
                        className={`mt-0.5 w-4 h-4 shrink-0 ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}
                      />
                      <span>
                        <span className="block font-medium text-xs tracking-wider uppercase">
                          {tab.label}
                        </span>
                        <span
                          className={`mt-1 block text-[10px] font-mono leading-5 ${isActive ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-muted)]'}`}
                        >
                          {tab.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <main className="min-w-0 space-y-6">
              <SectionCard
                title={currentTab.label}
                description={currentTab.description}
              >
                <div className="text-[10px] text-[var(--text-muted)] font-mono leading-relaxed">
                  选择左侧模块，即可完成充值、密钥管理和用量查询。
                </div>
              </SectionCard>

              {activeTab === 'overview' && (
                <OverviewPanel
                  status={status}
                  session={session}
                  walletLoading={walletLoading}
                  onRefreshProfile={refreshProfile}
                  onTabChange={setActiveTab}
                />
              )}
              {activeTab === 'billing' && (
                <BillingPanel
                  status={status}
                  session={session}
                  topupInfo={topupInfo}
                  topupInfoLoading={topupInfoLoading}
                  walletLoading={walletLoading}
                  paymentLoading={paymentLoading}
                  estimateLoading={estimateLoading}
                  estimateError={estimateError}
                  topupMethods={topupMethods}
                  subscriptionPlans={subscriptionPlans}
                  subscriptionLoading={subscriptionLoading}
                  billingPreference={billingPreference}
                  activeSubscriptions={activeSubscriptions}
                  allSubscriptions={allSubscriptions}
                  selectedPaymentMethod={selectedPaymentMethod}
                  setSelectedPaymentMethod={setSelectedPaymentMethod}
                  topupAmount={topupAmount}
                  setTopupAmount={setTopupAmount}
                  payableAmount={payableAmount}
                  redeemCode={redeemCode}
                  setRedeemCode={setRedeemCode}
                  onOnlinePay={handleOnlinePay}
                  onSubscriptionPay={handleSubscriptionPay}
                  onRedeemCode={handleRedeemCode}
                  onRefreshProfile={refreshProfile}
                  onRefreshSubscriptions={refreshSubscriptionSelf}
                />
              )}
              {activeTab === 'tokens' && (
                <TokensPanel
                  status={status}
                  tokens={tokens}
                  tokensLoading={tokensLoading}
                  tokenPage={tokenPage}
                  tokenTotal={tokenTotal}
                  tokenPageSize={tokenPageSize}
                  createTokenLoading={createTokenLoading}
                  tokenForm={tokenForm}
                  setTokenForm={setTokenForm}
                  onCreateToken={handleCreateToken}
                  onRefreshTokens={() => loadTokens(tokenPage)}
                  onPageChange={loadTokens}
                  onToggleToken={handleToggleToken}
                  onDeleteToken={handleDeleteToken}
                  onCopyToken={handleCopyToken}
                  onUseTokenInProject={handleUseTokenInProject}
                />
              )}
              {activeTab === 'logs' && (
                <LogsPanel
                  status={status}
                  logView={logView}
                  setLogView={setLogView}
                  logs={logs}
                  logsLoading={logsLoading}
                  logStats={logStats}
                  logType={logType}
                  setLogType={setLogType}
                  logStart={logStart}
                  setLogStart={setLogStart}
                  logEnd={logEnd}
                  setLogEnd={setLogEnd}
                  logChannelId={logChannelId}
                  setLogChannelId={setLogChannelId}
                  logTokenName={logTokenName}
                  setLogTokenName={setLogTokenName}
                  logModelName={logModelName}
                  setLogModelName={setLogModelName}
                  logPage={logPage}
                  logPageSize={logPageSize}
                  logTotal={logTotal}
                  onUsageSearch={() => loadLogs(1)}
                  onUsagePageChange={loadLogs}
                  tasks={tasks}
                  tasksLoading={tasksLoading}
                  taskStart={taskStart}
                  setTaskStart={setTaskStart}
                  taskEnd={taskEnd}
                  setTaskEnd={setTaskEnd}
                  taskTaskId={taskTaskId}
                  setTaskTaskId={setTaskTaskId}
                  taskStatus={taskStatus}
                  setTaskStatus={setTaskStatus}
                  taskPlatform={taskPlatform}
                  setTaskPlatform={setTaskPlatform}
                  taskPage={taskPage}
                  taskPageSize={taskPageSize}
                  taskTotal={taskTotal}
                  onTaskSearch={() => loadTasks(1)}
                  onTaskPageChange={loadTasks}
                />
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewApiConsole
