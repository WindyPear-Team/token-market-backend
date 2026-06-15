import { Activity, BarChart3, CreditCard, Database, DollarSign, LineChart, PieChart } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"

interface CurrentUser {
  username: string
  balance: string | number
}

interface UserStats {
  balance: string | number
  total_requests: number
  today_requests: number
  total_cost: string | number
  rpm: number
  tpm: number
}

interface TokenLog {
  id: number
  created_at: string
  cost: string | number
  model_name: string
  input_tokens: number
  output_tokens: number
}

interface StatCard {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
}

export default function Dashboard() {
  const { t } = useI18n()
  const { data: user, isLoading: isUserLoading } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["stats", "user"],
    queryFn: async () => {
      const res = await api.get("/user/stats")
      return res.data
    },
  })
  const { data: logs = [] } = useQuery<TokenLog[]>({
    queryKey: ["logs", "user", "dashboard"],
    queryFn: async () => {
      const res = await api.get("/user/logs")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const currencyDisplayName = withPublicSettingsDefaults(settings).payment_currency_display_name
  const hourlySpend = buildHourlySpend(logs)
  const dailyTrend = buildDailyTrend(logs)
  const modelTrend = buildModelTrend(logs)
  const tokenUsage = buildTokenUsage(logs)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.signedInAs")} {user?.username || t("common.user")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {(isUserLoading ? userCards(t, currencyDisplayName) : userCards(t, currencyDisplayName, userStats, user)).map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.hourlySpend")}</CardTitle>
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <HourlySpendChart data={hourlySpend} currencyDisplayName={currencyDisplayName} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.dailyTrend")}</CardTitle>
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <DailyTrendChart data={dailyTrend} currencyDisplayName={currencyDisplayName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.modelTrend")}</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ModelTrendChart data={modelTrend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.tokenUsage")}</CardTitle>
          <PieChart className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <TokenUsageChart data={tokenUsage} />
        </CardContent>
      </Card>
    </div>
  )
}

function userCards(t: ReturnType<typeof useI18n>["t"], currencyDisplayName: string, stats?: UserStats, user?: CurrentUser): StatCard[] {
  return [
    { title: t("common.balance"), value: `${currencyDisplayName}${stats?.balance ?? user?.balance ?? 0}`, icon: CreditCard, color: "text-blue-500" },
    { title: t("dashboard.todayRequests"), value: stats?.today_requests || 0, icon: Activity, color: "text-green-500" },
    { title: t("dashboard.totalRequests"), value: stats?.total_requests || 0, icon: Database, color: "text-purple-500" },
    { title: t("dashboard.rpm"), value: stats?.rpm || 0, icon: BarChart3, color: "text-cyan-500" },
    { title: t("dashboard.tpm"), value: stats?.tpm || 0, icon: LineChart, color: "text-pink-500" },
    { title: t("dashboard.totalCost"), value: `${currencyDisplayName}${stats?.total_cost || 0}`, icon: DollarSign, color: "text-yellow-500" },
  ]
}

