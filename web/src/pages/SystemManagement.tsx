import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Download,
  FileText,
  Gift,
  Globe2,
  HandCoins,
  KeyRound,
  Layers,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
  Trash2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { defaultPublicSettings, parseTopNavItems } from "@/lib/public-settings"
import type { PublicSettings } from "@/lib/public-settings"

interface Group {
  id: number
  name: string
  multiplier: string | number
}

interface GroupDraft {
  id?: number
  name: string
  multiplier: string
}

interface RedeemCode {
  id: number
  code: string
  amount: string | number
  group_id?: number | null
  group?: Group | null
  group_duration_days: number
  allow_stacking: boolean
  max_uses: number
  used_count: number
  enabled: boolean
  expires_at?: string | null
  created_at: string
}

interface RedeemCodeDraft {
  code: string
  amount: string
  group_id: string
  group_duration_days: string
  allow_stacking: boolean
  max_uses: string
  enabled: boolean
  expires_at: string
}

interface ReferralCommissionLog {
  id: number
  amount: string | number
  base_cost: string | number
  rate: string | number
  referred_user?: { username?: string; email?: string }
  created_at: string
}

interface StatusCheck {
  id?: number
  status: string
  latency_ms: number
  status_code?: number
  message?: string
  checked_at: string
}

interface StatusMonitor {
  id: number
  name: string
  target_url: string
  check_type: string
  method: string
  interval_seconds: number
  retention_hours: number
  enabled: boolean
  last_status: string
  last_latency_ms: number
  last_status_code: number
  last_message: string
  last_checked_at?: string | null
  recent_checks: StatusCheck[]
}

interface StatusMonitorDraft {
  id?: number
  name: string
  target_url: string
  check_type: string
  method: string
  interval_seconds: string
  retention_hours: string
  enabled: boolean
}

interface SystemSettings extends PublicSettings {
  hcaptcha_secret: string
  smtp_host: string
  smtp_port: string
  smtp_username: string
  smtp_password: string
  smtp_from: string
  oidc_issuer: string
  oidc_client_id: string
  oidc_client_secret: string
  oidc_redirect_url: string
  rate_limit_enabled: boolean
  rate_limit_requests_per_minute: string
  rate_limit_burst: string
  sensitive_filter_enabled: boolean
  sensitive_words: string
  sensitive_filter_scope: string
  ssrf_protection_enabled: boolean
  ssrf_allow_private_networks: boolean
  ssrf_allowed_hosts: string
  checkin_timezone: string
  checkin_streak_enabled: boolean
  checkin_streak_cycle_days: string
  checkin_streak_rewards: string
  payment_yipay_gateway_url: string
  payment_yipay_pid: string
  payment_yipay_key: string
  payment_yipay_notify_url: string
  payment_yipay_return_url: string
}

type SystemTab =
  | "basic"
  | "billing"
  | "checkIn"
  | "security"
  | "auth"
  | "email"
  | "content"
  | "topNavigation"
  | "navigation"
  | "statusMonitor"
  | "groups"
  | "redeemCodes"

type SystemSection = "general" | "auth" | "content" | "operations"

const isPremiumEdition = import.meta.env.VITE_EDITION === "premium"

const systemSectionTabs: Record<SystemSection, SystemTab[]> = {
  general: ["basic", "billing", "checkIn", ...(isPremiumEdition ? (["security"] as SystemTab[]) : [])],
  auth: ["auth", "email"],
  content: ["content", "topNavigation", "navigation"],
  operations: ["statusMonitor", "groups", "redeemCodes"],
}

interface NavRow {
  id: string
  label: string
  href: string
}

const defaultSystemSettings: SystemSettings = {
  ...defaultPublicSettings,
  hcaptcha_secret: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_username: "",
  smtp_password: "",
  smtp_from: "",
  oidc_issuer: "",
  oidc_client_id: "",
  oidc_client_secret: "",
  oidc_redirect_url: "",
  rate_limit_enabled: true,
  rate_limit_requests_per_minute: "60",
  rate_limit_burst: "10",
  sensitive_filter_enabled: false,
  sensitive_words: "",
  sensitive_filter_scope: "request",
  ssrf_protection_enabled: true,
  ssrf_allow_private_networks: false,
  ssrf_allowed_hosts: "",
  checkin_timezone: "Asia/Shanghai",
  checkin_streak_enabled: false,
  checkin_streak_cycle_days: "7",
  checkin_streak_rewards: "{}",
  payment_yipay_gateway_url: "",
  payment_yipay_pid: "",
  payment_yipay_key: "",
  payment_yipay_notify_url: "",
  payment_yipay_return_url: "",
}

const defaultRedeemDraft: RedeemCodeDraft = {
  code: "",
  amount: "",
  group_id: "",
  group_duration_days: "",
  allow_stacking: false,
  max_uses: "1",
  enabled: true,
  expires_at: "",
}

const defaultGroupDraft: GroupDraft = {
  name: "",
  multiplier: "1",
}

const defaultStatusMonitorDraft: StatusMonitorDraft = {
  name: "",
  target_url: "",
  check_type: "http",
  method: "GET",
  interval_seconds: "60",
  retention_hours: "168",
  enabled: true,
}

