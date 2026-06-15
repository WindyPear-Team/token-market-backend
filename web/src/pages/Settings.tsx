import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarCheck, Copy, CreditCard, KeyRound, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"
import { passkeyCredentialToJSON, passkeySupported, preparePasskeyCreationOptions } from "@/lib/passkey"

interface Group {
  id: number
  name: string
  multiplier: string | number
}

interface CurrentUser {
  id: number
  username: string
  email: string
  oidc_sub?: string | null
  avatar_url?: string
  balance: string | number
  group?: Group
  groups?: Array<{ group?: Group; expires_at?: string | null }>
  is_admin: boolean
}

interface ReferralInfo {
  enabled: boolean
  code: string
  link: string
  commission_rate: string
  invite_count: number
  total_commission: string | number
}

interface PasswordMethod {
  method: "email_code" | "current_password"
  email: string
  password_set: boolean
}

interface CheckInStatus {
  enabled: boolean
  checked_in_today: boolean
  current_streak: number
  today_reward_preview: string
  random_enabled: boolean
  random_min: string
  random_max: string
  next_streak_reward?: { day: number; amount: string }
  currency_display_name: string
  recent_records: Array<{
    check_in_date: string
    reward_amount: string
    streak_days: number
    reward_kind: string
  }>
}

interface CheckInClaimResult {
  reward_amount: string
  reward_kind: string
  streak_days: number
  balance: string
  currency_display_name: string
}

interface PaymentConfig {
  enabled: boolean
  currency_display_name: string
  usd_to_rmb_rate: string
  min_recharge_amount: string
  recharge_presets: string[]
  methods: string[]
}

interface PaymentOrderResult {
  order_no: string
  amount: string
  rmb_amount: string
  method: string
  status: string
  payment_url?: string
}

interface PasskeyCredential {
  id: number
  name: string
  sign_count: number
  last_used_at?: string | null
  created_at: string
}