function HourlySpendChart({ data, currencyDisplayName }: { data: HourSpend[]; currencyDisplayName: string }) {
  const maxCost = Math.max(...data.map((item) => item.cost), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="flex h-40 min-w-[520px] items-end gap-1 rounded-md border p-3">
          {data.map((item) => {
            const height = maxCost > 0 ? Math.max(4, (item.cost / maxCost) * 128) : 4
            return (
              <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height }}
                  title={`${hourLabel(item.hour)} ${currencyDisplayName}${item.cost.toFixed(4)}`}
                />
                <div className="h-4 text-[10px] text-muted-foreground">
                  {item.hour % 3 === 0 ? String(item.hour).padStart(2, "0") : ""}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>00:00</span>
        <span>12:00</span>
        <span>23:00</span>
      </div>
    </div>
  )
}

interface HourSpend {
  hour: number
  cost: number
}

function buildHourlySpend(logs: TokenLog[]): HourSpend[] {
  const data = Array.from({ length: 24 }, (_, hour) => ({ hour, cost: 0 }))
  for (const log of logs) {
    const hour = new Date(log.created_at).getHours()
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      continue
    }
    data[hour].cost += Number(log.cost || 0)
  }
  return data
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}

interface DailySpend {
  date: Date
  cost: number
  requests: number
}

function DailyTrendChart({ data, currencyDisplayName }: { data: DailySpend[]; currencyDisplayName: string }) {
  const maxCost = Math.max(...data.map((item) => item.cost), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="flex h-44 min-w-[360px] items-end gap-2 rounded-md border p-3">
          {data.map((item) => {
            const height = maxCost > 0 ? Math.max(4, (item.cost / maxCost) * 132) : 4
            return (
              <div key={item.date.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="text-[10px] text-muted-foreground">{item.requests}</div>
                <div
                  className="w-full max-w-10 rounded-t bg-green-500/80"
                  style={{ height }}
                  title={`${dateLabel(item.date)} ${currencyDisplayName}${item.cost.toFixed(4)} / ${item.requests}`}
                />
                <div className="h-4 text-[10px] text-muted-foreground">{shortDateLabel(item.date)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface ModelTrend {
  days: DailyModelCall[]
  models: string[]
}

interface DailyModelCall {
  date: Date
  counts: Record<string, number>
  total: number
}

function ModelTrendChart({ data }: { data: ModelTrend }) {
  const maxTotal = Math.max(...data.days.map((item) => item.total), 0)
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="flex h-44 min-w-[360px] items-end gap-2 rounded-md border p-3">
          {data.days.map((day) => {
            const height = maxTotal > 0 ? Math.max(4, (day.total / maxTotal) * 132) : 4
            return (
              <div key={day.date.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t" style={{ height }}>
                  {data.models.map((modelName, index) => {
                    const count = day.counts[modelName] || 0
                    const segmentHeight = day.total > 0 ? (count / day.total) * height : 0
                    return (
                      <div
                        key={modelName}
                        style={{ height: segmentHeight, backgroundColor: chartColors[index % chartColors.length] }}
                        title={`${modelName}: ${count}`}
                      />
                    )
                  })}
                </div>
                <div className="h-4 text-[10px] text-muted-foreground">{shortDateLabel(day.date)}</div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {data.models.map((modelName, index) => (
          <span key={modelName} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            {modelName}
          </span>
        ))}
      </div>
    </div>
  )
}

interface TokenUsage {
  input: number
  output: number
}

function TokenUsageChart({ data }: { data: TokenUsage }) {
  const { t } = useI18n()
  const total = data.input + data.output
  const inputPercent = total > 0 ? (data.input / total) * 100 : 0
  const outputPercent = total > 0 ? (data.output / total) * 100 : 0
  return (
    <div className="space-y-4">
      <div className="flex h-6 overflow-hidden rounded-md border">
        <div className="bg-blue-500" style={{ width: `${inputPercent}%` }} title={`${data.input}`} />
        <div className="bg-amber-500" style={{ width: `${outputPercent}%` }} title={`${data.output}`} />
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t("dashboard.inputTokens")}</div>
          <div className="mt-1 text-xl font-semibold">{data.input}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t("dashboard.outputTokens")}</div>
          <div className="mt-1 text-xl font-semibold">{data.output}</div>
        </div>
      </div>
    </div>
  )
}

function buildDailyTrend(logs: TokenLog[]): DailySpend[] {
  const days = recentDays(7)
  const keyed = new Map(days.map((date) => [dateKey(date), { date, cost: 0, requests: 0 }]))
  for (const log of logs) {
    const key = dateKey(new Date(log.created_at))
    const item = keyed.get(key)
    if (!item) {
      continue
    }
    item.cost += Number(log.cost || 0)
    item.requests += 1
  }
  return days.map((date) => keyed.get(dateKey(date)) || { date, cost: 0, requests: 0 })
}

function buildModelTrend(logs: TokenLog[]): ModelTrend {
  const days = recentDays(7)
  const modelTotals = new Map<string, number>()
  for (const log of logs) {
    const modelName = log.model_name || "-"
    modelTotals.set(modelName, (modelTotals.get(modelName) || 0) + 1)
  }
  const models = Array.from(modelTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([modelName]) => modelName)
  if (modelTotals.size > models.length) {
    models.push("Other")
  }
  const modelSet = new Set(models)
  const keyed = new Map(days.map((date) => [dateKey(date), { date, counts: {}, total: 0 } as DailyModelCall]))
  for (const log of logs) {
    const key = dateKey(new Date(log.created_at))
    const day = keyed.get(key)
    if (!day) {
      continue
    }
    const modelName = modelSet.has(log.model_name) ? log.model_name : "Other"
    day.counts[modelName] = (day.counts[modelName] || 0) + 1
    day.total += 1
  }
  return {
    days: days.map((date) => keyed.get(dateKey(date)) || { date, counts: {}, total: 0 }),
    models,
  }
}

function buildTokenUsage(logs: TokenLog[]): TokenUsage {
  return logs.reduce<TokenUsage>(
    (total, log) => ({
      input: total.input + Number(log.input_tokens || 0),
      output: total.output + Number(log.output_tokens || 0),
    }),
    { input: 0, output: 0 }
  )
}

function recentDays(count: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - count + 1 + index)
    return date
  })
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function shortDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function dateLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"]