export default function SystemManagement({ section = "general" }: { section?: SystemSection }) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const queryClient = useQueryClient()
  const allowedTabs = systemSectionTabs[section] || systemSectionTabs.general
  const [activeTab, setActiveTab] = useState<SystemTab>(allowedTabs[0])
  const [form, setForm] = useState<SystemSettings>(defaultSystemSettings)
  const [navRows, setNavRows] = useState<NavRow[]>([])
  const [redeemDraft, setRedeemDraft] = useState<RedeemCodeDraft>(defaultRedeemDraft)
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false)
  const [redeemSearch, setRedeemSearch] = useState("")
  const [redeemStatusFilter, setRedeemStatusFilter] = useState("all")
  const [redeemGroupFilter, setRedeemGroupFilter] = useState("all")
  const [redeemSort, setRedeemSort] = useState("created_desc")
  const [selectedRedeemCodeIDs, setSelectedRedeemCodeIDs] = useState<number[]>([])
  const [groupDraft, setGroupDraft] = useState<GroupDraft>(defaultGroupDraft)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [statusMonitorDraft, setStatusMonitorDraft] = useState<StatusMonitorDraft>(defaultStatusMonitorDraft)
  const [isStatusMonitorDialogOpen, setIsStatusMonitorDialogOpen] = useState(false)
  const [status, setStatus] = useState("")

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const res = await api.get("/settings")
      return res.data
    },
  })
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await api.get("/groups")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: redeemCodes = [] } = useQuery<RedeemCode[]>({
    queryKey: ["redeem-codes"],
    queryFn: async () => {
      const res = await api.get("/redeem-codes")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: referralLogs = [] } = useQuery<ReferralCommissionLog[]>({
    queryKey: ["referral-commissions"],
    queryFn: async () => {
      const res = await api.get("/referral-commissions")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: statusMonitors = [] } = useQuery<StatusMonitor[]>({
    queryKey: ["status-monitors"],
    queryFn: async () => {
      const res = await api.get("/status-monitors")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  useEffect(() => {
    if (settings) {
      setForm({ ...defaultSystemSettings, ...settings })
      setNavRows(parseTopNavRows(settings.top_nav_items || ""))
    }
  }, [settings])

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0])
    }
  }, [activeTab, allowedTabs])

  const saveSettings = useMutation({
    mutationFn: async () => {
      const res = await api.put("/settings", { ...form, top_nav_items: serializeTopNavRows(navRows) })
      return res.data
    },
    onSuccess: (savedSettings: SystemSettings) => {
      setForm({ ...defaultSystemSettings, ...savedSettings })
      setNavRows(parseTopNavRows(savedSettings.top_nav_items || ""))
      setStatus(t("system.settingsSaved"))
      queryClient.invalidateQueries({ queryKey: ["system-settings"] })
      queryClient.invalidateQueries({ queryKey: ["public-settings"] })
    },
    onError: () => setStatus(t("system.settingsSaveFailed")),
  })

  const saveGroup = useMutation({
    mutationFn: async () => {
      const payload = groupPayload(groupDraft)
      if (groupDraft.id) {
        const res = await api.put(`/groups/${groupDraft.id}`, payload)
        return res.data
      }
      const res = await api.post("/groups", payload)
      return res.data
    },
    onSuccess: () => {
      setGroupDraft(defaultGroupDraft)
      setIsGroupDialogOpen(false)
      setStatus(copy.groupSaved)
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
    onError: () => setStatus(copy.groupSaveFailed),
  })

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => api.delete(`/groups/${id}`),
    onSuccess: () => {
      setStatus(copy.groupDeleted)
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
    onError: () => setStatus(copy.groupDeleteFailed),
  })

  const saveStatusMonitor = useMutation({
    mutationFn: async () => {
      const payload = statusMonitorPayload(statusMonitorDraft)
      if (statusMonitorDraft.id) {
        const res = await api.put(`/status-monitors/${statusMonitorDraft.id}`, payload)
        return res.data
      }
      const res = await api.post("/status-monitors", payload)
      return res.data
    },
    onSuccess: () => {
      setStatusMonitorDraft(defaultStatusMonitorDraft)
      setIsStatusMonitorDialogOpen(false)
      setStatus(copy.statusMonitorSaved)
      queryClient.invalidateQueries({ queryKey: ["status-monitors"] })
    },
    onError: () => setStatus(copy.statusMonitorSaveFailed),
  })

  const deleteStatusMonitor = useMutation({
    mutationFn: async (id: number) => api.delete(`/status-monitors/${id}`),
    onSuccess: () => {
      setStatus(copy.statusMonitorDeleted)
      queryClient.invalidateQueries({ queryKey: ["status-monitors"] })
    },
    onError: () => setStatus(copy.statusMonitorDeleteFailed),
  })

  const checkStatusMonitor = useMutation({
    mutationFn: async (id: number) => api.post(`/status-monitors/${id}/check`),
    onSuccess: () => {
      setStatus(copy.statusMonitorChecked)
      queryClient.invalidateQueries({ queryKey: ["status-monitors"] })
    },
    onError: () => setStatus(copy.statusMonitorCheckFailed),
  })

  const createRedeemCode = useMutation({
    mutationFn: async () => {
      const res = await api.post("/redeem-codes", redeemCodePayload(redeemDraft))
      return res.data
    },
    onSuccess: (createdCode: RedeemCode) => {
      setRedeemDraft(defaultRedeemDraft)
      setIsRedeemDialogOpen(false)
      downloadRedeemCodesTxt([createdCode], copy, `redeem-code-${createdCode.code}.txt`)
      setStatus(copy.redeemCodeCreated)
      queryClient.invalidateQueries({ queryKey: ["redeem-codes"] })
    },
    onError: () => setStatus(copy.redeemCodeCreateFailed),
  })

  const updateRedeemCode = useMutation({
    mutationFn: async ({ code, enabled }: { code: RedeemCode; enabled: boolean }) => {
      const res = await api.put(`/redeem-codes/${code.id}`, {
        code: code.code,
        amount: code.amount,
        group_id: code.group_id || null,
        group_duration_days: code.group_duration_days || 0,
        allow_stacking: Boolean(code.allow_stacking),
        max_uses: code.max_uses,
        enabled,
        expires_at: code.expires_at || "",
      })
      return res.data
    },
    onSuccess: () => {
      setStatus(copy.redeemCodeUpdated)
      queryClient.invalidateQueries({ queryKey: ["redeem-codes"] })
    },
    onError: () => setStatus(copy.redeemCodeUpdateFailed),
  })

  const deleteRedeemCode = useMutation({
    mutationFn: async (id: number) => api.delete(`/redeem-codes/${id}`),
    onSuccess: () => {
      setStatus(copy.redeemCodeDeleted)
      queryClient.invalidateQueries({ queryKey: ["redeem-codes"] })
    },
    onError: () => setStatus(copy.redeemCodeDeleteFailed),
  })

  const updateField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateNavRow = (id: string, patch: Partial<NavRow>) => {
    setNavRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addNavRow = () => {
    setNavRows((current) => [...current, { id: navRowID(current.length), label: "", href: "" }])
  }

  const removeNavRow = (id: string) => {
    setNavRows((current) => current.filter((row) => row.id !== id))
  }

  const moveNavRow = (index: number, direction: -1 | 1) => {
    setNavRows((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const next = [...current]
      const [row] = next.splice(index, 1)
      next.splice(nextIndex, 0, row)
      return next
    })
  }

  const shouldShowSave = !["groups", "redeemCodes"].includes(activeTab)
  const visibleTabs = systemTabs(copy).filter((tab) => allowedTabs.includes(tab.id))
  const canCreateRedeemCode = Number(redeemDraft.amount || 0) > 0 || Boolean(redeemDraft.group_id)
  const canSaveStatusMonitor = Boolean(statusMonitorDraft.name.trim() && statusMonitorDraft.target_url.trim())
  const visibleRedeemCodes = filterAndSortRedeemCodes(redeemCodes, {
    search: redeemSearch,
    status: redeemStatusFilter,
    groupID: redeemGroupFilter,
    sort: redeemSort,
  })
  const selectedRedeemCodes = redeemCodes.filter((code) => selectedRedeemCodeIDs.includes(code.id))
  const allVisibleRedeemCodesSelected = visibleRedeemCodes.length > 0 && visibleRedeemCodes.every((code) => selectedRedeemCodeIDs.includes(code.id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("system.title")}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{copy.systemSubtitle}</div>
          {status && <div className="mt-2 text-sm text-muted-foreground">{status}</div>}
        </div>
        {shouldShowSave && (
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {t("admin.save")}
          </Button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            className="shrink-0 gap-2"
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "basic" && (
        <SettingsPanel title={copy.basic}>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField label={copy.siteName} value={form.site_name} placeholder={copy.siteNamePlaceholder} onChange={(value) => updateField("site_name", value)} />
            <TextField label={copy.baseURL} value={form.base_url} placeholder={copy.baseURLPlaceholder} onChange={(value) => updateField("base_url", value)} />
            <TextField label={copy.iconURL} value={form.icon_url} placeholder={copy.iconURLPlaceholder} onChange={(value) => updateField("icon_url", value)} />
            <TextField label={copy.homeIframeURL} value={form.home_iframe_url} placeholder={copy.homeIframeURLPlaceholder} onChange={(value) => updateField("home_iframe_url", value)} />
            <TextField label={copy.footerText} value={form.footer_text} placeholder={copy.footerTextPlaceholder} onChange={(value) => updateField("footer_text", value)} />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "billing" && (
        <SettingsPanel title={copy.billing}>
          <div className="space-y-8">
            <div className="space-y-4">
              <SectionTitle title={copy.pricingAndReferral} description={copy.pricingAndReferralDescription} />
              <div className="grid gap-4 lg:grid-cols-2">
                <ToggleField label={copy.pricingEndpointEnabled} checked={form.pricing_endpoint_enabled} onChange={(checked) => updateField("pricing_endpoint_enabled", checked)} />
                <ToggleField label={copy.referralEnabled} checked={form.referral_enabled} onChange={(checked) => updateField("referral_enabled", checked)} />
                <TextField
                  label={copy.referralRate}
                  value={form.referral_commission_rate}
                  placeholder={copy.referralRatePlaceholder}
                  onChange={(value) => updateField("referral_commission_rate", value)}
                />
                <label className="block space-y-2 text-sm">
                  <span className="font-medium">{copy.groupMultiplierMode}</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.group_multiplier_mode || "min"}
                    onChange={(event) => updateField("group_multiplier_mode", event.target.value)}
                  >
                    <option value="min">{copy.groupModeMin}</option>
                    <option value="max">{copy.groupModeMax}</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[1fr_120px_120px_120px_180px] border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <div>{copy.referredUser}</div>
                    <div>{copy.baseCost}</div>
                    <div>{copy.referralRateShort}</div>
                    <div>{copy.commission}</div>
                    <div>{copy.createdAt}</div>
                  </div>
                  {referralLogs.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">{copy.noReferralLogs}</div>
                  ) : (
                    referralLogs.slice(0, 20).map((log) => (
                      <div key={log.id} className="grid grid-cols-[1fr_120px_120px_120px_180px] items-center border-b px-3 py-3 text-sm last:border-b-0">
                        <div className="truncate">{log.referred_user?.username || log.referred_user?.email || "-"}</div>
                        <div>{form.payment_currency_display_name}{log.base_cost}</div>
                        <div>{formatRate(log.rate)}</div>
                        <div>{form.payment_currency_display_name}{log.amount}</div>
                        <div>{formatDateTime(log.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle title={copy.paymentSettings} description={copy.paymentSettingsDescription} />
              <div className="grid gap-4 lg:grid-cols-2">
                <ToggleField label={copy.paymentEnabled} checked={form.payment_enabled} onChange={(checked) => updateField("payment_enabled", checked)} />
                <TextField label={copy.currencyDisplayName} value={form.payment_currency_display_name} placeholder="$" onChange={(value) => updateField("payment_currency_display_name", value)} />
                <TextField label={copy.usdToRMBRate} value={form.payment_usd_to_rmb_rate} placeholder="7.20" type="number" onChange={(value) => updateField("payment_usd_to_rmb_rate", value)} />
                <TextField label={copy.minRechargeAmount} value={form.payment_min_recharge_amount} placeholder="1" type="number" onChange={(value) => updateField("payment_min_recharge_amount", value)} />
                <TextField label={copy.rechargePresets} value={jsonListToCSV(form.payment_recharge_presets)} placeholder="5,10,20,50,100" onChange={(value) => updateField("payment_recharge_presets", csvToJSONString(value))} />
                <TextField label={copy.paymentMethods} value={jsonListToCSV(form.payment_methods)} placeholder="alipay,wxpay" onChange={(value) => updateField("payment_methods", csvToJSONString(value))} />
                <TextField label={copy.yipayGatewayURL} value={form.payment_yipay_gateway_url} placeholder="https://pay.example.com/submit.php" onChange={(value) => updateField("payment_yipay_gateway_url", value)} />
                <TextField label={copy.yipayPID} value={form.payment_yipay_pid} placeholder="1000" onChange={(value) => updateField("payment_yipay_pid", value)} />
                <TextField label={copy.yipayKey} value={form.payment_yipay_key} placeholder={copy.yipayKeyPlaceholder} type="password" onChange={(value) => updateField("payment_yipay_key", value)} />
                <TextField label={copy.yipayNotifyURL} value={form.payment_yipay_notify_url} placeholder="https://api.example.com/api/payment/yipay/notify" onChange={(value) => updateField("payment_yipay_notify_url", value)} />
                <TextField label={copy.yipayReturnURL} value={form.payment_yipay_return_url} placeholder="https://api.example.com/api/payment/yipay/return" onChange={(value) => updateField("payment_yipay_return_url", value)} />
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{copy.yipayGatewayHint}</div>
            </div>
          </div>
        </SettingsPanel>
      )}

      {activeTab === "checkIn" && (
        <SettingsPanel title={copy.checkInSettings}>
          <div className="space-y-4">
            <SectionTitle title={copy.checkInSettings} description={copy.checkInSettingsDescription} />
            <div className="grid gap-4 lg:grid-cols-2">
              <ToggleField label={copy.checkInEnabled} checked={form.checkin_enabled} onChange={(checked) => updateField("checkin_enabled", checked)} />
              <TextField label={copy.checkInDailyReward} value={form.checkin_daily_reward} placeholder="1" type="number" onChange={(value) => updateField("checkin_daily_reward", value)} />
              <TextField label={copy.checkInTimezone} value={form.checkin_timezone} placeholder="Asia/Shanghai" onChange={(value) => updateField("checkin_timezone", value)} />
              <ToggleField label={copy.checkInStreakEnabled} checked={form.checkin_streak_enabled} onChange={(checked) => updateField("checkin_streak_enabled", checked)} />
              <TextField label={copy.checkInStreakCycleDays} value={form.checkin_streak_cycle_days} placeholder="7" type="number" onChange={(value) => updateField("checkin_streak_cycle_days", value)} />
              <ToggleField label={copy.checkInRandomEnabled} checked={form.checkin_random_enabled} onChange={(checked) => updateField("checkin_random_enabled", checked)} />
              <TextField label={copy.checkInRandomMin} value={form.checkin_random_min} placeholder="0" type="number" onChange={(value) => updateField("checkin_random_min", value)} />
              <TextField label={copy.checkInRandomMax} value={form.checkin_random_max} placeholder="1" type="number" onChange={(value) => updateField("checkin_random_max", value)} />
            </div>
            <TextareaField label={copy.checkInStreakRewards} value={form.checkin_streak_rewards} placeholder={copy.checkInStreakRewardsPlaceholder} onChange={(value) => updateField("checkin_streak_rewards", value)} />
          </div>
        </SettingsPanel>
      )}

      {isPremiumEdition && activeTab === "security" && (
        <SettingsPanel title={copy.security}>
          <div className="grid gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <ToggleField label={copy.rateLimitEnabled} checked={form.rate_limit_enabled} onChange={(checked) => updateField("rate_limit_enabled", checked)} />
              <TextField label={copy.rateLimitRPM} value={form.rate_limit_requests_per_minute} placeholder="60" type="number" onChange={(value) => updateField("rate_limit_requests_per_minute", value)} />
              <TextField label={copy.rateLimitBurst} value={form.rate_limit_burst} placeholder="10" type="number" onChange={(value) => updateField("rate_limit_burst", value)} />
              <ToggleField label={copy.sensitiveFilterEnabled} checked={form.sensitive_filter_enabled} onChange={(checked) => updateField("sensitive_filter_enabled", checked)} />
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{copy.sensitiveFilterScope}</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.sensitive_filter_scope || "request"}
                  onChange={(event) => updateField("sensitive_filter_scope", event.target.value)}
                >
                  <option value="request">{copy.filterScopeRequest}</option>
                  <option value="request_response">{copy.filterScopeRequestResponse}</option>
                </select>
              </label>
              <ToggleField label={copy.ssrfProtectionEnabled} checked={form.ssrf_protection_enabled} onChange={(checked) => updateField("ssrf_protection_enabled", checked)} />
              <ToggleField label={copy.ssrfAllowPrivateNetworks} checked={form.ssrf_allow_private_networks} onChange={(checked) => updateField("ssrf_allow_private_networks", checked)} />
            </div>
            <TextareaField label={copy.sensitiveWords} value={form.sensitive_words} placeholder={copy.sensitiveWordsPlaceholder} onChange={(value) => updateField("sensitive_words", value)} />
            <TextareaField label={copy.ssrfAllowedHosts} value={form.ssrf_allowed_hosts} placeholder={copy.ssrfAllowedHostsPlaceholder} onChange={(value) => updateField("ssrf_allowed_hosts", value)} />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "auth" && (
        <SettingsPanel title={copy.auth}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ToggleField label={copy.oidcEnabled} checked={form.oidc_enabled} onChange={(checked) => updateField("oidc_enabled", checked)} />
            <ToggleField label={copy.passkeyEnabled} checked={form.passkey_enabled} onChange={(checked) => updateField("passkey_enabled", checked)} />
            <ToggleField label={copy.passwordLoginEnabled} checked={form.password_login_enabled} onChange={(checked) => updateField("password_login_enabled", checked)} />
            <ToggleField label={copy.passwordRegistrationEnabled} checked={form.password_registration_enabled} onChange={(checked) => updateField("password_registration_enabled", checked)} />
            <ToggleField label={copy.emailVerificationRequired} checked={form.email_verification_required} onChange={(checked) => updateField("email_verification_required", checked)} />
            <ToggleField label={copy.passwordHCaptchaEnabled} checked={form.password_hcaptcha_enabled} onChange={(checked) => updateField("password_hcaptcha_enabled", checked)} />
            <TextField label={copy.hcaptchaSiteKey} value={form.hcaptcha_site_key} placeholder={copy.hcaptchaSiteKeyPlaceholder} onChange={(value) => updateField("hcaptcha_site_key", value)} />
            <TextField label={copy.hcaptchaSecret} value={form.hcaptcha_secret} placeholder={copy.hcaptchaSecretPlaceholder} type="password" onChange={(value) => updateField("hcaptcha_secret", value)} />
            <TextField label={copy.oidcIssuer} value={form.oidc_issuer} placeholder={copy.oidcIssuerPlaceholder} onChange={(value) => updateField("oidc_issuer", value)} />
            <TextField label={copy.oidcClientID} value={form.oidc_client_id} placeholder={copy.oidcClientIDPlaceholder} onChange={(value) => updateField("oidc_client_id", value)} />
            <TextField label={copy.oidcClientSecret} value={form.oidc_client_secret} placeholder={copy.oidcClientSecretPlaceholder} type="password" onChange={(value) => updateField("oidc_client_secret", value)} />
            <TextField label={copy.oidcRedirectURL} value={form.oidc_redirect_url} placeholder={copy.oidcRedirectURLPlaceholder} onChange={(value) => updateField("oidc_redirect_url", value)} />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "email" && (
        <SettingsPanel title={copy.email}>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField label={copy.smtpHost} value={form.smtp_host} placeholder={copy.smtpHostPlaceholder} onChange={(value) => updateField("smtp_host", value)} />
            <TextField label={copy.smtpPort} value={form.smtp_port} placeholder={copy.smtpPortPlaceholder} type="number" onChange={(value) => updateField("smtp_port", value)} />
            <TextField label={copy.smtpUsername} value={form.smtp_username} placeholder={copy.smtpUsernamePlaceholder} onChange={(value) => updateField("smtp_username", value)} />
            <TextField label={copy.smtpPassword} value={form.smtp_password} placeholder={copy.smtpPasswordPlaceholder} type="password" onChange={(value) => updateField("smtp_password", value)} />
            <TextField label={copy.smtpFrom} value={form.smtp_from} placeholder={copy.smtpFromPlaceholder} onChange={(value) => updateField("smtp_from", value)} />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "content" && (
        <SettingsPanel title={copy.content}>
          <div className="grid gap-4">
            <TextareaField label={copy.announcement} value={form.announcement} placeholder={copy.announcementPlaceholder} onChange={(value) => updateField("announcement", value)} />
            <TextareaField label={copy.aboutHTML} value={form.about_html} placeholder={copy.aboutHTMLPlaceholder} onChange={(value) => updateField("about_html", value)} />
            <TextareaField label={copy.privacyPolicy} value={form.privacy_policy} placeholder={copy.privacyPolicyPlaceholder} onChange={(value) => updateField("privacy_policy", value)} />
            <TextareaField label={copy.terms} value={form.terms} placeholder={copy.termsPlaceholder} onChange={(value) => updateField("terms", value)} />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "topNavigation" && (
        <SettingsPanel title={copy.topNavigation}>
          <div className="grid gap-3">
            <ToggleField label={copy.topNav} checked={form.top_nav_enabled} onChange={(checked) => updateField("top_nav_enabled", checked)} />
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{copy.topNavItems}</div>
                <Button variant="outline" className="gap-2" onClick={addNavRow}>
                  <Plus size={16} />
                  {copy.addTopNavItem}
                </Button>
              </div>
              <div className="space-y-3">
                {navRows.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.noTopNavItems}</div>}
                {navRows.map((row, index) => (
                  <div key={row.id} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[48px_1fr_1.4fr_auto]">
                    <div className="flex h-10 items-center text-sm text-muted-foreground">#{index + 1}</div>
                    <Input value={row.label} placeholder={copy.topNavLabelPlaceholder} onChange={(event) => updateNavRow(row.id, { label: event.target.value })} />
                    <Input value={row.href} placeholder={copy.topNavHrefPlaceholder} onChange={(event) => updateNavRow(row.id, { href: event.target.value })} />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="icon" onClick={() => moveNavRow(index, -1)} disabled={index === 0} aria-label={copy.moveUp} title={copy.moveUp}>
                        <ArrowUp size={16} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => moveNavRow(index, 1)} disabled={index === navRows.length - 1} aria-label={copy.moveDown} title={copy.moveDown}>
                        <ArrowDown size={16} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => removeNavRow(row.id)} aria-label={copy.deleteTopNavItem} title={copy.deleteTopNavItem}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsPanel>
      )}

      {activeTab === "navigation" && (
        <SettingsPanel title={copy.navigation}>
          <div className="grid gap-3 lg:grid-cols-2">
            <ToggleField label={copy.sidebarDashboard} checked={form.sidebar_dashboard_enabled} onChange={(checked) => updateField("sidebar_dashboard_enabled", checked)} />
            <ToggleField label={copy.sidebarUsage} checked={form.sidebar_usage_enabled} onChange={(checked) => updateField("sidebar_usage_enabled", checked)} />
            <ToggleField label={copy.sidebarAPIKeys} checked={form.sidebar_api_keys_enabled} onChange={(checked) => updateField("sidebar_api_keys_enabled", checked)} />
            <ToggleField label={copy.sidebarChat} checked={form.sidebar_chat_enabled} onChange={(checked) => updateField("sidebar_chat_enabled", checked)} />
            <ToggleField label={copy.sidebarImages} checked={form.sidebar_images_enabled} onChange={(checked) => updateField("sidebar_images_enabled", checked)} />
            <ToggleField label={copy.sidebarSettings} checked={form.sidebar_settings_enabled} onChange={(checked) => updateField("sidebar_settings_enabled", checked)} />
            <ToggleField label={copy.sidebarSystem} checked={form.sidebar_system_enabled} onChange={(checked) => updateField("sidebar_system_enabled", checked)} />
            <ToggleField label={copy.sidebarAdminOverview} checked={form.sidebar_admin_overview_enabled} onChange={(checked) => updateField("sidebar_admin_overview_enabled", checked)} />
            <ToggleField label={copy.sidebarChannels} checked={form.sidebar_channels_enabled} onChange={(checked) => updateField("sidebar_channels_enabled", checked)} />
            <ToggleField label={copy.sidebarModels} checked={form.sidebar_models_enabled} onChange={(checked) => updateField("sidebar_models_enabled", checked)} />
            <ToggleField label={copy.sidebarUsers} checked={form.sidebar_users_enabled} onChange={(checked) => updateField("sidebar_users_enabled", checked)} />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "statusMonitor" && (
        <SettingsPanel title={copy.statusMonitor}>
          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <ToggleField label={copy.statusMonitorEnabled} checked={form.status_monitor_enabled} onChange={(checked) => updateField("status_monitor_enabled", checked)} />
              <Button
                className="gap-2"
                onClick={() => {
                  setStatusMonitorDraft(defaultStatusMonitorDraft)
                  setIsStatusMonitorDialogOpen(true)
                }}
              >
                <Plus size={16} />
                {copy.createStatusMonitor}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[1fr_1.6fr_110px_130px_130px_130px_1fr_220px] border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>{copy.monitorName}</div>
                  <div>{copy.monitorTarget}</div>
                  <div>{copy.checkType}</div>
                  <div>{copy.checkInterval}</div>
                  <div>{copy.retention}</div>
                  <div>{copy.status}</div>
                  <div>{copy.lastResult}</div>
                  <div className="text-right">{t("common.actions")}</div>
                </div>
                {statusMonitors.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">{copy.noStatusMonitors}</div>
                ) : (
                  statusMonitors.map((monitor) => (
                    <div key={monitor.id} className="grid grid-cols-[1fr_1.6fr_110px_130px_130px_130px_1fr_220px] items-center border-b px-3 py-3 text-sm last:border-b-0">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{monitor.name}</div>
                        <div className="text-xs text-muted-foreground">{monitor.enabled ? t("common.enabled") : t("common.disabled")}</div>
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{monitor.target_url}</div>
                      <div>{monitor.check_type.toUpperCase()}</div>
                      <div>{formatSeconds(monitor.interval_seconds)}</div>
                      <div>{formatHours(monitor.retention_hours)}</div>
                      <div>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(monitor.last_status)}`}>
                          {statusLabel(monitor.last_status, copy)}
                        </span>
                      </div>
                      <div className="min-w-0 text-xs text-muted-foreground">
                        <div>{formatLatency(monitor.last_latency_ms)} · {monitor.last_status_code || "-"}</div>
                        <div className="truncate">{monitor.last_message || "-"}</div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" disabled={checkStatusMonitor.isPending} onClick={() => checkStatusMonitor.mutate(monitor.id)} aria-label={copy.checkNow} title={copy.checkNow}>
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setStatusMonitorDraft(statusMonitorToDraft(monitor))
                            setIsStatusMonitorDialogOpen(true)
                          }}
                          aria-label={t("common.edit")}
                          title={t("common.edit")}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button variant="outline" size="icon" className="text-red-500 hover:text-red-600" onClick={() => deleteStatusMonitor.mutate(monitor.id)} aria-label={t("common.delete")} title={t("common.delete")}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <StatusMonitorDialog
              open={isStatusMonitorDialogOpen}
              copy={copy}
              draft={statusMonitorDraft}
              canSave={canSaveStatusMonitor}
              isSaving={saveStatusMonitor.isPending}
              onDraftChange={setStatusMonitorDraft}
              onClose={() => setIsStatusMonitorDialogOpen(false)}
              onSave={() => saveStatusMonitor.mutate()}
            />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "groups" && (
        <SettingsPanel title={copy.groups}>
          <div className="space-y-5">
            <div className="flex justify-end">
              <Button
                className="gap-2"
                onClick={() => {
                  setGroupDraft(defaultGroupDraft)
                  setIsGroupDialogOpen(true)
                }}
              >
                <Plus size={16} />
                {copy.createGroup}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[1fr_160px_180px] border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>{copy.groupName}</div>
                  <div>{copy.groupMultiplier}</div>
                  <div className="text-right">{t("common.actions")}</div>
                </div>
                {groups.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">{copy.noGroups}</div>
                ) : (
                  groups.map((group) => (
                    <div key={group.id} className="grid grid-cols-[1fr_160px_180px] items-center border-b px-3 py-3 text-sm last:border-b-0">
                      <div className="font-medium">{group.name}</div>
                      <div>{group.multiplier}</div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGroupDraft({ id: group.id, name: group.name, multiplier: String(group.multiplier ?? 1) })
                            setIsGroupDialogOpen(true)
                          }}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          disabled={group.name === "user"}
                          onClick={() => deleteGroup.mutate(group.id)}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <GroupDialog
              open={isGroupDialogOpen}
              copy={copy}
              draft={groupDraft}
              isSaving={saveGroup.isPending}
              onDraftChange={setGroupDraft}
              onClose={() => {
                setIsGroupDialogOpen(false)
                setGroupDraft(defaultGroupDraft)
              }}
              onSave={() => saveGroup.mutate()}
            />
          </div>
        </SettingsPanel>
      )}

      {activeTab === "redeemCodes" && (
        <SettingsPanel title={copy.redeemCodes}>
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setRedeemDraft(defaultRedeemDraft)
                      setIsRedeemDialogOpen(true)
                    }}
                  >
                    <Plus size={16} />
                    {copy.createRedeemCode}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={selectedRedeemCodes.length === 0}
                    onClick={() => downloadRedeemCodesTxt(selectedRedeemCodes, copy, "redeem-codes.txt")}
                  >
                    <Download size={16} />
                    {copy.downloadSelected}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">{copy.selectedCount.replace("{count}", String(selectedRedeemCodes.length))}</div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.5fr_160px_180px_180px]">
                <Input value={redeemSearch} placeholder={copy.redeemSearchPlaceholder} onChange={(event) => setRedeemSearch(event.target.value)} />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={redeemStatusFilter} onChange={(event) => setRedeemStatusFilter(event.target.value)}>
                  <option value="all">{copy.filterAllStatus}</option>
                  <option value="enabled">{copy.filterEnabled}</option>
                  <option value="disabled">{copy.filterDisabled}</option>
                  <option value="expired">{copy.filterExpired}</option>
                  <option value="used_up">{copy.filterUsedUp}</option>
                </select>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={redeemGroupFilter} onChange={(event) => setRedeemGroupFilter(event.target.value)}>
                  <option value="all">{copy.filterAllGroups}</option>
                  <option value="none">{copy.noGroupGrant}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={redeemSort} onChange={(event) => setRedeemSort(event.target.value)}>
                  <option value="created_desc">{copy.sortCreatedDesc}</option>
                  <option value="created_asc">{copy.sortCreatedAsc}</option>
                  <option value="code_asc">{copy.sortCodeAsc}</option>
                  <option value="amount_desc">{copy.sortAmountDesc}</option>
                  <option value="used_desc">{copy.sortUsedDesc}</option>
                  <option value="expires_asc">{copy.sortExpiresAsc}</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[1040px]">
                <div className="grid grid-cols-[42px_1.3fr_110px_140px_110px_120px_160px_110px_150px] border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allVisibleRedeemCodesSelected}
                      onChange={(event) => {
                        const visibleIDs = visibleRedeemCodes.map((code) => code.id)
                        setSelectedRedeemCodeIDs((current) => (
                          event.target.checked
                            ? Array.from(new Set([...current, ...visibleIDs]))
                            : current.filter((id) => !visibleIDs.includes(id))
                        ))
                      }}
                    />
                  </label>
                  <div>{copy.redeemCode}</div>
                  <div>{copy.amount}</div>
                  <div>{copy.groupGrant}</div>
                  <div>{copy.groupDuration}</div>
                  <div>{copy.usage}</div>
                  <div>{copy.expiresAt}</div>
                  <div>{copy.status}</div>
                  <div className="text-right">{t("common.actions")}</div>
                </div>
                {visibleRedeemCodes.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">{copy.noRedeemCodes}</div>
                ) : (
                  visibleRedeemCodes.map((code) => (
                    <div key={code.id} className="grid grid-cols-[42px_1.3fr_110px_140px_110px_120px_160px_110px_150px] items-center border-b px-3 py-3 text-sm last:border-b-0">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedRedeemCodeIDs.includes(code.id)}
                          onChange={(event) => {
                            setSelectedRedeemCodeIDs((current) => (
                              event.target.checked ? [...current, code.id] : current.filter((id) => id !== code.id)
                            ))
                          }}
                        />
                      </label>
                      <div className="font-mono text-xs">{code.code}</div>
                      <div>${code.amount}</div>
                      <div>{code.group?.name || "-"}</div>
                      <div>{code.group_id ? formatDuration(code.group_duration_days, copy) : "-"}</div>
                      <div>{code.used_count}/{code.max_uses}</div>
                      <div>{formatDateTime(code.expires_at)}</div>
                      <div>{redeemCodeStatusLabel(code, copy, t)}</div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateRedeemCode.mutate({ code, enabled: !code.enabled })}>
                          {code.enabled ? t("settings.disable") : t("settings.enable")}
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deleteRedeemCode.mutate(code.id)}>
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <RedeemCodeDialog
              open={isRedeemDialogOpen}
              copy={copy}
              draft={redeemDraft}
              groups={groups}
              canSave={canCreateRedeemCode}
              isSaving={createRedeemCode.isPending}
              onDraftChange={setRedeemDraft}
              onClose={() => {
                setIsRedeemDialogOpen(false)
                setRedeemDraft(defaultRedeemDraft)
              }}
              onSave={() => createRedeemCode.mutate()}
            />
          </div>
        </SettingsPanel>
      )}
    </div>
  )
}

function systemTabs(copy: SystemCopy): Array<{ id: SystemTab; label: string; icon: LucideIcon }> {
  return [
    { id: "basic", label: copy.basic, icon: Globe2 },
    { id: "billing", label: copy.billing, icon: HandCoins },
    { id: "checkIn", label: copy.checkInSettings, icon: CalendarCheck },
    ...(isPremiumEdition ? [{ id: "security" as const, label: copy.security, icon: ShieldCheck }] : []),
    { id: "auth", label: copy.auth, icon: KeyRound },
    { id: "email", label: copy.email, icon: Mail },
    { id: "content", label: copy.content, icon: FileText },
    { id: "topNavigation", label: copy.topNavigation, icon: ToggleLeft },
    { id: "navigation", label: copy.navigation, icon: ToggleLeft },
    { id: "statusMonitor", label: copy.statusMonitor, icon: Activity },
    { id: "groups", label: copy.groups, icon: Layers },
    { id: "redeemCodes", label: copy.redeemCodes, icon: Gift },
  ]
}

function SettingsPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function TextareaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
      <span className="font-medium">{label}</span>
      <input type="checkbox" checked={checked} className="h-4 w-4 rounded border-input" onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function StatusMonitorDialog({
  open,
  copy,
  draft,
  canSave,
  isSaving,
  onDraftChange,
  onClose,
  onSave,
}: {
  open: boolean
  copy: SystemCopy
  draft: StatusMonitorDraft
  canSave: boolean
  isSaving: boolean
  onDraftChange: (draft: StatusMonitorDraft) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? copy.updateStatusMonitor : copy.createStatusMonitor}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label={copy.monitorName}
            value={draft.name}
            placeholder={copy.monitorNamePlaceholder}
            onChange={(value) => onDraftChange({ ...draft, name: value })}
          />
          <TextField
            label={copy.monitorTarget}
            value={draft.target_url}
            placeholder={copy.monitorTargetPlaceholder}
            onChange={(value) => onDraftChange({ ...draft, target_url: value })}
          />
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.checkType}</span>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.check_type} onChange={(event) => onDraftChange({ ...draft, check_type: event.target.value })}>
              <option value="http">{copy.checkTypeHTTP}</option>
              <option value="tcp">{copy.checkTypeTCP}</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.httpMethod}</span>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.method} onChange={(event) => onDraftChange({ ...draft, method: event.target.value })}>
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
          </label>
          <TextField
            label={copy.checkInterval}
            value={draft.interval_seconds}
            placeholder={copy.checkIntervalPlaceholder}
            type="number"
            onChange={(value) => onDraftChange({ ...draft, interval_seconds: value })}
          />
          <TextField
            label={copy.retention}
            value={draft.retention_hours}
            placeholder={copy.retentionPlaceholder}
            type="number"
            onChange={(value) => onDraftChange({ ...draft, retention_hours: value })}
          />
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => onDraftChange({ ...draft, enabled: event.target.checked })} />
            {copy.enabled}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!canSave || isSaving} onClick={onSave}>
            {draft.id ? copy.updateStatusMonitor : copy.createStatusMonitor}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GroupDialog({
  open,
  copy,
  draft,
  isSaving,
  onDraftChange,
  onClose,
  onSave,
}: {
  open: boolean
  copy: SystemCopy
  draft: GroupDraft
  isSaving: boolean
  onDraftChange: (draft: GroupDraft) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft.id ? copy.updateGroup : copy.createGroup}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <TextField
            label={copy.groupName}
            value={draft.name}
            placeholder={copy.groupNamePlaceholder}
            onChange={(value) => onDraftChange({ ...draft, name: value })}
          />
          <TextField
            label={copy.groupMultiplier}
            value={draft.multiplier}
            placeholder={copy.groupMultiplierPlaceholder}
            type="number"
            onChange={(value) => onDraftChange({ ...draft, multiplier: value })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!draft.name.trim() || isSaving} onClick={onSave}>
            {draft.id ? copy.updateGroup : copy.createGroup}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RedeemCodeDialog({
  open,
  copy,
  draft,
  groups,
  canSave,
  isSaving,
  onDraftChange,
  onClose,
  onSave,
}: {
  open: boolean
  copy: SystemCopy
  draft: RedeemCodeDraft
  groups: Group[]
  canSave: boolean
  isSaving: boolean
  onDraftChange: (draft: RedeemCodeDraft) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.createRedeemCode}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label={copy.redeemCode}
            value={draft.code}
            placeholder={copy.redeemCodePlaceholder}
            onChange={(value) => onDraftChange({ ...draft, code: value })}
          />
          <TextField
            label={copy.amount}
            value={draft.amount}
            placeholder={copy.redeemAmountPlaceholder}
            type="number"
            onChange={(value) => onDraftChange({ ...draft, amount: value })}
          />
          <TextField
            label={copy.usage}
            value={draft.max_uses}
            placeholder={copy.redeemMaxUsesPlaceholder}
            type="number"
            onChange={(value) => onDraftChange({ ...draft, max_uses: value })}
          />
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.expiresAt}</span>
            <Input type="datetime-local" value={draft.expires_at} onChange={(event) => onDraftChange({ ...draft, expires_at: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.groupGrant}</span>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.group_id} onChange={(event) => onDraftChange({ ...draft, group_id: event.target.value })}>
              <option value="">{copy.noGroupGrant}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <TextField
            label={copy.groupDuration}
            value={draft.group_duration_days}
            placeholder={copy.groupDurationPlaceholder}
            type="number"
            onChange={(value) => onDraftChange({ ...draft, group_duration_days: value })}
          />
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.allow_stacking} onChange={(event) => onDraftChange({ ...draft, allow_stacking: event.target.checked })} />
            {copy.allowStacking}
          </label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => onDraftChange({ ...draft, enabled: event.target.checked })} />
            {copy.enabled}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!canSave || isSaving} onClick={onSave}>{copy.createRedeemCode}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseTopNavRows(raw: string): NavRow[] {
  return parseTopNavItems(raw).map((item, index) => ({
    id: navRowID(index),
    label: item.label,
    href: item.href,
  }))
}

function serializeTopNavRows(rows: NavRow[]) {
  return rows
    .map((row) => ({ label: row.label.trim(), href: row.href.trim() }))
    .filter((row) => row.label && row.href)
    .map((row) => `${row.label}|${row.href}`)
    .join("\n")
}

function navRowID(index: number) {
  return `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`
}

function groupPayload(draft: GroupDraft) {
  return {
    name: draft.name.trim(),
    multiplier: Number(draft.multiplier || 1),
  }
}

function statusMonitorPayload(draft: StatusMonitorDraft) {
  return {
    name: draft.name.trim(),
    target_url: draft.target_url.trim(),
    check_type: draft.check_type,
    method: draft.method,
    interval_seconds: Number(draft.interval_seconds || 60),
    retention_hours: Number(draft.retention_hours || 168),
    enabled: draft.enabled,
  }
}

function statusMonitorToDraft(monitor: StatusMonitor): StatusMonitorDraft {
  return {
    id: monitor.id,
    name: monitor.name,
    target_url: monitor.target_url,
    check_type: monitor.check_type || "http",
    method: monitor.method || "GET",
    interval_seconds: String(monitor.interval_seconds || 60),
    retention_hours: String(monitor.retention_hours || 168),
    enabled: monitor.enabled,
  }
}

function redeemCodePayload(draft: RedeemCodeDraft) {
  return {
    code: draft.code.trim(),
    amount: Number(draft.amount || 0),
    group_id: Number(draft.group_id || 0) || null,
    group_duration_days: Number(draft.group_duration_days || 0),
    allow_stacking: draft.allow_stacking,
    max_uses: Number(draft.max_uses || 1),
    enabled: draft.enabled,
    expires_at: draft.expires_at,
  }
}

function statusBadgeClass(status: string) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    case "down":
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
  }
}

function statusLabel(status: string, copy: SystemCopy) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return copy.statusUp
    case "down":
      return copy.statusDown
    default:
      return copy.statusPending
  }
}

function formatLatency(value: number) {
  if (!value || value <= 0) {
    return "-"
  }
  return `${value}ms`
}

function formatSeconds(value: number) {
  if (!value) {
    return "-"
  }
  if (value % 3600 === 0) {
    return `${value / 3600}h`
  }
  if (value % 60 === 0) {
    return `${value / 60}m`
  }
  return `${value}s`
}

function formatHours(value: number) {
  if (!value) {
    return "-"
  }
  if (value % 24 === 0) {
    return `${value / 24}d`
  }
  return `${value}h`
}

function filterAndSortRedeemCodes(
  codes: RedeemCode[],
  filters: { search: string; status: string; groupID: string; sort: string }
) {
  const search = filters.search.trim().toLowerCase()
  return [...codes]
    .filter((code) => {
      if (search && !code.code.toLowerCase().includes(search)) {
        return false
      }
      if (filters.status !== "all" && redeemCodeStatus(code) !== filters.status) {
        return false
      }
      if (filters.groupID === "none" && code.group_id) {
        return false
      }
      if (filters.groupID !== "all" && filters.groupID !== "none" && String(code.group_id || "") !== filters.groupID) {
        return false
      }
      return true
    })
    .sort((a, b) => compareRedeemCodes(a, b, filters.sort))
}

function compareRedeemCodes(a: RedeemCode, b: RedeemCode, sort: string) {
  switch (sort) {
    case "created_asc":
      return dateTimeValue(a.created_at) - dateTimeValue(b.created_at)
    case "code_asc":
      return a.code.localeCompare(b.code)
    case "amount_desc":
      return Number(b.amount || 0) - Number(a.amount || 0)
    case "used_desc":
      return b.used_count - a.used_count
    case "expires_asc":
      return dateTimeValue(a.expires_at, Number.MAX_SAFE_INTEGER) - dateTimeValue(b.expires_at, Number.MAX_SAFE_INTEGER)
    case "created_desc":
    default:
      return dateTimeValue(b.created_at) - dateTimeValue(a.created_at)
  }
}

function redeemCodeStatus(code: RedeemCode) {
  if (!code.enabled) {
    return "disabled"
  }
  if (code.expires_at && dateTimeValue(code.expires_at) < Date.now()) {
    return "expired"
  }
  if (code.max_uses > 0 && code.used_count >= code.max_uses) {
    return "used_up"
  }
  return "enabled"
}

function redeemCodeStatusLabel(code: RedeemCode, copy: SystemCopy, t: ReturnType<typeof useI18n>["t"]) {
  switch (redeemCodeStatus(code)) {
    case "disabled":
      return t("common.disabled")
    case "expired":
      return copy.filterExpired
    case "used_up":
      return copy.filterUsedUp
    default:
      return t("common.enabled")
  }
}

function dateTimeValue(value?: string | null, fallback = 0) {
  if (!value) {
    return fallback
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? fallback : time
}

function downloadRedeemCodesTxt(codes: RedeemCode[], copy: SystemCopy, filename: string) {
  if (codes.length === 0) {
    return
  }
  const body = codes.map((code) => redeemCodeText(code, copy)).join("\n\n")
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function redeemCodeText(code: RedeemCode, copy: SystemCopy) {
  return [
    `${copy.redeemCode}: ${code.code}`,
    `${copy.amount}: ${code.amount}`,
    `${copy.groupGrant}: ${code.group?.name || "-"}`,
    `${copy.groupDuration}: ${code.group_id ? formatDuration(code.group_duration_days, copy) : "-"}`,
    `${copy.usage}: ${code.used_count}/${code.max_uses}`,
    `${copy.expiresAt}: ${formatDateTime(code.expires_at)}`,
  ].join("\n")
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function formatDuration(days: number, copy: SystemCopy) {
  if (!days || days <= 0) {
    return copy.permanent
  }
  return `${days}${copy.days}`
}

function formatRate(value: string | number) {
  const rate = Number(value)
  if (!Number.isFinite(rate)) {
    return String(value)
  }
  return `${(rate * 100).toFixed(2)}%`
}

function jsonListToCSV(value: string) {
  try {
    const parsed = JSON.parse(value || "[]")
    if (Array.isArray(parsed)) {
      return parsed.join(",")
    }
  } catch {
    // Keep malformed values editable instead of replacing them silently.
  }
  return value || ""
}

function csvToJSONString(value: string) {
  return JSON.stringify(value.split(",").map((item) => item.trim()).filter(Boolean))
}

type SystemCopy = typeof zhCopy

const zhCopy = {
  overview: "概览",
  systemSubtitle: "配置站点、认证、页面内容、导航、分组和兑换码",
  basic: "基础设置",
  billing: "计费与推广",
  pricingAndReferral: "价格与推广",
  pricingAndReferralDescription: "配置公开价格接口、推广返佣和多分组计价规则。",
  checkInSettings: "签到奖励",
  checkInSettingsDescription: "配置每日签到、连续签到奖励和随机积分奖励。",
  checkInEnabled: "启用签到",
  checkInDailyReward: "每次签到奖励",
  checkInTimezone: "签到时区",
  checkInStreakEnabled: "启用连续签到奖励",
  checkInStreakCycleDays: "连续签到循环天数",
  checkInStreakRewards: "连续签到奖励 JSON",
  checkInStreakRewardsPlaceholder: "例如 {\"3\":\"1\",\"7\":\"3\"}，表示第 3 天额外 1，第 7 天额外 3",
  checkInRandomEnabled: "启用随机奖励",
  checkInRandomMin: "随机奖励最小值",
  checkInRandomMax: "随机奖励最大值",
  paymentSettings: "易支付充值",
  paymentSettingsDescription: "配置用户余额充值、人民币结算汇率和易支付网关。",
  paymentEnabled: "启用支付充值",
  currencyDisplayName: "余额显示符号/名称",
  usdToRMBRate: "USD 到 RMB 汇率",
  minRechargeAmount: "最低充值金额",
  rechargePresets: "预设充值金额",
  paymentMethods: "启用支付方式",
  yipayGatewayURL: "易支付提交地址",
  yipayPID: "易支付商户 PID",
  yipayKey: "易支付商户密钥",
  yipayKeyPlaceholder: "用于 MD5 签名的商户密钥",
  yipayNotifyURL: "异步通知地址（可选）",
  yipayReturnURL: "同步跳转地址（可选）",
  yipayGatewayHint: "易支付不同部署的提交路径可能不同，请填写实际提交端点，例如 https://pay.example.com/submit.php。通知和跳转地址留空时会根据 Base URL 自动生成。",
  security: "安全策略",
  rateLimitEnabled: "启用网关速率限制",
  rateLimitRPM: "每分钟请求数",
  rateLimitBurst: "突发额度",
  sensitiveFilterEnabled: "启用敏感词过滤",
  sensitiveWords: "敏感词列表",
  sensitiveWordsPlaceholder: "每行或用逗号分隔，例如：违规词\nsecret-key",
  sensitiveFilterScope: "过滤范围",
  filterScopeRequest: "仅请求内容",
  filterScopeRequestResponse: "请求和响应内容",
  ssrfProtectionEnabled: "启用 SSRF 保护",
  ssrfAllowPrivateNetworks: "允许访问私有网络",
  ssrfAllowedHosts: "SSRF 允许主机",
  ssrfAllowedHostsPlaceholder: "每行或用逗号分隔，例如：internal-api.example.com\n192.168.1.10",
  auth: "登录认证",
  email: "邮件配置",
  content: "页面内容",
  topNavigation: "顶部导航",
  navigation: "侧边栏模块",
  statusMonitor: "状态监测",
  groups: "用户分组",
  siteName: "站点名称",
  siteNamePlaceholder: "例如 WindyPear API",
  baseURL: "Base URL",
  baseURLPlaceholder: "例如 https://api.example.com",
  iconURL: "图标 URL",
  iconURLPlaceholder: "例如 https://example.com/icon.png",
  footerText: "页脚文本",
  footerTextPlaceholder: "例如 © 2026 WindyPear",
  homeIframeURL: "首页 iframe 地址",
  homeIframeURLPlaceholder: "例如 https://status.example.com",
  pricingEndpointEnabled: "公开 /api/pricing 价格接口",
  referralEnabled: "启用推广返佣",
  referralRate: "返佣比例",
  referralRatePlaceholder: "例如 0.1 表示 10%",
  referralRateShort: "比例",
  groupMultiplierMode: "多个分组倍率取值",
  groupModeMin: "取较小倍率",
  groupModeMax: "取较大倍率",
  statusMonitorEnabled: "启用公开状态监测页",
  createStatusMonitor: "添加监测节点",
  updateStatusMonitor: "更新监测节点",
  monitorName: "节点名称",
  monitorNamePlaceholder: "例如 主站 API",
  monitorTarget: "检测地址",
  monitorTargetPlaceholder: "HTTP 填 https://api.example.com/health，TCP 填 host:port",
  checkType: "检测方式",
  checkTypeHTTP: "HTTP / HTTPS",
  checkTypeTCP: "TCP 端口",
  httpMethod: "HTTP 方法",
  checkInterval: "检测间隔",
  checkIntervalPlaceholder: "秒，最小 10，例如 60",
  retention: "保留时间",
  retentionPlaceholder: "小时，例如 168",
  lastResult: "最近结果",
  noStatusMonitors: "暂无监测节点",
  checkNow: "立即检测",
  statusMonitorSaved: "监测节点已保存",
  statusMonitorSaveFailed: "监测节点保存失败",
  statusMonitorDeleted: "监测节点已删除",
  statusMonitorDeleteFailed: "监测节点删除失败",
  statusMonitorChecked: "检测已完成",
  statusMonitorCheckFailed: "检测失败",
  statusUp: "正常",
  statusDown: "故障",
  statusPending: "等待",
  oidcEnabled: "启用 OIDC 登录",
  passkeyEnabled: "启用 Passkey 登录",
  passwordLoginEnabled: "允许账号密码登录",
  passwordRegistrationEnabled: "允许账号密码注册",
  emailVerificationRequired: "注册必须验证邮箱",
  passwordHCaptchaEnabled: "账号密码登录启用 hCaptcha",
  hcaptchaSiteKey: "hCaptcha Site Key",
  hcaptchaSiteKeyPlaceholder: "前端显示用 site key",
  hcaptchaSecret: "hCaptcha Secret",
  hcaptchaSecretPlaceholder: "服务端校验用 secret",
  smtpHost: "SMTP Host",
  smtpHostPlaceholder: "例如 smtp.example.com",
  smtpPort: "SMTP Port",
  smtpPortPlaceholder: "例如 587",
  smtpUsername: "SMTP 用户名",
  smtpUsernamePlaceholder: "例如 no-reply@example.com",
  smtpPassword: "SMTP 密码",
  smtpPasswordPlaceholder: "SMTP 密码或授权码",
  smtpFrom: "发件人",
  smtpFromPlaceholder: "例如 WindyPear <no-reply@example.com>",
  referredUser: "被推广用户",
  baseCost: "消费",
  commission: "返佣",
  createdAt: "时间",
  noReferralLogs: "暂无返佣记录",
  oidcIssuer: "OIDC Issuer",
  oidcIssuerPlaceholder: "留空使用环境变量 OIDC_ISSUER",
  oidcClientID: "OIDC Client ID",
  oidcClientIDPlaceholder: "留空使用环境变量 OIDC_CLIENT_ID",
  oidcClientSecret: "OIDC Client Secret",
  oidcClientSecretPlaceholder: "留空使用环境变量 OIDC_CLIENT_SECRET",
  oidcRedirectURL: "OIDC Redirect URL",
  oidcRedirectURLPlaceholder: "留空使用环境变量 OIDC_REDIRECT_URL",
  announcement: "系统公告",
  announcementPlaceholder: "显示在用户页面顶部的公告",
  aboutHTML: "关于页面 HTML",
  aboutHTMLPlaceholder: "<h2>关于我们</h2><p>...</p>",
  privacyPolicy: "隐私政策",
  privacyPolicyPlaceholder: "<h2>隐私政策</h2><p>...</p>",
  terms: "用户协议",
  termsPlaceholder: "<h2>用户协议</h2><p>...</p>",
  topNav: "顶部导航",
  topNavItems: "顶部导航项",
  addTopNavItem: "添加导航项",
  noTopNavItems: "暂无导航项",
  topNavLabelPlaceholder: "显示名称，例如 控制台",
  topNavHrefPlaceholder: "地址，例如 /dashboard 或 https://example.com",
  moveUp: "上移",
  moveDown: "下移",
  deleteTopNavItem: "删除",
  sidebarDashboard: "侧边栏：概览",
  sidebarUsage: "侧边栏：调用记录",
  sidebarAPIKeys: "侧边栏：令牌",
  sidebarChat: "侧边栏：聊天",
  sidebarImages: "侧边栏：AI 绘画",
  sidebarSettings: "侧边栏：设置",
  sidebarSystem: "侧边栏：系统管理",
  sidebarAdminOverview: "侧边栏：管理员概览",
  sidebarChannels: "侧边栏：渠道",
  sidebarModels: "侧边栏：模型配置",
  sidebarUsers: "侧边栏：用户",
  groupName: "分组名称",
  groupMultiplier: "分组倍率",
  groupNamePlaceholder: "例如 vip",
  groupMultiplierPlaceholder: "倍率，例如 0.8",
  createGroup: "创建分组",
  updateGroup: "更新分组",
  cancelEdit: "取消编辑",
  groupSaved: "分组已保存",
  groupSaveFailed: "分组保存失败",
  groupDeleted: "分组已删除",
  groupDeleteFailed: "分组删除失败，可能仍在使用中",
  noGroups: "暂无分组",
  redeemCodes: "兑换码",
  redeemCode: "兑换码",
  redeemCodePlaceholder: "留空自动生成",
  redeemAmountPlaceholder: "到账余额",
  redeemMaxUsesPlaceholder: "次数",
  groupGrant: "授予分组",
  noGroupGrant: "不授予分组",
  groupDuration: "分组时长",
  groupDurationPlaceholder: "分组天数，0 为永久",
  allowStacking: "允许叠加时长",
  permanent: "永久",
  days: "天",
  createRedeemCode: "创建兑换码",
  downloadSelected: "下载选中",
  selectedCount: "已选 {count} 个",
  redeemSearchPlaceholder: "搜索兑换码",
  filterAllStatus: "全部状态",
  filterEnabled: "可用",
  filterDisabled: "已禁用",
  filterExpired: "已过期",
  filterUsedUp: "已用完",
  filterAllGroups: "全部分组",
  sortCreatedDesc: "创建时间从新到旧",
  sortCreatedAsc: "创建时间从旧到新",
  sortCodeAsc: "兑换码 A-Z",
  sortAmountDesc: "金额从高到低",
  sortUsedDesc: "使用次数从高到低",
  sortExpiresAsc: "过期时间从近到远",
  redeemCodeCreated: "兑换码已创建",
  redeemCodeCreateFailed: "兑换码创建失败",
  redeemCodeUpdated: "兑换码已更新",
  redeemCodeUpdateFailed: "兑换码更新失败",
  redeemCodeDeleted: "兑换码已删除",
  redeemCodeDeleteFailed: "兑换码删除失败",
  noRedeemCodes: "暂无兑换码",
  amount: "金额",
  usage: "使用次数",
  expiresAt: "过期时间",
  status: "状态",
  enabled: "启用",
}

const enCopy: SystemCopy = {
  overview: "Overview",
  systemSubtitle: "Configure site, auth, content, navigation, groups, and redeem codes",
  basic: "Basic",
  billing: "Billing & Referral",
  pricingAndReferral: "Pricing & Referral",
  pricingAndReferralDescription: "Configure the public pricing endpoint, referral commission, and multi-group billing rule.",
  checkInSettings: "Check-in Rewards",
  checkInSettingsDescription: "Configure daily check-in, streak rewards, and random reward bonuses.",
  checkInEnabled: "Enable check-in",
  checkInDailyReward: "Reward per check-in",
  checkInTimezone: "Check-in timezone",
  checkInStreakEnabled: "Enable streak rewards",
  checkInStreakCycleDays: "Streak cycle days",
  checkInStreakRewards: "Streak rewards JSON",
  checkInStreakRewardsPlaceholder: "For example {\"3\":\"1\",\"7\":\"3\"}; day 3 grants +1 and day 7 grants +3",
  checkInRandomEnabled: "Enable random reward",
  checkInRandomMin: "Random reward minimum",
  checkInRandomMax: "Random reward maximum",
  paymentSettings: "Yipay Recharge",
  paymentSettingsDescription: "Configure user balance recharge, RMB settlement rate, and the Yipay gateway.",
  paymentEnabled: "Enable payment recharge",
  currencyDisplayName: "Balance display symbol/name",
  usdToRMBRate: "USD to RMB rate",
  minRechargeAmount: "Minimum recharge amount",
  rechargePresets: "Preset recharge amounts",
  paymentMethods: "Enabled payment methods",
  yipayGatewayURL: "Yipay submit URL",
  yipayPID: "Yipay merchant PID",
  yipayKey: "Yipay merchant key",
  yipayKeyPlaceholder: "Merchant key used for MD5 signing",
  yipayNotifyURL: "Notify URL override (optional)",
  yipayReturnURL: "Return URL override (optional)",
  yipayGatewayHint: "Yipay deployments may use different submit paths. Enter the actual submit endpoint, such as https://pay.example.com/submit.php. Notify and return URLs are generated from Base URL when left empty.",
  security: "Security Policy",
  rateLimitEnabled: "Enable gateway rate limiting",
  rateLimitRPM: "Requests per minute",
  rateLimitBurst: "Burst allowance",
  sensitiveFilterEnabled: "Enable sensitive-word filtering",
  sensitiveWords: "Sensitive words",
  sensitiveWordsPlaceholder: "One per line or comma-separated, e.g. blocked word\nsecret-key",
  sensitiveFilterScope: "Filter scope",
  filterScopeRequest: "Request content only",
  filterScopeRequestResponse: "Request and response content",
  ssrfProtectionEnabled: "Enable SSRF protection",
  ssrfAllowPrivateNetworks: "Allow private networks",
  ssrfAllowedHosts: "SSRF allowed hosts",
  ssrfAllowedHostsPlaceholder: "One per line or comma-separated, e.g. internal-api.example.com\n192.168.1.10",
  auth: "Authentication",
  email: "Email",
  content: "Content",
  topNavigation: "Top Navigation",
  navigation: "Sidebar Modules",
  statusMonitor: "Status Monitor",
  groups: "User Groups",
  siteName: "Site name",
  siteNamePlaceholder: "For example, WindyPear API",
  baseURL: "Base URL",
  baseURLPlaceholder: "For example, https://api.example.com",
  iconURL: "Icon URL",
  iconURLPlaceholder: "For example, https://example.com/icon.png",
  footerText: "Footer text",
  footerTextPlaceholder: "For example, © 2026 WindyPear",
  homeIframeURL: "Home iframe URL",
  homeIframeURLPlaceholder: "For example, https://status.example.com",
  pricingEndpointEnabled: "Expose /api/pricing price endpoint",
  referralEnabled: "Enable referral commission",
  referralRate: "Commission rate",
  referralRatePlaceholder: "For example, 0.1 means 10%",
  referralRateShort: "Rate",
  groupMultiplierMode: "Multiple group multiplier mode",
  groupModeMin: "Use lower multiplier",
  groupModeMax: "Use higher multiplier",
  statusMonitorEnabled: "Enable public status page",
  createStatusMonitor: "Add monitor",
  updateStatusMonitor: "Update monitor",
  monitorName: "Node name",
  monitorNamePlaceholder: "For example, Primary API",
  monitorTarget: "Target",
  monitorTargetPlaceholder: "HTTP uses https://api.example.com/health, TCP uses host:port",
  checkType: "Check type",
  checkTypeHTTP: "HTTP / HTTPS",
  checkTypeTCP: "TCP port",
  httpMethod: "HTTP method",
  checkInterval: "Check interval",
  checkIntervalPlaceholder: "Seconds, minimum 10, for example 60",
  retention: "Retention",
  retentionPlaceholder: "Hours, for example 168",
  lastResult: "Last result",
  noStatusMonitors: "No monitors",
  checkNow: "Check now",
  statusMonitorSaved: "Monitor saved",
  statusMonitorSaveFailed: "Failed to save monitor",
  statusMonitorDeleted: "Monitor deleted",
  statusMonitorDeleteFailed: "Failed to delete monitor",
  statusMonitorChecked: "Check finished",
  statusMonitorCheckFailed: "Check failed",
  statusUp: "Up",
  statusDown: "Down",
  statusPending: "Pending",
  oidcEnabled: "Enable OIDC login",
  passkeyEnabled: "Enable passkey login",
  passwordLoginEnabled: "Allow password login",
  passwordRegistrationEnabled: "Allow password registration",
  emailVerificationRequired: "Require email verification on registration",
  passwordHCaptchaEnabled: "Enable hCaptcha for password auth",
  hcaptchaSiteKey: "hCaptcha Site Key",
  hcaptchaSiteKeyPlaceholder: "Site key used by the frontend",
  hcaptchaSecret: "hCaptcha Secret",
  hcaptchaSecretPlaceholder: "Secret used by the backend",
  smtpHost: "SMTP Host",
  smtpHostPlaceholder: "For example, smtp.example.com",
  smtpPort: "SMTP Port",
  smtpPortPlaceholder: "For example, 587",
  smtpUsername: "SMTP username",
  smtpUsernamePlaceholder: "For example, no-reply@example.com",
  smtpPassword: "SMTP password",
  smtpPasswordPlaceholder: "SMTP password or app password",
  smtpFrom: "From",
  smtpFromPlaceholder: "For example, WindyPear <no-reply@example.com>",
  referredUser: "Referred user",
  baseCost: "Cost",
  commission: "Commission",
  createdAt: "Time",
  noReferralLogs: "No referral commission logs",
  oidcIssuer: "OIDC Issuer",
  oidcIssuerPlaceholder: "Empty uses OIDC_ISSUER",
  oidcClientID: "OIDC Client ID",
  oidcClientIDPlaceholder: "Empty uses OIDC_CLIENT_ID",
  oidcClientSecret: "OIDC Client Secret",
  oidcClientSecretPlaceholder: "Empty uses OIDC_CLIENT_SECRET",
  oidcRedirectURL: "OIDC Redirect URL",
  oidcRedirectURLPlaceholder: "Empty uses OIDC_REDIRECT_URL",
  announcement: "System announcement",
  announcementPlaceholder: "Announcement shown at the top of user pages",
  aboutHTML: "About page HTML",
  aboutHTMLPlaceholder: "<h2>About</h2><p>...</p>",
  privacyPolicy: "Privacy policy",
  privacyPolicyPlaceholder: "<h2>Privacy policy</h2><p>...</p>",
  terms: "Terms",
  termsPlaceholder: "<h2>Terms</h2><p>...</p>",
  topNav: "Top navigation",
  topNavItems: "Top navigation items",
  addTopNavItem: "Add item",
  noTopNavItems: "No navigation items",
  topNavLabelPlaceholder: "Label, for example Dashboard",
  topNavHrefPlaceholder: "URL, for example /dashboard or https://example.com",
  moveUp: "Move up",
  moveDown: "Move down",
  deleteTopNavItem: "Delete",
  sidebarDashboard: "Sidebar: Dashboard",
  sidebarUsage: "Sidebar: Call Records",
  sidebarAPIKeys: "Sidebar: API Keys",
  sidebarChat: "Sidebar: Chat",
  sidebarImages: "Sidebar: AI Images",
  sidebarSettings: "Sidebar: Settings",
  sidebarSystem: "Sidebar: System",
  sidebarAdminOverview: "Sidebar: Admin Overview",
  sidebarChannels: "Sidebar: Channels",
  sidebarModels: "Sidebar: Model Config",
  sidebarUsers: "Sidebar: Users",
  groupName: "Group name",
  groupMultiplier: "Group multiplier",
  groupNamePlaceholder: "For example, vip",
  groupMultiplierPlaceholder: "Multiplier, for example 0.8",
  createGroup: "Create group",
  updateGroup: "Update group",
  cancelEdit: "Cancel edit",
  groupSaved: "Group saved",
  groupSaveFailed: "Failed to save group",
  groupDeleted: "Group deleted",
  groupDeleteFailed: "Failed to delete group, it may still be in use",
  noGroups: "No groups",
  redeemCodes: "Redeem Codes",
  redeemCode: "Redeem code",
  redeemCodePlaceholder: "Empty to auto-generate",
  redeemAmountPlaceholder: "Balance amount",
  redeemMaxUsesPlaceholder: "Uses",
  groupGrant: "Group grant",
  noGroupGrant: "No group grant",
  groupDuration: "Group duration",
  groupDurationPlaceholder: "Days, 0 means permanent",
  allowStacking: "Allow duration stacking",
  permanent: "Permanent",
  days: " days",
  createRedeemCode: "Create code",
  downloadSelected: "Download selected",
  selectedCount: "{count} selected",
  redeemSearchPlaceholder: "Search redeem codes",
  filterAllStatus: "All statuses",
  filterEnabled: "Enabled",
  filterDisabled: "Disabled",
  filterExpired: "Expired",
  filterUsedUp: "Used up",
  filterAllGroups: "All groups",
  sortCreatedDesc: "Newest first",
  sortCreatedAsc: "Oldest first",
  sortCodeAsc: "Code A-Z",
  sortAmountDesc: "Amount high to low",
  sortUsedDesc: "Most used first",
  sortExpiresAsc: "Expires soonest",
  redeemCodeCreated: "Redeem code created",
  redeemCodeCreateFailed: "Failed to create redeem code",
  redeemCodeUpdated: "Redeem code updated",
  redeemCodeUpdateFailed: "Failed to update redeem code",
  redeemCodeDeleted: "Redeem code deleted",
  redeemCodeDeleteFailed: "Failed to delete redeem code",
  noRedeemCodes: "No redeem codes",
  amount: "Amount",
  usage: "Usage",
  expiresAt: "Expires",
  status: "Status",
  enabled: "Enabled",
}
