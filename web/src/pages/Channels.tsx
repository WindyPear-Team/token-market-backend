import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Edit, ListTree, Plus, Power, SlidersHorizontal, Trash } from "lucide-react"
import type { AxiosError } from "axios"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface UserChannel {
  id: number
  name: string
  description: string
  multiplier: string | number
  routing_algorithm: string
  enabled: boolean
}

interface Group {
  id: number
  name: string
  multiplier: string | number
}

interface GroupMultiplier {
  id?: number
  group_id: number
  group?: Group
  multiplier: string | number
}

interface UpstreamChannel {
  id: number
  user_channel_id?: number | null
  user_channel?: UserChannel
  name: string
  type: string
  base_url: string
  api_key: string
  priority: number
  weight: number
  enabled: boolean
  group_multipliers?: GroupMultiplier[]
}

interface ChannelModelConfig {
  id: number
  channel_id: number
  model_id: number
  model_name: string
  upstream_model_name: string
  provider: string
  provider_icon_url: string
  enabled: boolean
  group_multipliers?: GroupMultiplier[]
}

interface SyncResult {
  channel_id: number
  channel_name: string
  source: string
  created: number
  updated: number
  error?: string
}

interface SyncPreviewItem {
  model_name: string
  provider: string
  provider_name: string
  provider_icon_url: string
  exists: boolean
}

interface SyncPreview {
  channel_id: number
  channel_name: string
  source: string
  models: SyncPreviewItem[]
}

interface BrowserSyncFallback {
  channel: UpstreamChannel
  url: string
  source: string
  error: string
  includeToken: boolean
  manualPayload: string
}

interface UsageStats {
  request_count: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: string | number
}

interface ChannelUsageResponse {
  user_channels: UserChannelUsage[]
  upstream_channels: UpstreamChannelUsage[]
}

interface UserChannelUsage extends UsageStats {
  id: number
  name: string
  routing_algorithm: string
}

interface UpstreamChannelUsage extends UsageStats {
  id: number
  name: string
  user_channel_id?: number | null
  user_channel_name: string
}