export default function Settings() {
  const navigate = useNavigate()
  const { language, setLanguage, t } = useI18n()
  const copy = language === "zh" ? zhSettingsCopy : enSettingsCopy
  const queryClient = useQueryClient()
  const [redeemCode, setRedeemCode] = useState("")
  const [redeemStatus, setRedeemStatus] = useState("")
  const [copyStatus, setCopyStatus] = useState("")
  const [bindStatus, setBindStatus] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordEmailCode, setPasswordEmailCode] = useState("")
  const [passwordStatus, setPasswordStatus] = useState("")
  const [checkInStatusText, setCheckInStatusText] = useState("")
  const [rechargeAmount, setRechargeAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("alipay")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [passkeyName, setPasskeyName] = useState("")
  const [passkeyStatus, setPasskeyStatus] = useState("")

  const { data: user, isLoading } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })

  const { data: referralInfo } = useQuery<ReferralInfo>({
    queryKey: ["user-referral"],
    queryFn: async () => {
      const res = await api.get("/user/referral")
      return res.data
    },
  })
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const { data: passwordMethod, isLoading: isPasswordMethodLoading } = useQuery<PasswordMethod>({
    queryKey: ["password-method"],
    queryFn: async () => {
      const res = await api.get("/user/password/method")
      return res.data
    },
  })
  const { data: checkInStatus } = useQuery<CheckInStatus>({
    queryKey: ["check-in-status"],
    queryFn: async () => {
      const res = await api.get("/user/check-in/status")
      return res.data
    },
    enabled: publicSettings.checkin_enabled,
  })
  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["payment-config"],
    queryFn: async () => {
      const res = await api.get("/user/payment/config")
      return res.data
    },
    enabled: publicSettings.payment_enabled,
  })
  const { data: passkeys = [] } = useQuery<PasskeyCredential[]>({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const res = await api.get("/user/passkeys")
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: publicSettings.passkey_enabled,
  })

  const logout = () => {
    localStorage.removeItem("token")
    navigate("/login", { replace: true })
  }

  const redeemBalance = useMutation({
    mutationFn: async () => {
      const res = await api.post("/user/redeem-code", { code: redeemCode })
      return res.data as { amount: string | number; balance: string | number }
    },
    onSuccess: (result) => {
      setRedeemStatus(t("settings.redeemSuccess", { amount: result.amount }))
      setRedeemCode("")
      queryClient.invalidateQueries({ queryKey: ["me"] })
      queryClient.invalidateQueries({ queryKey: ["stats", "user"] })
    },
    onError: (error) => {
      setRedeemStatus(error instanceof Error ? `${t("settings.redeemFailed")}: ${error.message}` : t("settings.redeemFailed"))
    },
  })

  const bindOIDC = useMutation({
    mutationFn: async () => {
      const res = await api.post("/user/oidc/bind-url")
      return res.data as { auth_url: string }
    },
    onSuccess: (result) => {
      window.location.href = result.auth_url
    },
    onError: (error) => setBindStatus(error instanceof Error ? error.message : copy.oidcBindFailed),
  })

  const sendPasswordCode = useMutation({
    mutationFn: async () => {
      const res = await api.post("/user/password/email-code")
      return res.data
    },
    onSuccess: () => setPasswordStatus(copy.passwordCodeSent),
    onError: (error) => setPasswordStatus(apiErrorMessage(error, copy.passwordCodeFailed)),
  })

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error(copy.passwordMismatch)
      }
      const res = await api.post("/user/password/change", {
        current_password: currentPassword,
        new_password: newPassword,
        email_code: passwordEmailCode,
      })
      return res.data
    },
    onSuccess: () => {
      setPasswordStatus(copy.passwordUpdated)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordEmailCode("")
      queryClient.invalidateQueries({ queryKey: ["password-method"] })
    },
    onError: (error) => setPasswordStatus(apiErrorMessage(error, copy.passwordUpdateFailed)),
  })

  const claimCheckIn = useMutation({
    mutationFn: async () => {
      const res = await api.post("/user/check-in")
      return res.data as CheckInClaimResult
    },
    onSuccess: (result) => {
      setCheckInStatusText(copy.checkInSuccess.replace("{amount}", `${result.currency_display_name}${result.reward_amount}`).replace("{streak}", String(result.streak_days)))
      queryClient.invalidateQueries({ queryKey: ["check-in-status"] })
      queryClient.invalidateQueries({ queryKey: ["me"] })
      queryClient.invalidateQueries({ queryKey: ["stats", "user"] })
    },
    onError: (error) => setCheckInStatusText(apiErrorMessage(error, copy.checkInFailed)),
  })

  const createPaymentOrder = useMutation({
    mutationFn: async () => {
      const method = paymentMethod || paymentConfig?.methods?.[0] || "alipay"
      const res = await api.post("/user/payment/orders", { amount: rechargeAmount, method })
      return res.data as PaymentOrderResult
    },
    onSuccess: (result) => {
      setPaymentStatus(copy.paymentOrderCreated.replace("{order}", result.order_no).replace("{amount}", `${paymentConfig?.currency_display_name || publicSettings.payment_currency_display_name}${result.amount}`))
      if (result.payment_url) {
        window.location.href = result.payment_url
      }
    },
    onError: (error) => setPaymentStatus(apiErrorMessage(error, copy.paymentOrderFailed)),
  })

  const createPasskey = useMutation({
    mutationFn: async () => {
      if (!passkeySupported()) {
        throw new Error(copy.passkeyUnsupported)
      }
      const optionsRes = await api.post("/user/passkeys/register/options")
      const credential = await navigator.credentials.create({
        publicKey: preparePasskeyCreationOptions(optionsRes.data),
      })
      const payload = passkeyCredentialToJSON(credential)
      if (!payload) {
        throw new Error(copy.passkeyCreateFailed)
      }
      const res = await api.post("/user/passkeys/register", {
        name: passkeyName.trim() || copy.defaultPasskeyName,
        credential: payload,
      })
      return res.data
    },
    onSuccess: () => {
      setPasskeyStatus(copy.passkeyCreated)
      setPasskeyName("")
      queryClient.invalidateQueries({ queryKey: ["passkeys"] })
    },
    onError: (error) => setPasskeyStatus(apiErrorMessage(error, copy.passkeyCreateFailed)),
  })

  const deletePasskey = useMutation({
    mutationFn: async (id: number) => api.delete(`/user/passkeys/${id}`),
    onSuccess: () => {
      setPasskeyStatus(copy.passkeyDeleted)
      queryClient.invalidateQueries({ queryKey: ["passkeys"] })
    },
    onError: (error) => setPasskeyStatus(apiErrorMessage(error, copy.passkeyDeleteFailed)),
  })

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopyStatus(t("settings.keyCopied"))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
        <Button variant="outline" className="gap-2" onClick={logout}>
          <LogOut size={16} />
          {t("common.signOut")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.profile")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : (
              <>
                <Field label={t("common.username")} value={user?.username || "-"} />
                <Field label={t("common.email")} value={user?.email || "-"} />
                <Field label={copy.oidcAccount} value={user?.oidc_sub ? copy.bound : copy.notBound} />
                <Field label={t("common.group")} value={groupNames(user)} />
                <Field label={t("common.balance")} value={`${publicSettings.payment_currency_display_name}${user?.balance || 0}`} />
                <Field label={t("common.role")} value={user?.is_admin ? t("common.admin") : t("common.user")} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("common.language")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">{t("settings.languageSubtitle")}</div>
            <div className="flex rounded-md border p-1">
              <Button
                variant={language === "zh" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setLanguage("zh")}
              >
                {t("settings.chinese")}
              </Button>
              <Button
                variant={language === "en" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setLanguage("en")}
              >
                {t("settings.english")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {publicSettings.oidc_enabled && (
          <Card>
            <CardHeader>
              <CardTitle>{copy.oidcBinding}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {user?.oidc_sub ? copy.oidcBoundDescription : copy.oidcBindDescription}
              </div>
              <Button className="gap-2" variant="outline" disabled={Boolean(user?.oidc_sub) || bindOIDC.isPending} onClick={() => bindOIDC.mutate()}>
                <KeyRound size={16} />
                {user?.oidc_sub ? copy.bound : copy.bindOIDC}
              </Button>
              {bindStatus && <div className="text-sm text-muted-foreground">{bindStatus}</div>}
            </CardContent>
          </Card>
        )}

        {publicSettings.passkey_enabled && (
          <Card>
            <CardHeader>
              <CardTitle>{copy.passkeys}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">{copy.passkeyDescription}</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={passkeyName} placeholder={copy.passkeyNamePlaceholder} onChange={(event) => setPasskeyName(event.target.value)} />
                <Button className="shrink-0 gap-2" disabled={createPasskey.isPending} onClick={() => createPasskey.mutate()}>
                  <KeyRound size={16} />
                  {copy.addPasskey}
                </Button>
              </div>
              <div className="space-y-2">
                {passkeys.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">{copy.noPasskeys}</div>
                ) : (
                  passkeys.map((passkey) => (
                    <div key={passkey.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{passkey.name || copy.defaultPasskeyName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {copy.passkeyMeta
                            .replace("{created}", formatDateTime(passkey.created_at))
                            .replace("{last}", passkey.last_used_at ? formatDateTime(passkey.last_used_at) : copy.never)}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" disabled={deletePasskey.isPending} onClick={() => deletePasskey.mutate(passkey.id)}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {passkeyStatus && <div className="text-sm text-muted-foreground">{passkeyStatus}</div>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{copy.changePassword}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPasswordMethodLoading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : passwordMethod?.method === "email_code" ? (
              <div className="space-y-3">
                <Field label={t("common.email")} value={passwordMethod.email || "-"} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={passwordEmailCode}
                    placeholder={copy.emailCodePlaceholder}
                    onChange={(event) => setPasswordEmailCode(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="shrink-0 gap-2"
                    disabled={sendPasswordCode.isPending}
                    onClick={() => sendPasswordCode.mutate()}
                  >
                    <KeyRound size={16} />
                    {copy.sendCode}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  value={currentPassword}
                  type="password"
                  placeholder={copy.currentPasswordPlaceholder}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                {passwordMethod && !passwordMethod.password_set && (
                  <div className="text-sm text-muted-foreground">{copy.noPasswordSet}</div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Input
                value={newPassword}
                type="password"
                placeholder={copy.newPasswordPlaceholder}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <Input
                value={confirmPassword}
                type="password"
                placeholder={copy.confirmPasswordPlaceholder}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!canChangePassword(passwordMethod, currentPassword, passwordEmailCode, newPassword, confirmPassword) || changePassword.isPending}
              onClick={() => changePassword.mutate()}
            >
              <KeyRound size={16} />
              {copy.savePassword}
            </Button>
            {passwordStatus && <div className="text-sm text-muted-foreground">{passwordStatus}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.redeemCode")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={redeemCode}
                onChange={(event) => setRedeemCode(event.target.value)}
                placeholder={t("settings.redeemCodePlaceholder")}
              />
              <Button
                className="shrink-0"
                disabled={!redeemCode.trim() || redeemBalance.isPending}
                onClick={() => redeemBalance.mutate()}
              >
                {t("settings.redeem")}
              </Button>
            </div>
            {redeemStatus && <div className="text-sm text-muted-foreground">{redeemStatus}</div>}
          </CardContent>
        </Card>

        {publicSettings.checkin_enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck size={18} />
                {copy.dailyCheckIn}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Field label={copy.currentStreak} value={String(checkInStatus?.current_streak || 0)} />
                <Field label={copy.todayReward} value={checkInRewardPreview(checkInStatus, publicSettings.payment_currency_display_name)} />
                <Field label={copy.todayStatus} value={checkInStatus?.checked_in_today ? copy.checkedIn : copy.notCheckedIn} />
                <Field label={copy.nextStreakReward} value={nextStreakRewardText(checkInStatus)} />
              </div>
              <Button className="w-full gap-2" disabled={!checkInStatus?.enabled || checkInStatus?.checked_in_today || claimCheckIn.isPending} onClick={() => claimCheckIn.mutate()}>
                <CalendarCheck size={16} />
                {checkInStatus?.checked_in_today ? copy.checkedIn : copy.checkInNow}
              </Button>
              {checkInStatusText && <div className="text-sm text-muted-foreground">{checkInStatusText}</div>}
              {checkInStatus?.recent_records?.length ? (
                <div className="space-y-2 border-t pt-3">
                  <div className="text-sm font-medium">{copy.recentCheckIns}</div>
                  {checkInStatus.recent_records.slice(0, 3).map((record) => (
                    <div key={record.check_in_date} className="flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>{record.check_in_date} · {copy.streakDays.replace("{days}", String(record.streak_days))}</span>
                      <span>{checkInStatus.currency_display_name}{record.reward_amount}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {publicSettings.payment_enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={18} />
                {copy.rechargeBalance}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {copy.rechargeDescription
                  .replace("{min}", `${paymentConfig?.currency_display_name || publicSettings.payment_currency_display_name}${paymentConfig?.min_recharge_amount || publicSettings.payment_min_recharge_amount}`)
                  .replace("{rate}", paymentConfig?.usd_to_rmb_rate || publicSettings.payment_usd_to_rmb_rate)}
              </div>
              <div className="flex flex-wrap gap-2">
                {(paymentConfig?.recharge_presets || parseJSONList(publicSettings.payment_recharge_presets)).map((amount) => (
                  <Button key={amount} type="button" variant={rechargeAmount === amount ? "default" : "outline"} size="sm" onClick={() => setRechargeAmount(amount)}>
                    {paymentConfig?.currency_display_name || publicSettings.payment_currency_display_name}{amount}
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <Input value={rechargeAmount} type="number" min="0" placeholder={copy.rechargeAmountPlaceholder} onChange={(event) => setRechargeAmount(event.target.value)} />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {(paymentConfig?.methods || parseJSONList(publicSettings.payment_methods)).map((method) => (
                    <option key={method} value={method}>{paymentMethodLabel(method, copy)}</option>
                  ))}
                </select>
              </div>
              <Button className="w-full gap-2" disabled={!canCreatePaymentOrder(rechargeAmount, paymentConfig, publicSettings) || createPaymentOrder.isPending} onClick={() => createPaymentOrder.mutate()}>
                <CreditCard size={16} />
                {copy.createPaymentOrder}
              </Button>
              {paymentStatus && <div className="text-sm text-muted-foreground">{paymentStatus}</div>}
            </CardContent>
          </Card>
        )}

        {referralInfo?.enabled && (
          <Card>
            <CardHeader>
              <CardTitle>{copy.referral}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label={copy.referralCode} value={referralInfo.code || "-"} />
              <Field label={copy.inviteCount} value={String(referralInfo.invite_count || 0)} />
              <Field label={copy.totalCommission} value={`${publicSettings.payment_currency_display_name}${referralInfo.total_commission || 0}`} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={referralInfo.link || ""} readOnly />
                <Button
                  variant="outline"
                  className="shrink-0 gap-2"
                  disabled={!referralInfo.link}
                  onClick={() => copyText(referralInfo.link)}
                >
                  <Copy size={16} />
                  {t("common.copy")}
                </Button>
              </div>
              {copyStatus && <div className="text-sm text-muted-foreground">{copyStatus}</div>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function canChangePassword(
  method: PasswordMethod | undefined,
  currentPassword: string,
  emailCode: string,
  newPassword: string,
  confirmPassword: string,
) {
  if (!method || newPassword.length < 8 || confirmPassword.length < 8) {
    return false
  }
  if (method.method === "email_code") {
    return Boolean(emailCode.trim())
  }
  return Boolean(currentPassword)
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) {
      return response.data.error
    }
  }
  return error instanceof Error ? error.message : fallback
}

function groupNames(user?: CurrentUser) {
  const names = (user?.groups || [])
    .filter((membership) => !membership.expires_at || new Date(membership.expires_at).getTime() > Date.now())
    .map((membership) => membership.group?.name)
    .filter((name): name is string => Boolean(name))
  if (names.length > 0) {
    return names.join(", ")
  }
  return user?.group?.name || "-"
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0 truncate text-sm font-medium">{value}</div>
    </div>
  )
}

function checkInRewardPreview(status: CheckInStatus | undefined, fallbackCurrency: string) {
  if (!status) {
    return "-"
  }
  const currency = status.currency_display_name || fallbackCurrency
  if (status.random_enabled) {
    return `${currency}${status.today_reward_preview}+ (${currency}${status.random_min}~${status.random_max})`
  }
  return `${currency}${status.today_reward_preview}`
}

function nextStreakRewardText(status: CheckInStatus | undefined) {
  if (!status?.next_streak_reward) {
    return "-"
  }
  return `${status.next_streak_reward.day}d +${status.currency_display_name}${status.next_streak_reward.amount}`
}

function parseJSONList(raw: string) {
  try {
    const parsed = JSON.parse(raw || "[]")
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return raw.split(",").map((item) => item.trim()).filter(Boolean)
  }
}

function canCreatePaymentOrder(amount: string, config: PaymentConfig | undefined, publicSettings: PublicSettings) {
  const value = Number(amount)
  const min = Number(config?.min_recharge_amount || publicSettings.payment_min_recharge_amount || 0)
  return Boolean((config?.enabled ?? publicSettings.payment_enabled) && Number.isFinite(value) && value > 0 && value >= min)
}

function paymentMethodLabel(method: string, copy: typeof zhSettingsCopy) {
  switch (method.toLowerCase()) {
    case "alipay":
      return copy.alipay
    case "wxpay":
      return copy.wxpay
    default:
      return method
  }
}

function formatDateTime(value: string) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const zhSettingsCopy = {
  referral: "推广返佣",
  referralCode: "推广码",
  inviteCount: "邀请人数",
  totalCommission: "累计返佣",
  oidcAccount: "OIDC 账号",
  oidcBinding: "OIDC 绑定",
  oidcBindDescription: "绑定后可以使用 OIDC 登录当前账号。",
  oidcBoundDescription: "当前账号已经绑定 OIDC。",
  bindOIDC: "绑定 OIDC",
  oidcBindFailed: "OIDC 绑定失败",
  bound: "已绑定",
  notBound: "未绑定",
  passkeys: "Passkeys",
  passkeyDescription: "为当前账号绑定设备 Passkey，之后可以免密码登录。",
  passkeyNamePlaceholder: "Passkey 名称，例如 MacBook",
  addPasskey: "添加 Passkey",
  defaultPasskeyName: "Passkey",
  noPasskeys: "暂无 Passkey",
  passkeyMeta: "创建 {created}，上次使用 {last}",
  never: "从未",
  passkeyUnsupported: "当前浏览器不支持 Passkey",
  passkeyCreated: "Passkey 已添加",
  passkeyCreateFailed: "添加 Passkey 失败",
  passkeyDeleted: "Passkey 已删除",
  passkeyDeleteFailed: "删除 Passkey 失败",
  changePassword: "修改密码",
  currentPasswordPlaceholder: "当前密码",
  newPasswordPlaceholder: "新密码，至少 8 位",
  confirmPasswordPlaceholder: "再次输入新密码",
  emailCodePlaceholder: "邮箱验证码",
  sendCode: "发送验证码",
  savePassword: "保存新密码",
  passwordCodeSent: "验证码已发送",
  passwordCodeFailed: "验证码发送失败",
  passwordUpdated: "密码已更新",
  passwordUpdateFailed: "密码更新失败",
  passwordMismatch: "两次输入的新密码不一致",
  noPasswordSet: "当前账号没有可校验的旧密码，需要管理员先配置 SMTP 后再通过邮箱验证码修改。",
  dailyCheckIn: "每日签到",
  currentStreak: "当前连续签到",
  todayReward: "今日奖励",
  todayStatus: "今日状态",
  nextStreakReward: "下个连续奖励",
  checkedIn: "今日已签到",
  notCheckedIn: "今日未签到",
  checkInNow: "立即签到",
  checkInSuccess: "签到成功，获得 {amount}，连续 {streak} 天。",
  checkInFailed: "签到失败",
  recentCheckIns: "最近签到",
  streakDays: "连续 {days} 天",
  rechargeBalance: "余额充值",
  rechargeDescription: "最低充值 {min}，支付按汇率 1 = ¥{rate} 换算人民币。",
  rechargeAmountPlaceholder: "充值金额",
  createPaymentOrder: "创建支付订单",
  paymentOrderCreated: "订单 {order} 已创建，充值 {amount}。正在跳转到支付页面...",
  paymentOrderFailed: "创建支付订单失败",
  alipay: "支付宝",
  wxpay: "微信支付",
}

const enSettingsCopy: typeof zhSettingsCopy = {
  referral: "Referral",
  referralCode: "Referral code",
  inviteCount: "Invites",
  totalCommission: "Total commission",
  oidcAccount: "OIDC account",
  oidcBinding: "OIDC binding",
  oidcBindDescription: "Bind OIDC to sign in to this account with OIDC.",
  oidcBoundDescription: "This account is already bound to OIDC.",
  bindOIDC: "Bind OIDC",
  oidcBindFailed: "Failed to bind OIDC",
  bound: "Bound",
  notBound: "Not bound",
  passkeys: "Passkeys",
  passkeyDescription: "Bind device passkeys to this account, then sign in without a password.",
  passkeyNamePlaceholder: "Passkey name, for example MacBook",
  addPasskey: "Add passkey",
  defaultPasskeyName: "Passkey",
  noPasskeys: "No passkeys yet",
  passkeyMeta: "Created {created}, last used {last}",
  never: "Never",
  passkeyUnsupported: "This browser does not support passkeys",
  passkeyCreated: "Passkey added",
  passkeyCreateFailed: "Failed to add passkey",
  passkeyDeleted: "Passkey deleted",
  passkeyDeleteFailed: "Failed to delete passkey",
  changePassword: "Change password",
  currentPasswordPlaceholder: "Current password",
  newPasswordPlaceholder: "New password, at least 8 characters",
  confirmPasswordPlaceholder: "Confirm new password",
  emailCodePlaceholder: "Email verification code",
  sendCode: "Send code",
  savePassword: "Save new password",
  passwordCodeSent: "Verification code sent",
  passwordCodeFailed: "Failed to send verification code",
  passwordUpdated: "Password updated",
  passwordUpdateFailed: "Failed to update password",
  passwordMismatch: "New passwords do not match",
  noPasswordSet: "This account has no current password to verify. Ask an administrator to configure SMTP, then change it with an email code.",
  dailyCheckIn: "Daily check-in",
  currentStreak: "Current streak",
  todayReward: "Today's reward",
  todayStatus: "Today's status",
  nextStreakReward: "Next streak reward",
  checkedIn: "Checked in today",
  notCheckedIn: "Not checked in",
  checkInNow: "Check in now",
  checkInSuccess: "Check-in succeeded. You received {amount}; streak {streak} days.",
  checkInFailed: "Check-in failed",
  recentCheckIns: "Recent check-ins",
  streakDays: "{days} day streak",
  rechargeBalance: "Balance recharge",
  rechargeDescription: "Minimum recharge {min}. Payments are converted to RMB at 1 = ¥{rate}.",
  rechargeAmountPlaceholder: "Recharge amount",
  createPaymentOrder: "Create payment order",
  paymentOrderCreated: "Order {order} created for {amount}. Redirecting to payment...",
  paymentOrderFailed: "Failed to create payment order",
  alipay: "Alipay",
  wxpay: "WeChat Pay",
}
