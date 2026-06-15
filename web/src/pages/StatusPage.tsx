import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicTopBar } from "@/components/layout/PublicTopBar"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"

interface StatusCheck {
  status: string
  latency_ms: number
  checked_at: string
}

interface PublicStatusMonitor {
  id: number
  name: string
  status: string
  latency_ms: number
  last_checked_at?: string | null
  uptime: number
  recent_checks: StatusCheck[]
}

interface PublicStatusResponse {
  enabled: boolean
  generated_at: string
  monitors: PublicStatusMonitor[]
}

export default function StatusPage() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const { data, isLoading, isError } = useQuery<PublicStatusResponse>({
    queryKey: ["public-status"],
    queryFn: async () => {
      const res = await api.get("/public/status")
      return res.data
    },
    refetchInterval: 30000,
    retry: false,
  })

  const monitors = data?.monitors || []
  const downCount = monitors.filter((monitor) => monitor.status === "down").length
  const pendingCount = monitors.filter((monitor) => !monitor.last_checked_at || monitor.status === "pending").length
  const overallStatus = downCount > 0 ? "down" : pendingCount > 0 ? "pending" : "up"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicTopBar settings={publicSettings} />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{copy.title}</h1>
            <div className="mt-2 text-sm text-muted-foreground">{copy.updatedAt}: {formatDateTime(data?.generated_at)}</div>
          </div>
          <OverallBadge status={overallStatus} copy={copy} />
        </div>

        {isLoading ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">{copy.loading}</div>
        ) : isError ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">{copy.disabled}</div>
        ) : monitors.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">{copy.empty}</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard icon={CheckCircle2} label={copy.upNodes} value={String(monitors.length - downCount - pendingCount)} />
              <SummaryCard icon={AlertTriangle} label={copy.downNodes} value={String(downCount)} />
              <SummaryCard icon={Clock} label={copy.pendingNodes} value={String(pendingCount)} />
            </div>
            <div className="grid gap-4">
              {monitors.map((monitor) => (
                <Card key={monitor.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg">{monitor.name}</CardTitle>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {copy.lastCheck}: {formatDateTime(monitor.last_checked_at)} · {copy.latency}: {formatLatency(monitor.latency_ms)}
                        </div>
                      </div>
                      <div className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(monitor.status)}`}>
                        {statusLabel(monitor.status, copy)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{copy.uptime}</span>
                      <span className="font-medium">{formatPercent(monitor.uptime)}</span>
                    </div>
                    <StatusBars checks={monitor.recent_checks} copy={copy} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
      {publicSettings.footer_text && (
        <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground sm:px-6">
          {publicSettings.footer_text}
        </footer>
      )}
    </div>
  )
}

function OverallBadge({ status, copy }: { status: string; copy: StatusCopy }) {
  const Icon = status === "up" ? CheckCircle2 : status === "down" ? AlertTriangle : Activity
  return (
    <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${statusBadgeClass(status)}`}>
      <Icon size={16} />
      {status === "up" ? copy.allOperational : status === "down" ? copy.hasIncident : copy.pending}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  )
}

function StatusBars({ checks, copy }: { checks: StatusCheck[]; copy: StatusCopy }) {
  const visibleChecks = checks.length > 0 ? checks.slice(-60) : Array.from({ length: 20 }, () => ({ status: "pending", latency_ms: 0, checked_at: "" }))
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(6px,1fr))] gap-1">
      {visibleChecks.map((check, index) => (
        <div
          key={`${check.checked_at}-${index}`}
          className={`h-8 rounded-sm ${statusBarClass(check.status)}`}
          title={check.checked_at ? `${statusLabel(check.status, copy)} · ${formatLatency(check.latency_ms)} · ${formatDateTime(check.checked_at)}` : undefined}
        />
      ))}
    </div>
  )
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

function statusBarClass(status: string) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return "bg-emerald-500"
    case "down":
      return "bg-red-500"
    default:
      return "bg-amber-400"
  }
}

function statusLabel(status: string, copy: StatusCopy) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return copy.up
    case "down":
      return copy.down
    default:
      return copy.pending
  }
}

function formatLatency(value: number) {
  if (!value || value <= 0) {
    return "-"
  }
  return `${value}ms`
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "-"
  }
  return `${value.toFixed(2)}%`
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

type StatusCopy = typeof zhCopy

const zhCopy = {
  title: "状态监测",
  loading: "正在加载状态",
  disabled: "状态页未开启",
  empty: "暂无公开监测节点",
  updatedAt: "更新时间",
  allOperational: "全部正常",
  hasIncident: "存在故障",
  upNodes: "正常节点",
  downNodes: "故障节点",
  pendingNodes: "等待检测",
  lastCheck: "最近检测",
  latency: "延迟",
  uptime: "可用率",
  up: "正常",
  down: "故障",
  pending: "等待",
}

const enCopy: StatusCopy = {
  title: "Status",
  loading: "Loading status",
  disabled: "Status page is disabled",
  empty: "No public monitors",
  updatedAt: "Updated",
  allOperational: "All operational",
  hasIncident: "Incident detected",
  upNodes: "Up",
  downNodes: "Down",
  pendingNodes: "Pending",
  lastCheck: "Last check",
  latency: "Latency",
  uptime: "Uptime",
  up: "Up",
  down: "Down",
  pending: "Pending",
}