export default function Channels() {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy
  const queryClient = useQueryClient()
  const [status, setStatus] = useState("")
  const [editingUserChannel, setEditingUserChannel] = useState<Partial<UserChannel> | null>(null)
  const [editingUpstream, setEditingUpstream] = useState<Partial<UpstreamChannel> | null>(null)
  const [editingMultipliers, setEditingMultipliers] = useState<UpstreamChannel | null>(null)
  const [modelChannel, setModelChannel] = useState<UpstreamChannel | null>(null)

  const { data: userChannels = [], isLoading: isUserChannelsLoading } = useQuery<UserChannel[]>({
    queryKey: ["admin-user-channels"],
    queryFn: async () => {
      const res = await api.get("/user-channels")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: upstreamChannels = [], isLoading: isUpstreamsLoading } = useQuery<UpstreamChannel[]>({
    queryKey: ["admin-upstream-channels"],
    queryFn: async () => {
      const res = await api.get("/channels")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await api.get("/groups")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: channelUsage = emptyChannelUsage() } = useQuery<ChannelUsageResponse>({
    queryKey: ["admin-channel-usage"],
    queryFn: async () => {
      const res = await api.get("/channel-usage")
      return normalizeChannelUsageResponse(res.data)
    },
  })

  const saveUserChannel = useMutation({
    mutationFn: async (channel: Partial<UserChannel>) => {
      const payload = userChannelPayload(channel)
      if (channel.id) {
        const res = await api.put(`/user-channels/${channel.id}`, payload)
        return res.data
      }
      const res = await api.post("/user-channels", payload)
      return res.data
    },
    onSuccess: () => {
      setStatus(t("admin.saved"))
      setEditingUserChannel(null)
      queryClient.invalidateQueries({ queryKey: ["admin-user-channels"] })
      queryClient.invalidateQueries({ queryKey: ["admin-channel-usage"] })
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
    },
    onError: () => setStatus(t("admin.saveFailed")),
  })

  const deleteUserChannel = useMutation({
    mutationFn: async (id: number) => api.delete(`/user-channels/${id}`),
    onSuccess: () => {
      setStatus(t("admin.deleted"))
      queryClient.invalidateQueries({ queryKey: ["admin-user-channels"] })
      queryClient.invalidateQueries({ queryKey: ["admin-channel-usage"] })
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
    },
    onError: () => setStatus(t("admin.deleteFailed")),
  })

  const saveUpstream = useMutation({
    mutationFn: async (channel: Partial<UpstreamChannel>) => {
      const payload = upstreamPayload(channel)
      if (channel.id) {
        const res = await api.put(`/channels/${channel.id}`, payload)
        return res.data
      }
      const res = await api.post("/channels", payload)
      return res.data
    },
    onSuccess: () => {
      setStatus(t("admin.saved"))
      setEditingUpstream(null)
      queryClient.invalidateQueries({ queryKey: ["admin-upstream-channels"] })
      queryClient.invalidateQueries({ queryKey: ["admin-channel-usage"] })
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
    },
    onError: () => setStatus(t("admin.saveFailed")),
  })

  const deleteUpstream = useMutation({
    mutationFn: async (id: number) => api.delete(`/channels/${id}`),
    onSuccess: () => {
      setStatus(t("admin.deleted"))
      queryClient.invalidateQueries({ queryKey: ["admin-upstream-channels"] })
      queryClient.invalidateQueries({ queryKey: ["admin-channel-usage"] })
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
    },
    onError: () => setStatus(t("admin.deleteFailed")),
  })

  const toggleUpstream = useMutation({
    mutationFn: async (channel: UpstreamChannel) => {
      const res = await api.put(`/channels/${channel.id}`, upstreamPayload({ ...channel, enabled: !channel.enabled }))
      return res.data
    },
    onSuccess: () => {
      setStatus(t("admin.saved"))
      queryClient.invalidateQueries({ queryKey: ["admin-upstream-channels"] })
      queryClient.invalidateQueries({ queryKey: ["admin-channel-usage"] })
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
    },
    onError: () => setStatus(t("admin.saveFailed")),
  })

  const saveGroupMultipliers = useMutation({
    mutationFn: async ({ channelID, multipliers }: { channelID: number; multipliers: GroupMultiplier[] }) => {
      const res = await api.put(`/channels/${channelID}/group-multipliers`, multipliers.map((item) => ({
        group_id: item.group_id,
        multiplier: Number(item.multiplier || 0),
      })))
      return res.data
    },
    onSuccess: () => {
      setStatus(copy.groupMultipliersSaved)
      setEditingMultipliers(null)
      queryClient.invalidateQueries({ queryKey: ["admin-upstream-channels"] })
    },
    onError: () => setStatus(copy.groupMultipliersSaveFailed),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("channels.title")}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{t("admin.channelsSubtitle")}</div>
        </div>
        <div className="text-sm text-muted-foreground">{status}</div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("admin.userChannels")}</CardTitle>
          <Button className="gap-2" onClick={() => setEditingUserChannel(emptyUserChannel())}>
            <Plus size={16} />
            {t("admin.addUserChannel")}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("channels.name")}</TableHead>
                <TableHead>{t("admin.description")}</TableHead>
                <TableHead>{t("channels.multiplier")}</TableHead>
                <TableHead>{copy.routingAlgorithm}</TableHead>
                <TableHead>{copy.requests}</TableHead>
                <TableHead>{copy.tokens}</TableHead>
                <TableHead>{copy.cost}</TableHead>
                <TableHead>{t("channels.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUserChannelsLoading ? (
                <EmptyRow colSpan={9} text={t("common.loading")} />
              ) : userChannels.length === 0 ? (
                <EmptyRow colSpan={9} text={t("admin.noUserChannels")} />
              ) : (
                userChannels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>{channel.description || "-"}</TableCell>
                    <TableCell>{channel.multiplier || 1}</TableCell>
                    <TableCell>{routingAlgorithmLabel(channel.routing_algorithm, copy)}</TableCell>
                    <TableCell>{formatInteger(usageForUserChannel(channelUsage, channel.id).request_count)}</TableCell>
                    <TableCell>{formatInteger(usageForUserChannel(channelUsage, channel.id).total_tokens)}</TableCell>
                    <TableCell>{formatCost(usageForUserChannel(channelUsage, channel.id).total_cost)}</TableCell>
                    <TableCell>
                      <StatusBadge enabled={channel.enabled} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => setEditingUserChannel(channel)} title={t("common.edit")}>
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteUserChannel.mutate(channel.id)}
                        title={t("common.delete")}
                      >
                        <Trash size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("admin.upstreamChannels")}</CardTitle>
          <Button className="gap-2" onClick={() => setEditingUpstream(emptyUpstream(userChannels[0]?.id))}>
            <Plus size={16} />
            {t("admin.addUpstream")}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("channels.name")}</TableHead>
                <TableHead>{t("admin.userChannel")}</TableHead>
                <TableHead>{t("channels.type")}</TableHead>
                <TableHead>{t("admin.baseURL")}</TableHead>
                <TableHead>{t("channels.priority")}</TableHead>
                <TableHead>{t("admin.weight")}</TableHead>
                <TableHead>{copy.requests}</TableHead>
                <TableHead>{copy.tokens}</TableHead>
                <TableHead>{copy.cost}</TableHead>
                <TableHead>{t("channels.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUpstreamsLoading ? (
                <EmptyRow colSpan={11} text={t("common.loading")} />
              ) : upstreamChannels.length === 0 ? (
                <EmptyRow colSpan={11} text={t("channels.noChannels")} />
              ) : (
                upstreamChannels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>{channel.user_channel?.name || userChannelName(userChannels, channel.user_channel_id)}</TableCell>
                    <TableCell>{channel.type}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{channel.base_url}</TableCell>
                    <TableCell>{channel.priority}</TableCell>
                    <TableCell>{channel.weight}</TableCell>
                    <TableCell>{formatInteger(usageForUpstreamChannel(channelUsage, channel.id).request_count)}</TableCell>
                    <TableCell>{formatInteger(usageForUpstreamChannel(channelUsage, channel.id).total_tokens)}</TableCell>
                    <TableCell>{formatCost(usageForUpstreamChannel(channelUsage, channel.id).total_cost)}</TableCell>
                    <TableCell>
                      <StatusBadge enabled={channel.enabled} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => setModelChannel(channel)} title={copy.modelConfigs}>
                        <ListTree size={14} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setEditingMultipliers(channel)} title={copy.groupMultipliers}>
                        <SlidersHorizontal size={14} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => toggleUpstream.mutate(channel)} title={channel.enabled ? t("common.disabled") : t("common.enabled")}>
                        <Power size={14} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setEditingUpstream(channel)} title={t("common.edit")}>
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteUpstream.mutate(channel.id)}
                        title={t("common.delete")}
                      >
                        <Trash size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserChannelDialog
        channel={editingUserChannel}
        onClose={() => setEditingUserChannel(null)}
        onSave={(channel) => saveUserChannel.mutate(channel)}
      />
      <UpstreamDialog
        channel={editingUpstream}
        userChannels={userChannels}
        onClose={() => setEditingUpstream(null)}
        onSave={(channel) => saveUpstream.mutate(channel)}
      />
      <UpstreamModelConfigDialog
        channel={modelChannel}
        groups={groups}
        onClose={() => setModelChannel(null)}
        onStatus={setStatus}
      />
      <GroupMultiplierDialog
        title={copy.groupMultipliers}
        subject={editingMultipliers?.name || ""}
        groups={groups}
        multipliers={editingMultipliers?.group_multipliers || []}
        open={Boolean(editingMultipliers)}
        onClose={() => setEditingMultipliers(null)}
        onSave={(multipliers) => {
          if (editingMultipliers) {
            saveGroupMultipliers.mutate({ channelID: editingMultipliers.id, multipliers })
          }
        }}
      />
    </div>
  )
}

