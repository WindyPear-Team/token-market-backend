import { Activity, BarChart3, Database, DollarSign, LineChart, PieChart, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface PlatformStats {
  users: number
  channels: number
  total_cost?: string | number
  today_requests: number
}

interface TokenLog {
  id: number
  user_channel_id?: number | null
  channel_id: number
  model_name: string
  input_tokens: number
  output_tokens: number
  cost: string | number
  created_at: string
}

interface UpstreamChannel {
  id: number
  name: string
  user_channel_id?: number | null
  user_channel?: {
    id: number
    name: string
  }
}

interface StatCard {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
}

export default function AdminOverview() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ["stats", "admin"],
    queryFn: async () => {
      const res = await api.get("/stats")
      return res.data
    },
  })
  const { data: logs = [] } = useQuery<TokenLog[]>({
    queryKey: ["logs", "admin", "overview"],
    queryFn: async () => {
      const res = await api.get("/logs")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: channels = [] } = useQuery<UpstreamChannel[]>({
    queryKey: ["admin-upstream-channels"],
    queryFn: async () => {
      const res = await api.get("/channels")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const hourlySpend = buildHourlySpend(logs)
  const dailyTrend = buildDailyTrend(logs)
  const modelTrend = buildModelTrend(logs)
  const tokenUsage = buildTokenUsage(logs)
  const channelSpend = buildChannelSpend(logs, channels)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {platformCards(copy, stats, logs).map((card) => (
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
          <CardTitle>{copy.hourlySpend}</CardTitle>
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <HourlySpendChart data={hourlySpend} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{copy.dailyTrend}</CardTitle>
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <DailyTrendChart data={dailyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{copy.modelTrend}</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ModelTrendChart data={modelTrend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{copy.channelSpend}</CardTitle>
            <Database className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <RankedSpendChart data={channelSpend} emptyText={copy.noData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{copy.tokenUsage}</CardTitle>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TokenUsageChart data={tokenUsage} copy={copy} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function platformCards(copy: AdminOverviewCopy, stats?: PlatformStats, logs: TokenLog[] = []): StatCard[] {
  const oneMinuteAgo = Date.now() - 60_000
  const recentLogs = logs.filter((log) => new Date(log.created_at).getTime() >= oneMinuteAgo)
  const tpm = recentLogs.reduce((sum, log) => sum + Number(log.input_tokens || 0) + Number(log.output_tokens || 0), 0)
  return [
    { title: copy.users, value: stats?.users || 0, icon: Users, color: "text-blue-500" },
    { title: copy.channels, value: stats?.channels || 0, icon: Database, color: "text-green-500" },
    { title: copy.todayRequests, value: stats?.today_requests || 0, icon: Activity, color: "text-purple-500" },
    { title: copy.totalCost, value: `$${stats?.total_cost || 0}`, icon: DollarSign, color: "text-yellow-500" },
    { title: "RPM", value: recentLogs.length, icon: BarChart3, color: "text-cyan-500" },
    { title: "TPM", value: tpm, icon: LineChart, color: "text-pink-500" },
  ]
}

interface HourSpend {
  hour: number
  cost: number
}

function HourlySpendChart({ data }: { data: HourSpend[] }) {
  const maxCost = Math.max(...data.map((item) => item.cost), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="flex h-40 min-w-[520px] items-end gap-1 rounded-md border p-3">
          {data.map((item) => {
            const height = maxCost > 0 ? Math.max(4, (item.cost / maxCost) * 128) : 4
            return (
              <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t bg-primary/80" style={{ height }} title={`${hourLabel(item.hour)} $${item.cost.toFixed(4)}`} />
                <div className="h-4 text-[10px] text-muted-foreground">{item.hour % 3 === 0 ? String(item.hour).padStart(2, "0") : ""}</div>
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

function buildHourlySpend(logs: TokenLog[]): HourSpend[] {
  const data = Array.from({ length: 24 }, (_, hour) => ({ hour, cost: 0 }))
  for (const log of logs) {
    const hour = new Date(log.created_at).getHours()
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      data[hour].cost += Number(log.cost || 0)
    }
  }
  return data
}

interface DailySpend {
  date: Date
  cost: number
  requests: number
}

function DailyTrendChart({ data }: { data: DailySpend[] }) {
  const maxCost = Math.max(...data.map((item) => item.cost), 0)
  return (
    <div className="overflow-x-auto">
      <div className="flex h-44 min-w-[360px] items-end gap-2 rounded-md border p-3">
        {data.map((item) => {
          const height = maxCost > 0 ? Math.max(4, (item.cost / maxCost) * 132) : 4
          return (
            <div key={item.date.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="text-[10px] text-muted-foreground">{item.requests}</div>
              <div className="w-full max-w-10 rounded-t bg-green-500/80" style={{ height }} title={`${dateLabel(item.date)} $${item.cost.toFixed(4)} / ${item.requests}`} />
              <div className="h-4 text-[10px] text-muted-foreground">{shortDateLabel(item.date)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildDailyTrend(logs: TokenLog[]): DailySpend[] {
  const days = recentDays(7)
  const keyed = new Map(days.map((date) => [dateKey(date), { date, cost: 0, requests: 0 }]))
  for (const log of logs) {
    const item = keyed.get(dateKey(new Date(log.created_at)))
    if (item) {
      item.cost += Number(log.cost || 0)
      item.requests += 1
    }
  }
  return days.map((date) => keyed.get(dateKey(date)) || { date, cost: 0, requests: 0 })
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
                    return <div key={modelName} style={{ height: segmentHeight, backgroundColor: chartColors[index % chartColors.length] }} title={`${modelName}: ${count}`} />
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

function buildModelTrend(logs: TokenLog[]): ModelTrend {
  const days = recentDays(7)
  const totals = new Map<string, number>()
  for (const log of logs) {
    const modelName = log.model_name || "-"
    totals.set(modelName, (totals.get(modelName) || 0) + 1)
  }
  const models = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([modelName]) => modelName)
  if (totals.size > models.length) {
    models.push("Other")
  }

  const modelSet = new Set(models)
  const keyed = new Map(days.map((date) => [dateKey(date), { date, counts: {}, total: 0 } as DailyModelCall]))
  for (const log of logs) {
    const day = keyed.get(dateKey(new Date(log.created_at)))
    if (!day) {
      continue
    }
    const modelName = modelSet.has(log.model_name) ? log.model_name : "Other"
    day.counts[modelName] = (day.counts[modelName] || 0) + 1
    day.total += 1
  }
  return { days: days.map((date) => keyed.get(dateKey(date)) || { date, counts: {}, total: 0 }), models }
}

interface RankedSpend {
  label: string
  cost: number
  requests: number
}

function RankedSpendChart({ data, emptyText }: { data: RankedSpend[]; emptyText: string }) {
  const maxCost = Math.max(...data.map((item) => item.cost), 0)
  if (data.length === 0) {
    return <div className="rounded-md border px-3 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
  }
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium">{item.label}</span>
            <span className="shrink-0 text-muted-foreground">${item.cost.toFixed(4)} / {item.requests}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${maxCost > 0 ? Math.max(3, (item.cost / maxCost) * 100) : 3}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function buildChannelSpend(logs: TokenLog[], channels: UpstreamChannel[]): RankedSpend[] {
  const channelNames = new Map<number, string>()
  const userChannelNames = new Map<number, string>()
  for (const channel of channels) {
    channelNames.set(channel.id, channel.name)
    if (channel.user_channel_id && channel.user_channel?.name) {
      userChannelNames.set(channel.user_channel_id, channel.user_channel.name)
    }
  }

  const keyed = new Map<string, RankedSpend>()
  for (const log of logs) {
    const label = log.user_channel_id
      ? userChannelNames.get(log.user_channel_id) || `User channel ${log.user_channel_id}`
      : channelNames.get(log.channel_id) || `Channel ${log.channel_id}`
    const item = keyed.get(label) || { label, cost: 0, requests: 0 }
    item.cost += Number(log.cost || 0)
    item.requests += 1
    keyed.set(label, item)
  }
  return Array.from(keyed.values()).sort((a, b) => b.cost - a.cost).slice(0, 8)
}

interface TokenUsage {
  input: number
  output: number
}

function TokenUsageChart({ data, copy }: { data: TokenUsage; copy: AdminOverviewCopy }) {
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
          <div className="text-xs text-muted-foreground">{copy.inputTokens}</div>
          <div className="mt-1 text-xl font-semibold">{data.input}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{copy.outputTokens}</div>
          <div className="mt-1 text-xl font-semibold">{data.output}</div>
        </div>
      </div>
    </div>
  )
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

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}

type AdminOverviewCopy = typeof zhCopy

const zhCopy = {
  title: "管理员概览",
  subtitle: "平台调用、消费和模型使用情况",
  users: "用户数",
  channels: "上级渠道数",
  todayRequests: "今日请求",
  totalCost: "平台总消费",
  hourlySpend: "按小时消费",
  dailyTrend: "7 日调用趋势",
  modelTrend: "模型调用趋势",
  channelSpend: "用户渠道消费",
  tokenUsage: "Token 使用分布",
  inputTokens: "输入 Token",
  outputTokens: "输出 Token",
  noData: "暂无数据",
}

const enCopy: AdminOverviewCopy = {
  title: "Admin Overview",
  subtitle: "Platform calls, spend, and model usage",
  users: "Users",
  channels: "Upstream Channels",
  todayRequests: "Today Requests",
  totalCost: "Platform Cost",
  hourlySpend: "Hourly Spend",
  dailyTrend: "7-Day Call Trend",
  modelTrend: "Model Call Trend",
  channelSpend: "User Channel Spend",
  tokenUsage: "Token Usage",
  inputTokens: "Input Tokens",
  outputTokens: "Output Tokens",
  noData: "No data",
}

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"]