function UserChannelDialog({
  channel,
  onClose,
  onSave,
}: {
  channel: Partial<UserChannel> | null
  onClose: () => void
  onSave: (channel: Partial<UserChannel>) => void
}) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy
  const [draft, setDraft] = useState<Partial<UserChannel>>(emptyUserChannel())

  useEffect(() => {
    setDraft(channel || emptyUserChannel())
  }, [channel])

  return (
    <Dialog open={Boolean(channel)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{channel?.id ? t("admin.editUserChannel") : t("admin.addUserChannel")}</DialogTitle>
          <DialogDescription>{t("admin.userChannelsHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FieldLabel label={t("channels.name")}>
            <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("channels.name")} />
          </FieldLabel>
          <FieldLabel label={t("admin.description")}>
            <Input
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={t("admin.description")}
            />
          </FieldLabel>
          <FieldLabel label={t("channels.multiplier")}>
            <Input
              type="number"
              value={String(draft.multiplier ?? 1)}
              onChange={(e) => setDraft({ ...draft, multiplier: Number(e.target.value) })}
              placeholder={t("channels.multiplier")}
            />
          </FieldLabel>
          <FieldLabel label={copy.routingAlgorithm}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={draft.routing_algorithm || "priority"}
              onChange={(e) => setDraft({ ...draft, routing_algorithm: e.target.value })}
            >
              {routingAlgorithmOptions(copy).map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(draft.enabled)} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            {t("common.enabled")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(draft)}>{t("admin.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpstreamDialog({
  channel,
  userChannels,
  onClose,
  onSave,
}: {
  channel: Partial<UpstreamChannel> | null
  userChannels: UserChannel[]
  onClose: () => void
  onSave: (channel: Partial<UpstreamChannel>) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<Partial<UpstreamChannel>>(emptyUpstream(userChannels[0]?.id))

  useEffect(() => {
    setDraft(channel || emptyUpstream(userChannels[0]?.id))
  }, [channel, userChannels])

  return (
    <Dialog open={Boolean(channel)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{channel?.id ? t("admin.editUpstream") : t("admin.addUpstream")}</DialogTitle>
          <DialogDescription>{t("admin.upstreamHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldLabel label={t("channels.name")}>
            <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("channels.name")} />
          </FieldLabel>
          <FieldLabel label={t("channels.type")}>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={draft.type || "openai"}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            >
              {providerTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label={t("admin.baseURL")}>
            <Input value={draft.base_url || ""} onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} placeholder="https://api.example.com/v1" />
          </FieldLabel>
          <FieldLabel label="API Key">
            <Input value={draft.api_key || ""} onChange={(e) => setDraft({ ...draft, api_key: e.target.value })} placeholder="sk-..." />
          </FieldLabel>
          <FieldLabel label={t("admin.userChannel")}>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={draft.user_channel_id || ""}
              onChange={(e) => setDraft({ ...draft, user_channel_id: Number(e.target.value) || null })}
            >
              <option value="">{t("admin.selectUserChannel")}</option>
              {userChannels.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label={t("channels.priority")}>
            <Input
              type="number"
              value={String(draft.priority ?? 1)}
              onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
              placeholder={t("channels.priority")}
            />
          </FieldLabel>
          <FieldLabel label={t("admin.weight")}>
            <Input
              type="number"
              value={String(draft.weight ?? 1)}
              onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })}
              placeholder={t("admin.weight")}
            />
          </FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(draft.enabled)} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            {t("common.enabled")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(draft)}>{t("admin.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpstreamModelConfigDialog({
  channel,
  groups,
  onClose,
  onStatus,
}: {
  channel: UpstreamChannel | null
  groups: Group[]
  onClose: () => void
  onStatus: (status: string) => void
}) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy
  const queryClient = useQueryClient()
  const [editingModel, setEditingModel] = useState<Partial<ChannelModelConfig> | null>(null)
  const [editingModelMultipliers, setEditingModelMultipliers] = useState<ChannelModelConfig | null>(null)
  const [syncFormat, setSyncFormat] = useState("openai_models")
  const [customSyncPath, setCustomSyncPath] = useState("")
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null)
  const [selectedModelNames, setSelectedModelNames] = useState<string[]>([])
  const [browserFallback, setBrowserFallback] = useState<BrowserSyncFallback | null>(null)

  const { data: models = [], isLoading } = useQuery<ChannelModelConfig[]>({
    queryKey: ["channel-models", channel?.id],
    enabled: Boolean(channel?.id),
    queryFn: async () => {
      const res = await api.get(`/channels/${channel?.id}/models`)
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["channel-models", channel?.id] })
    queryClient.invalidateQueries({ queryKey: ["admin-models-page"] })
    queryClient.invalidateQueries({ queryKey: ["catalog"] })
    queryClient.invalidateQueries({ queryKey: ["public-models"] })
  }

  const saveModel = useMutation({
    mutationFn: async (model: Partial<ChannelModelConfig>) => {
      if (!channel?.id) {
        throw new Error(copy.channelRequired)
      }
      const payload = channelModelPayload({ ...model, channel_id: channel.id })
      if (model.id) {
        const res = await api.put(`/channel-models/${model.id}`, payload)
        return res.data
      }
      const res = await api.post(`/channels/${channel.id}/models`, payload)
      return res.data
    },
    onSuccess: () => {
      onStatus(t("admin.saved"))
      setEditingModel(null)
      invalidate()
    },
    onError: (error) => onStatus(error instanceof Error ? error.message : t("admin.saveFailed")),
  })

  const deleteModel = useMutation({
    mutationFn: async (id: number) => api.delete(`/channel-models/${id}`),
    onSuccess: () => {
      onStatus(t("admin.deleted"))
      invalidate()
    },
    onError: () => onStatus(t("admin.deleteFailed")),
  })

  const saveModelMultipliers = useMutation({
    mutationFn: async ({ modelID, multipliers }: { modelID: number; multipliers: GroupMultiplier[] }) => {
      const res = await api.put(`/channel-models/${modelID}/group-multipliers`, multipliers.map((item) => ({
        group_id: item.group_id,
        multiplier: Number(item.multiplier || 0),
      })))
      return res.data
    },
    onSuccess: () => {
      onStatus(copy.groupMultipliersSaved)
      setEditingModelMultipliers(null)
      invalidate()
    },
    onError: () => onStatus(copy.groupMultipliersSaveFailed),
  })

  const previewSync = useMutation({
    mutationFn: async () => {
      if (!channel?.id) {
        throw new Error(copy.channelRequired)
      }
      const res = await api.post("/models/sync/preview", {
        channel_id: channel.id,
        format: syncFormat,
        path: customSyncPath,
      })
      return res.data as SyncPreview
    },
    onSuccess: (preview) => {
      setSyncPreview(preview)
      setSelectedModelNames(preview.models.map((item) => item.model_name))
      onStatus("")
    },
    onError: (error) => {
      console.error("Model sync preview failed", error)
      onStatus(syncErrorMessage(error, copy.syncPreviewFailed))
      if (channel) {
        openBrowserFallback(channel, error)
      }
    },
  })

  const browserPreviewSync = useMutation({
    mutationFn: async ({ fallback, payload }: { fallback: BrowserSyncFallback; payload: unknown }) => {
      const res = await api.post("/models/sync/preview/browser", {
        channel_id: fallback.channel.id,
        source: fallback.source,
        payload,
      })
      return res.data as SyncPreview
    },
    onSuccess: (preview) => {
      setSyncPreview(preview)
      setSelectedModelNames(preview.models.map((item) => item.model_name))
      setBrowserFallback(null)
      onStatus("")
    },
    onError: (error) => {
      console.error("Browser model sync preview failed", error)
      onStatus(syncErrorMessage(error, copy.browserPreviewFailed))
    },
  })

  const applySync = useMutation({
    mutationFn: async () => {
      if (!syncPreview) {
        return []
      }
      const selectedModels = syncPreview.models.filter((item) => selectedModelNames.includes(item.model_name))
      const res = await api.post("/models/sync/apply", {
        channel_id: syncPreview.channel_id,
        models: selectedModels,
      })
      return Array.isArray(res.data?.results) ? res.data.results as SyncResult[] : []
    },
    onSuccess: (results) => {
      onStatus(syncSummary(results, t))
      setSyncPreview(null)
      setSelectedModelNames([])
      invalidate()
    },
    onError: (error) => {
      console.error("Model sync apply failed", error)
      onStatus(syncErrorMessage(error, copy.syncFailed))
    },
  })

  const openBrowserFallback = (targetChannel: UpstreamChannel, error: unknown) => {
    const nextFallback = browserFallbackForChannel(targetChannel, syncFormat, customSyncPath, syncErrorMessage(error, copy.syncPreviewFailed))
    if (!nextFallback.url) {
      onStatus(copy.missingBaseURL)
      return
    }
    setBrowserFallback(nextFallback)
  }

  const fetchPreviewWithBrowser = async () => {
    if (!browserFallback) {
      return
    }
    try {
      onStatus(copy.browserFetching)
      const headers: HeadersInit = { Accept: "application/json, text/plain, */*" }
      if (browserFallback.includeToken && browserFallback.channel.api_key) {
        headers.Authorization = `Bearer ${browserFallback.channel.api_key}`
      }
      const response = await fetch(browserFallback.url, {
        method: "GET",
        credentials: "include",
        headers,
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${text.slice(0, 300)}`)
      }
      const payload = JSON.parse(text)
      browserPreviewSync.mutate({ fallback: browserFallback, payload })
    } catch (error) {
      console.error("Browser model sync fetch failed", error)
      onStatus(error instanceof Error ? `${copy.browserFetchFailed}: ${error.message}` : copy.browserFetchFailed)
    }
  }

  const submitManualPreviewPayload = () => {
    if (!browserFallback) {
      return
    }
    try {
      const payload = JSON.parse(browserFallback.manualPayload)
      browserPreviewSync.mutate({ fallback: browserFallback, payload })
    } catch (error) {
      console.error("Manual model sync payload parse failed", error)
      onStatus(copy.manualPayloadInvalid)
    }
  }

  return (
    <Dialog open={Boolean(channel)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{copy.modelConfigs}</DialogTitle>
          <DialogDescription>{channel?.name || ""}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-auto pr-1">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <FieldLabel label={copy.syncFormat}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={syncFormat}
                onChange={(event) => setSyncFormat(event.target.value)}
              >
                {syncFormatOptionLabels(language).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label={copy.customSyncPath}>
              <Input
                value={customSyncPath}
                onChange={(event) => setCustomSyncPath(event.target.value)}
                placeholder="/v1/models"
                disabled={syncFormat !== "custom"}
              />
            </FieldLabel>
            <Button className="gap-2 self-end" disabled={!channel || previewSync.isPending || browserPreviewSync.isPending} onClick={() => previewSync.mutate()}>
              <Download size={16} />
              {copy.syncModels}
            </Button>
            <Button className="gap-2 self-end" variant="outline" onClick={() => setEditingModel(emptyChannelModel(channel?.id))}>
              <Plus size={16} />
              {copy.addChannelModel}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.model")}</TableHead>
                  <TableHead>{copy.upstreamModelName}</TableHead>
                  <TableHead>{copy.provider}</TableHead>
                  <TableHead>{t("channels.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <EmptyRow colSpan={5} text={t("common.loading")} />
                ) : models.length === 0 ? (
                  <EmptyRow colSpan={5} text={copy.noChannelModels} />
                ) : (
                  models.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.model_name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.upstream_model_name || item.model_name}</TableCell>
                      <TableCell>
                        <ProviderLabel provider={item.provider} iconURL={item.provider_icon_url} />
                      </TableCell>
                      <TableCell><StatusBadge enabled={item.enabled} /></TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button variant="outline" size="icon" onClick={() => setEditingModelMultipliers(item)} title={copy.groupMultipliers}>
                          <SlidersHorizontal size={14} />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setEditingModel(item)} title={t("common.edit")}>
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => deleteModel.mutate(item.id)}
                          title={t("common.delete")}
                        >
                          <Trash size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        </DialogFooter>
        <ChannelModelDialog
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onSave={(model) => saveModel.mutate(model)}
        />
        <GroupMultiplierDialog
          title={copy.groupMultipliers}
          subject={editingModelMultipliers?.model_name || ""}
          groups={groups}
          multipliers={editingModelMultipliers?.group_multipliers || []}
          open={Boolean(editingModelMultipliers)}
          onClose={() => setEditingModelMultipliers(null)}
          onSave={(multipliers) => {
            if (editingModelMultipliers) {
              saveModelMultipliers.mutate({ modelID: editingModelMultipliers.id, multipliers })
            }
          }}
        />
        <SyncPreviewDialog
          preview={syncPreview}
          selectedModelNames={selectedModelNames}
          isSaving={applySync.isPending}
          onSelectedChange={setSelectedModelNames}
          onClose={() => setSyncPreview(null)}
          onSubmit={() => applySync.mutate()}
        />
        <BrowserSyncFallbackDialog
          fallback={browserFallback}
          isSaving={browserPreviewSync.isPending}
          onChange={setBrowserFallback}
          onClose={() => setBrowserFallback(null)}
          onBrowserFetch={fetchPreviewWithBrowser}
          onManualSubmit={submitManualPreviewPayload}
        />
      </DialogContent>
    </Dialog>
  )
}

function ChannelModelDialog({
  model,
  onClose,
  onSave,
}: {
  model: Partial<ChannelModelConfig> | null
  onClose: () => void
  onSave: (model: Partial<ChannelModelConfig>) => void
}) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy
  const [draft, setDraft] = useState<Partial<ChannelModelConfig>>(emptyChannelModel())
  const [providerMode, setProviderMode] = useState("auto")

  useEffect(() => {
    const nextDraft = model || emptyChannelModel()
    setDraft(nextDraft)
    setProviderMode(providerSelectID(nextDraft.provider || ""))
  }, [model])

  return (
    <Dialog open={Boolean(model)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{model?.id ? copy.editChannelModel : copy.addChannelModel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FieldLabel label={t("common.model")}>
            <Input value={draft.model_name || ""} onChange={(event) => setDraft({ ...draft, model_name: event.target.value })} placeholder="gpt-4o" />
          </FieldLabel>
          <FieldLabel label={copy.upstreamModelName}>
            <Input
              value={draft.upstream_model_name || ""}
              onChange={(event) => setDraft({ ...draft, upstream_model_name: event.target.value })}
              placeholder={draft.model_name || "gpt-4o"}
            />
          </FieldLabel>
          <FieldLabel label={copy.provider}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={providerMode}
              onChange={(event) => {
                const providerID = event.target.value
                setProviderMode(providerID)
                if (providerID === "auto" || providerID === "custom") {
                  setDraft({ ...draft, provider: "", provider_icon_url: "" })
                  return
                }
                const preset = providerPresets.find((item) => item.id === providerID)
                setDraft({ ...draft, provider: providerID, provider_icon_url: preset?.iconURL || "" })
              }}
            >
              <option value="auto">{copy.autoProvider}</option>
              {providerPresets.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
              <option value="custom">{copy.customProvider}</option>
            </select>
          </FieldLabel>
          {providerMode === "custom" && (
            <FieldLabel label={copy.customProviderName}>
              <Input value={draft.provider || ""} onChange={(event) => setDraft({ ...draft, provider: event.target.value })} placeholder="my-provider" />
            </FieldLabel>
          )}
          <FieldLabel label={copy.providerIconURL}>
            <Input
              value={draft.provider_icon_url || ""}
              onChange={(event) => setDraft({ ...draft, provider_icon_url: event.target.value })}
              placeholder="https://cdn.example.com/provider.svg"
            />
          </FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(draft.enabled)} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
            {t("common.enabled")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(draft)}>{t("admin.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SyncPreviewDialog({
  preview,
  selectedModelNames,
  isSaving,
  onSelectedChange,
  onClose,
  onSubmit,
}: {
  preview: SyncPreview | null
  selectedModelNames: string[]
  isSaving: boolean
  onSelectedChange: (names: string[]) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy
  const models = preview?.models || []
  const selectedSet = new Set(selectedModelNames)
  const allSelected = models.length > 0 && selectedModelNames.length === models.length

  const toggleAll = (checked: boolean) => {
    onSelectedChange(checked ? models.map((item) => item.model_name) : [])
  }

  const toggleModel = (modelName: string, checked: boolean) => {
    if (checked) {
      onSelectedChange(selectedSet.has(modelName) ? selectedModelNames : [...selectedModelNames, modelName])
      return
    }
    onSelectedChange(selectedModelNames.filter((item) => item !== modelName))
  }

  return (
    <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{copy.syncPreviewTitle}</DialogTitle>
        </DialogHeader>
        {preview && (
          <div className="min-h-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{preview.channel_name} · {preview.source}</span>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
                {copy.selectAll}
              </label>
            </div>
            <div className="max-h-[52vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t("common.model")}</TableHead>
                    <TableHead>{copy.provider}</TableHead>
                    <TableHead>{copy.syncStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.length === 0 ? (
                    <EmptyRow colSpan={4} text={copy.noSyncModels} />
                  ) : (
                    models.map((item) => (
                      <TableRow key={item.model_name}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(item.model_name)}
                            onChange={(event) => toggleModel(item.model_name, event.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.model_name}</TableCell>
                        <TableCell>
                          <ProviderLabel provider={item.provider} iconURL={item.provider_icon_url} />
                        </TableCell>
                        <TableCell>{item.exists ? copy.exists : copy.newModel}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={selectedModelNames.length === 0 || isSaving}>
            {copy.submitSelected}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BrowserSyncFallbackDialog({
  fallback,
  isSaving,
  onChange,
  onClose,
  onBrowserFetch,
  onManualSubmit,
}: {
  fallback: BrowserSyncFallback | null
  isSaving: boolean
  onChange: (fallback: BrowserSyncFallback | null) => void
  onClose: () => void
  onBrowserFetch: () => void
  onManualSubmit: () => void
}) {
  const { language } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy

  return (
    <Dialog open={Boolean(fallback)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.browserFallbackTitle}</DialogTitle>
        </DialogHeader>
        {fallback && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{fallback.channel.name}</div>
              <div className="mt-2 break-all">{fallback.error}</div>
            </div>
            <FieldLabel label={copy.browserRequestURL}>
              <Input value={fallback.url} readOnly />
            </FieldLabel>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fallback.includeToken}
                onChange={(event) => onChange({ ...fallback, includeToken: event.target.checked })}
              />
              {copy.includeChannelToken}
            </label>
            <Button className="w-full" onClick={onBrowserFetch} disabled={isSaving}>
              {copy.browserFetch}
            </Button>
            <FieldLabel label={copy.manualPayload}>
              <textarea
                className="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={fallback.manualPayload}
                onChange={(event) => onChange({ ...fallback, manualPayload: event.target.value })}
                placeholder={copy.manualPayloadPlaceholder}
              />
            </FieldLabel>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{copy.close}</Button>
          <Button onClick={onManualSubmit} disabled={!fallback?.manualPayload.trim() || isSaving}>
            {copy.parseManualPayload}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GroupMultiplierDialog({
  title,
  subject,
  groups,
  multipliers,
  open,
  onClose,
  onSave,
}: {
  title: string
  subject: string
  groups: Group[]
  multipliers: GroupMultiplier[]
  open: boolean
  onClose: () => void
  onSave: (multipliers: GroupMultiplier[]) => void
}) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhChannelCopy : enChannelCopy
  const [draft, setDraft] = useState<GroupMultiplier[]>([])

  useEffect(() => {
    const byGroup = new Map(multipliers.map((item) => [item.group_id, item]))
    setDraft(groups.map((group) => ({
      group_id: group.id,
      group,
      multiplier: byGroup.get(group.id)?.multiplier ?? "",
    })))
  }, [groups, multipliers, open])

  const updateMultiplier = (groupID: number, multiplier: string) => {
    setDraft((current) => current.map((item) => (item.group_id === groupID ? { ...item, multiplier } : item)))
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subject}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.group}</TableHead>
                <TableHead>{copy.overrideMultiplier}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.length === 0 ? (
                <EmptyRow colSpan={2} text={copy.noGroups} />
              ) : (
                draft.map((item) => (
                  <TableRow key={item.group_id}>
                    <TableCell>{item.group?.name || item.group_id}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={String(item.multiplier ?? "")}
                        placeholder={copy.keepInherited}
                        onChange={(event) => updateMultiplier(item.group_id, event.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(draft.filter((item) => Number(item.multiplier || 0) > 0))}>{t("admin.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  const { t } = useI18n()
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
      {enabled ? t("common.enabled") : t("common.disabled")}
    </span>
  )
}

function ProviderLabel({ provider, iconURL }: { provider?: string; iconURL?: string }) {
  const label = providerName(provider || "")
  return (
    <span className="inline-flex max-w-[180px] items-center gap-2 truncate text-sm">
      {iconURL && <img src={iconURL} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 block text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function emptyUserChannel(): Partial<UserChannel> {
  return { name: "", description: "", multiplier: 1, routing_algorithm: "priority", enabled: true }
}

function userChannelPayload(channel: Partial<UserChannel>) {
  return {
    name: channel.name || "",
    description: channel.description || "",
    multiplier: Number(channel.multiplier ?? 1),
    routing_algorithm: channel.routing_algorithm || "priority",
    enabled: channel.enabled ?? true,
  }
}

function emptyUpstream(userChannelID?: number): Partial<UpstreamChannel> {
  return {
    user_channel_id: userChannelID || null,
    name: "",
    type: "openai",
    base_url: "",
    api_key: "",
    priority: 1,
    weight: 1,
    enabled: true,
  }
}

function upstreamPayload(channel: Partial<UpstreamChannel>) {
  return {
    user_channel_id: channel.user_channel_id || null,
    name: channel.name || "",
    type: channel.type || "openai",
    base_url: channel.base_url || "",
    api_key: channel.api_key || "",
    priority: Number(channel.priority ?? 1),
    weight: Number(channel.weight ?? 1),
    enabled: channel.enabled ?? true,
  }
}

function userChannelName(userChannels: UserChannel[], id?: number | null) {
  return userChannels.find((item) => item.id === id)?.name || "-"
}

function emptyChannelModel(channelID?: number): Partial<ChannelModelConfig> {
  return {
    channel_id: channelID || 0,
    model_id: 0,
    model_name: "",
    upstream_model_name: "",
    provider: "",
    provider_icon_url: "",
    enabled: true,
  }
}

function channelModelPayload(model: Partial<ChannelModelConfig>) {
  return {
    channel_id: Number(model.channel_id || 0),
    model_id: Number(model.model_id || 0),
    model_name: model.model_name || "",
    upstream_model_name: model.upstream_model_name || model.model_name || "",
    provider: model.provider || "",
    provider_icon_url: model.provider_icon_url || "",
    enabled: model.enabled ?? true,
  }
}

function browserFallbackForChannel(channel: UpstreamChannel, format: string, customPath: string, error: string): BrowserSyncFallback {
  const path = browserSyncPath(format, customPath)
  const url = upstreamURLForPath(channel.base_url, path)
  return {
    channel,
    url,
    source: `browser ${path || "custom"}`,
    error,
    includeToken: Boolean(channel.api_key) && shouldIncludeChannelToken(path),
    manualPayload: "",
  }
}

function browserSyncPath(format: string, customPath: string) {
  switch (format) {
    case "openai_models":
    case "openai":
      return "/v1/models"
    case "generic_models":
    case "models":
      return "/models"
    case "api_models":
    case "oneapi_models":
      return "/api/models"
    case "custom":
      return normalizeBrowserSyncPath(customPath)
    case "auto":
    default:
      return "/v1/models"
  }
}

function normalizeBrowserSyncPath(path: string) {
  const nextPath = path.trim()
  if (!nextPath) {
    return ""
  }
  if (nextPath.startsWith("http://") || nextPath.startsWith("https://")) {
    return nextPath
  }
  return nextPath.startsWith("/") ? nextPath : `/${nextPath}`
}

function upstreamURLForPath(baseURL: string, path: string) {
  if (!path) {
    return ""
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }

  const base = (baseURL || "").trim().replace(/\/+$/, "")
  const nextPath = path.startsWith("/") ? path : `/${path}`
  if (!base) {
    return ""
  }

  if (base.toLowerCase().endsWith("/v1")) {
    if (nextPath === "/v1") {
      return base
    }
    if (nextPath.startsWith("/v1/")) {
      return `${base}${nextPath.slice(3)}`
    }
    return `${base.slice(0, -3)}${nextPath}`
  }
  return `${base}${nextPath}`
}

function shouldIncludeChannelToken(_path: string) {
  return true
}

function emptyChannelUsage(): ChannelUsageResponse {
  return { user_channels: [], upstream_channels: [] }
}

function normalizeChannelUsageResponse(value: unknown): ChannelUsageResponse {
  const item = isRecord(value) ? value : {}
  return {
    user_channels: Array.isArray(item.user_channels) ? item.user_channels.map(normalizeUserChannelUsage) : [],
    upstream_channels: Array.isArray(item.upstream_channels) ? item.upstream_channels.map(normalizeUpstreamChannelUsage) : [],
  }
}

function normalizeUsage(value: Record<string, unknown>): UsageStats {
  return {
    request_count: Number(value.request_count || 0),
    input_tokens: Number(value.input_tokens || 0),
    output_tokens: Number(value.output_tokens || 0),
    total_tokens: Number(value.total_tokens || 0),
    total_cost: typeof value.total_cost === "string" || typeof value.total_cost === "number" ? value.total_cost : 0,
  }
}

function normalizeUserChannelUsage(value: unknown): UserChannelUsage {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    routing_algorithm: typeof item.routing_algorithm === "string" ? item.routing_algorithm : "priority",
    ...normalizeUsage(item),
  }
}

function normalizeUpstreamChannelUsage(value: unknown): UpstreamChannelUsage {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    user_channel_id: typeof item.user_channel_id === "number" ? item.user_channel_id : null,
    user_channel_name: typeof item.user_channel_name === "string" ? item.user_channel_name : "",
    ...normalizeUsage(item),
  }
}

function usageForUserChannel(usage: ChannelUsageResponse, id: number): UsageStats {
  return usage.user_channels.find((item) => item.id === id) || zeroUsage()
}

function usageForUpstreamChannel(usage: ChannelUsageResponse, id: number): UsageStats {
  return usage.upstream_channels.find((item) => item.id === id) || zeroUsage()
}

function zeroUsage(): UsageStats {
  return { request_count: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, total_cost: 0 }
}

function routingAlgorithmOptions(copy: typeof zhChannelCopy) {
  return [
    { value: "priority", label: copy.routingPriority },
    { value: "round_robin", label: copy.routingRoundRobin },
    { value: "weighted_round_robin", label: copy.routingWeightedRoundRobin },
  ]
}

function routingAlgorithmLabel(value: string, copy: typeof zhChannelCopy) {
  return routingAlgorithmOptions(copy).find((item) => item.value === value)?.label || copy.routingPriority
}

function formatInteger(value: number) {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0)
}

function formatCost(value: string | number) {
  const parsed = Number(value || 0)
  return `$${(Number.isFinite(parsed) ? parsed : 0).toFixed(6)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function syncSummary(results: SyncResult[], t: ReturnType<typeof useI18n>["t"]) {
  if (results.length === 0) {
    return t("models.syncDone", { created: 0, updated: 0 })
  }
  const failed = results.filter((item) => item.error).length
  const created = results.reduce((sum, item) => sum + (item.created || 0), 0)
  const updated = results.reduce((sum, item) => sum + (item.updated || 0), 0)
  if (failed > 0) {
    return t("models.syncPartial", { created, updated, failed })
  }
  return t("models.syncDone", { created, updated })
}

function syncErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ error?: string; message?: string; result?: SyncResult }>
  const status = axiosError.response?.status
  const data = axiosError.response?.data
  const detail = data?.error || data?.message || data?.result?.error
  if (status && detail) {
    return `${fallback}: HTTP ${status} ${detail}`
  }
  if (detail) {
    return `${fallback}: ${detail}`
  }
  if (error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`
  }
  return fallback
}

function providerSelectID(provider: string) {
  if (!provider) {
    return "auto"
  }
  return providerPresets.some((item) => item.id === provider) ? provider : "custom"
}

function providerName(provider: string) {
  if (!provider) {
    return "-"
  }
  return providerPresets.find((item) => item.id === provider)?.name || provider
}

function syncFormatOptionLabels(language: string) {
  if (language === "zh") {
    return [
      { value: "auto", label: "自动识别" },
      { value: "openai_models", label: "OpenAI /v1/models" },
      { value: "generic_models", label: "通用 /models" },
      { value: "api_models", label: "通用 /api/models" },
      { value: "custom", label: "自定义路径" },
    ]
  }
  return [
    { value: "auto", label: "Auto detect" },
    { value: "openai_models", label: "OpenAI /v1/models" },
    { value: "generic_models", label: "Generic /models" },
    { value: "api_models", label: "Generic /api/models" },
    { value: "custom", label: "Custom path" },
  ]
}

const providerTypes = [
  { value: "completion", label: "OpenAI Chat Completions" },
  { value: "responses", label: "OpenAI Responses" },
  { value: "openai", label: "OpenAI" },
  { value: "newapi", label: "NewAPI" },
  { value: "oneapi", label: "One API" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
]

const providerPresets = [
  { id: "openai", name: "OpenAI", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg" },
  { id: "deepseek", name: "DeepSeek", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/deepseek.svg" },
  { id: "anthropic", name: "Anthropic", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/anthropic.svg" },
  { id: "google", name: "Google", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/google.svg" },
  { id: "meta", name: "Meta", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/meta.svg" },
  { id: "mistral", name: "Mistral AI", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/mistralai.svg" },
  { id: "qwen", name: "Qwen", iconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/alibabacloud.svg" },
  { id: "moonshot", name: "Moonshot AI", iconURL: "" },
  { id: "zhipu", name: "Zhipu AI", iconURL: "" },
]

const zhChannelCopy = {
  modelConfigs: "模型配置",
  syncFormat: "同步格式",
  customSyncPath: "自定义路径",
  syncModels: "同步模型",
  addChannelModel: "添加模型配置",
  editChannelModel: "编辑模型配置",
  upstreamModelName: "上级模型名称",
  provider: "供应商",
  autoProvider: "自动识别",
  customProvider: "自定义供应商",
  customProviderName: "供应商名称",
  providerIconURL: "供应商图标 URL",
  channelRequired: "请选择上级渠道",
  noChannelModels: "暂无模型配置",
  syncPreviewFailed: "获取模型列表失败",
  syncFailed: "同步模型失败",
  syncPreviewTitle: "选择要同步的模型",
  selectAll: "全选",
  syncStatus: "状态",
  exists: "已存在",
  newModel: "新增",
  noSyncModels: "未获取到模型",
  submitSelected: "提交同步",
  browserFallbackTitle: "同步失败",
  browserRequestURL: "请求地址",
  includeChannelToken: "携带渠道令牌",
  browserFetch: "使用浏览器获取",
  browserFetching: "正在使用浏览器获取",
  browserFetchFailed: "浏览器获取失败",
  browserPreviewFailed: "解析模型列表失败",
  manualPayload: "手动 JSON",
  manualPayloadPlaceholder: "粘贴模型列表 JSON",
  manualPayloadInvalid: "JSON 格式不正确",
  parseManualPayload: "解析 JSON",
  missingBaseURL: "渠道 Base URL 不能为空",
  close: "关闭",
  routingAlgorithm: "路由算法",
  routingPriority: "优先级",
  routingRoundRobin: "轮询",
  routingWeightedRoundRobin: "按权重轮询",
  requests: "请求数",
  tokens: "Tokens",
  cost: "消耗",
  groupMultipliers: "分组倍率",
  groupMultipliersSaved: "分组倍率已保存",
  groupMultipliersSaveFailed: "分组倍率保存失败",
  group: "分组",
  overrideMultiplier: "覆盖倍率",
  keepInherited: "留空继承",
  noGroups: "暂无分组",
}

const enChannelCopy: typeof zhChannelCopy = {
  modelConfigs: "Model configs",
  syncFormat: "Sync format",
  customSyncPath: "Custom path",
  syncModels: "Sync models",
  addChannelModel: "Add model config",
  editChannelModel: "Edit model config",
  upstreamModelName: "Upstream model name",
  provider: "Provider",
  autoProvider: "Auto detect",
  customProvider: "Custom provider",
  customProviderName: "Provider name",
  providerIconURL: "Provider icon URL",
  channelRequired: "Select an upstream channel",
  noChannelModels: "No model configs",
  syncPreviewFailed: "Failed to fetch models",
  syncFailed: "Failed to sync models",
  syncPreviewTitle: "Select models to sync",
  selectAll: "Select all",
  syncStatus: "Status",
  exists: "Exists",
  newModel: "New",
  noSyncModels: "No models fetched",
  submitSelected: "Submit sync",
  browserFallbackTitle: "Sync failed",
  browserRequestURL: "Request URL",
  includeChannelToken: "Include channel token",
  browserFetch: "Fetch in browser",
  browserFetching: "Fetching in browser",
  browserFetchFailed: "Browser fetch failed",
  browserPreviewFailed: "Failed to parse models",
  manualPayload: "Manual JSON",
  manualPayloadPlaceholder: "Paste model-list JSON",
  manualPayloadInvalid: "Invalid JSON",
  parseManualPayload: "Parse JSON",
  missingBaseURL: "Channel Base URL is required",
  close: "Close",
  routingAlgorithm: "Routing algorithm",
  routingPriority: "Priority",
  routingRoundRobin: "Round robin",
  routingWeightedRoundRobin: "Weighted round robin",
  requests: "Requests",
  tokens: "Tokens",
  cost: "Cost",
  groupMultipliers: "Group multipliers",
  groupMultipliersSaved: "Group multipliers saved",
  groupMultipliersSaveFailed: "Failed to save group multipliers",
  group: "Group",
  overrideMultiplier: "Override multiplier",
  keepInherited: "Empty inherits",
  noGroups: "No groups",
}
