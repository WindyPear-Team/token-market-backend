import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Edit, Plus, Trash } from "lucide-react"
import type { AxiosError } from "axios"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
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

interface PriceTier {
  min_tokens: number
  price: string | number
  condition?: string
}

interface ModelConfig {
  id: number
  model_name: string
  provider: string
  provider_icon_url: string
  input_price: string | number
  output_price: string | number
  cached_input_price: string | number
  cache_write_input_price: string | number
  cache_write_1h_input_price: string | number
  image_input_price: string | number
  image_output_price: string | number
  audio_input_price: string | number
  audio_output_price: string | number
  input_price_tiers: PriceTier[]
  output_price_tiers: PriceTier[]
  cached_input_price_tiers: PriceTier[]
  cache_write_input_price_tiers: PriceTier[]
  cache_write_1h_input_price_tiers: PriceTier[]
  image_input_price_tiers: PriceTier[]
  image_output_price_tiers: PriceTier[]
  audio_input_price_tiers: PriceTier[]
  audio_output_price_tiers: PriceTier[]
  enabled: boolean
}

interface UpstreamChannel {
  id: number
  name: string
  base_url: string
  api_key?: string
  enabled: boolean
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
  input_price: string | number
  output_price: string | number
  cached_input_price: string | number
  cache_write_input_price?: string | number
  cache_write_1h_input_price?: string | number
  image_input_price?: string | number
  image_output_price?: string | number
  audio_input_price?: string | number
  audio_output_price?: string | number
  input_price_tiers: PriceTier[]
  output_price_tiers: PriceTier[]
  cached_input_price_tiers: PriceTier[]
  cache_write_input_price_tiers?: PriceTier[]
  cache_write_1h_input_price_tiers?: PriceTier[]
  image_input_price_tiers?: PriceTier[]
  image_output_price_tiers?: PriceTier[]
  audio_input_price_tiers?: PriceTier[]
  audio_output_price_tiers?: PriceTier[]
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

export default function Models() {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const queryClient = useQueryClient()
  const [editingModel, setEditingModel] = useState<Partial<ModelConfig> | null>(null)
  const [status, setStatus] = useState("")
  const [priceChannelID, setPriceChannelID] = useState(0)
  const [syncFormat, setSyncFormat] = useState("auto")
  const [customSyncPath, setCustomSyncPath] = useState("")
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null)
  const [selectedModelNames, setSelectedModelNames] = useState<string[]>([])
  const [browserFallback, setBrowserFallback] = useState<BrowserSyncFallback | null>(null)

  const { data: models = [], isLoading } = useQuery<ModelConfig[]>({
    queryKey: ["admin-models-page"],
    queryFn: async () => {
      const res = await api.get("/models")
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-models-page"] })
    queryClient.invalidateQueries({ queryKey: ["catalog"] })
    queryClient.invalidateQueries({ queryKey: ["public-models"] })
  }

  const saveModel = useMutation({
    mutationFn: async (model: Partial<ModelConfig>) => {
      const payload = modelPayload(model)
      if (model.id) {
        const res = await api.put(`/models/${model.id}`, payload)
        return res.data
      }
      const res = await api.post("/models", payload)
      return res.data
    },
    onSuccess: () => {
      setStatus(t("admin.saved"))
      setEditingModel(null)
      invalidate()
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : t("admin.saveFailed")),
  })

  const deleteModel = useMutation({
    mutationFn: async (id: number) => api.delete(`/models/${id}`),
    onSuccess: () => {
      setStatus(t("admin.deleted"))
      invalidate()
    },
    onError: () => setStatus(t("admin.deleteFailed")),
  })

  const previewPriceSync = useMutation({
    mutationFn: async () => {
      if (!priceChannelID) {
        throw new Error(copy.channelRequired)
      }
      const res = await api.post("/models/prices/sync/preview", {
        channel_id: priceChannelID,
        format: syncFormat,
        path: customSyncPath,
      })
      return res.data as SyncPreview
    },
    onSuccess: (preview) => {
      setSyncPreview(preview)
      setSelectedModelNames(preview.models.map((item) => item.model_name))
      setStatus("")
    },
    onError: (error) => {
      console.error("Model price sync preview failed", error)
      setStatus(syncErrorMessage(error, copy.syncPreviewFailed))
      openBrowserFallback(error)
    },
  })

  const browserPreviewSync = useMutation({
    mutationFn: async ({ fallback, payload }: { fallback: BrowserSyncFallback; payload: unknown }) => {
      const res = await api.post("/models/prices/sync/preview/browser", {
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
      setStatus("")
    },
    onError: (error) => {
      console.error("Browser model price sync preview failed", error)
      setStatus(syncErrorMessage(error, copy.browserPreviewFailed))
    },
  })

  const applyPriceSync = useMutation({
    mutationFn: async () => {
      if (!syncPreview) {
        return []
      }
      const selectedModels = syncPreview.models.filter((item) => selectedModelNames.includes(item.model_name))
      const res = await api.post("/models/prices/sync/apply", {
        channel_id: syncPreview.channel_id,
        models: selectedModels,
      })
      return Array.isArray(res.data?.results) ? res.data.results as SyncResult[] : []
    },
    onSuccess: (results) => {
      setStatus(syncSummary(results, copy))
      setSyncPreview(null)
      setSelectedModelNames([])
      invalidate()
    },
    onError: (error) => {
      console.error("Model price sync apply failed", error)
      setStatus(syncErrorMessage(error, copy.syncFailed))
    },
  })

  const openBrowserFallback = (error: unknown) => {
    const channel = channels.find((item) => item.id === priceChannelID)
    if (!channel) {
      return
    }
    const nextFallback = browserFallbackForChannel(channel, syncFormat, customSyncPath, syncErrorMessage(error, copy.syncPreviewFailed))
    if (!nextFallback.url) {
      setStatus(copy.missingBaseURL)
      return
    }
    setBrowserFallback(nextFallback)
  }

  const fetchPreviewWithBrowser = async () => {
    if (!browserFallback) {
      return
    }
    try {
      setStatus(copy.browserFetching)
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
      console.error("Browser model price sync fetch failed", error)
      setStatus(error instanceof Error ? `${copy.browserFetchFailed}: ${error.message}` : copy.browserFetchFailed)
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
      console.error("Manual model price sync payload parse failed", error)
      setStatus(copy.manualPayloadInvalid)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("models.title")}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</div>
        </div>
        <div className="text-sm text-muted-foreground">{status}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.priceSync}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <FieldLabel label={copy.sourceChannel}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={priceChannelID || ""}
                onChange={(event) => setPriceChannelID(Number(event.target.value) || 0)}
              >
                <option value="">{copy.selectChannel}</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>{channel.name}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label={copy.syncFormat}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={syncFormat}
                onChange={(event) => setSyncFormat(event.target.value)}
              >
                {priceSyncFormatOptionLabels(language).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label={copy.customSyncPath}>
              <Input
                value={customSyncPath}
                onChange={(event) => setCustomSyncPath(event.target.value)}
                placeholder="/api/pricing"
                disabled={syncFormat !== "custom"}
              />
            </FieldLabel>
            <Button className="gap-2 self-end" disabled={!priceChannelID || previewPriceSync.isPending || browserPreviewSync.isPending} onClick={() => previewPriceSync.mutate()}>
              <Download size={16} />
              {copy.fetchPrices}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("models.configCard")}</CardTitle>
          <Button className="gap-2" onClick={() => setEditingModel(emptyModel())}>
            <Plus size={16} />
            {t("admin.addModel")}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.model")}</TableHead>
                <TableHead>{copy.provider}</TableHead>
                <TableHead>{t("admin.inputPrice")}</TableHead>
                <TableHead>{t("admin.outputPrice")}</TableHead>
                <TableHead>{copy.cachedInputPrice}</TableHead>
                <TableHead>{t("channels.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <EmptyRow colSpan={7} text={t("common.loading")} />
              ) : models.length === 0 ? (
                <EmptyRow colSpan={7} text={t("admin.noModels")} />
              ) : (
                models.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.model_name}</TableCell>
                    <TableCell>
                      <ProviderLabel provider={item.provider} iconURL={item.provider_icon_url} />
                    </TableCell>
                    <TableCell>
                      <PriceWithTiers value={item.input_price} tiers={item.input_price_tiers} />
                    </TableCell>
                    <TableCell>
                      <PriceWithTiers value={item.output_price} tiers={item.output_price_tiers} />
                    </TableCell>
                    <TableCell>
                      <PriceWithTiers value={item.cached_input_price} tiers={item.cached_input_price_tiers} />
                    </TableCell>
                    <TableCell><StatusBadge enabled={item.enabled} /></TableCell>
                    <TableCell className="space-x-2 text-right">
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
        </CardContent>
      </Card>

      <ModelDialog
        model={editingModel}
        onClose={() => setEditingModel(null)}
        onSave={(model) => saveModel.mutate(model)}
      />
      <PriceSyncPreviewDialog
        preview={syncPreview}
        selectedModelNames={selectedModelNames}
        isSaving={applyPriceSync.isPending}
        onSelectedChange={setSelectedModelNames}
        onClose={() => setSyncPreview(null)}
        onSubmit={() => applyPriceSync.mutate()}
      />
      <BrowserSyncFallbackDialog
        fallback={browserFallback}
        isSaving={browserPreviewSync.isPending}
        onChange={setBrowserFallback}
        onClose={() => setBrowserFallback(null)}
        onBrowserFetch={fetchPreviewWithBrowser}
        onManualSubmit={submitManualPreviewPayload}
      />
    </div>
  )
}

function ModelDialog({
  model,
  onClose,
  onSave,
}: {
  model: Partial<ModelConfig> | null
  onClose: () => void
  onSave: (model: Partial<ModelConfig>) => void
}) {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const [draft, setDraft] = useState<Partial<ModelConfig>>(emptyModel())
  const [providerMode, setProviderMode] = useState("auto")

  useEffect(() => {
    const nextDraft = model || emptyModel()
    setDraft(nextDraft)
    setProviderMode(providerSelectID(nextDraft.provider || ""))
  }, [model])

  return (
    <Dialog open={Boolean(model)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{model?.id ? t("admin.editModel") : t("admin.addModel")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FieldLabel label={t("common.model")}>
            <Input
              value={draft.model_name || ""}
              onChange={(event) => setDraft({ ...draft, model_name: event.target.value })}
              placeholder="gpt-4o"
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
              <Input
                value={draft.provider || ""}
                onChange={(event) => setDraft({ ...draft, provider: event.target.value })}
                placeholder="my-provider"
              />
            </FieldLabel>
          )}
          <FieldLabel label={copy.providerIconURL}>
            <Input
              value={draft.provider_icon_url || ""}
              onChange={(event) => setDraft({ ...draft, provider_icon_url: event.target.value })}
              placeholder="https://cdn.example.com/provider.svg"
            />
          </FieldLabel>
          <PriceSection title={copy.textTokenPricing}>
            <PriceEditor
              label={t("admin.inputPrice")}
              price={draft.input_price}
              tiers={draft.input_price_tiers || []}
              tierLabel={copy.inputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, input_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, input_price_tiers: tiers })}
            />
            <PriceEditor
              label={t("admin.outputPrice")}
              price={draft.output_price}
              tiers={draft.output_price_tiers || []}
              tierLabel={copy.outputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, output_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, output_price_tiers: tiers })}
            />
          </PriceSection>
          <PriceSection title={copy.cachePricing}>
            <PriceEditor
              label={copy.cacheReadInputPrice}
              price={draft.cached_input_price}
              tiers={draft.cached_input_price_tiers || []}
              tierLabel={copy.cacheReadInputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, cached_input_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, cached_input_price_tiers: tiers })}
            />
            <PriceEditor
              label={copy.cacheWriteInputPrice}
              price={draft.cache_write_input_price}
              tiers={draft.cache_write_input_price_tiers || []}
              tierLabel={copy.cacheWriteInputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, cache_write_input_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, cache_write_input_price_tiers: tiers })}
            />
            <PriceEditor
              label={copy.cacheWrite1hInputPrice}
              price={draft.cache_write_1h_input_price}
              tiers={draft.cache_write_1h_input_price_tiers || []}
              tierLabel={copy.cacheWrite1hInputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, cache_write_1h_input_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, cache_write_1h_input_price_tiers: tiers })}
            />
          </PriceSection>
          <PriceSection title={copy.multimodalPricing}>
            <PriceEditor
              label={copy.imageInputPrice}
              price={draft.image_input_price}
              tiers={draft.image_input_price_tiers || []}
              tierLabel={copy.imageInputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, image_input_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, image_input_price_tiers: tiers })}
            />
            <PriceEditor
              label={copy.imageOutputPrice}
              price={draft.image_output_price}
              tiers={draft.image_output_price_tiers || []}
              tierLabel={copy.imageOutputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, image_output_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, image_output_price_tiers: tiers })}
            />
            <PriceEditor
              label={copy.audioInputPrice}
              price={draft.audio_input_price}
              tiers={draft.audio_input_price_tiers || []}
              tierLabel={copy.audioInputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, audio_input_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, audio_input_price_tiers: tiers })}
            />
            <PriceEditor
              label={copy.audioOutputPrice}
              price={draft.audio_output_price}
              tiers={draft.audio_output_price_tiers || []}
              tierLabel={copy.audioOutputPriceTiers}
              onPriceChange={(value) => setDraft({ ...draft, audio_output_price: value })}
              onTiersChange={(tiers) => setDraft({ ...draft, audio_output_price_tiers: tiers })}
            />
          </PriceSection>
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

function PriceSyncPreviewDialog({
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
  const copy = language === "zh" ? zhCopy : enCopy
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
                    <TableHead>{t("admin.inputPrice")}</TableHead>
                    <TableHead>{t("admin.outputPrice")}</TableHead>
                    <TableHead>{copy.cachedInputPrice}</TableHead>
                    <TableHead>{copy.syncStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.length === 0 ? (
                    <EmptyRow colSpan={7} text={copy.noSyncModels} />
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
                        <TableCell>
                          <PriceWithTiers value={item.input_price} tiers={item.input_price_tiers} />
                        </TableCell>
                        <TableCell>
                          <PriceWithTiers value={item.output_price} tiers={item.output_price_tiers} />
                        </TableCell>
                        <TableCell>
                          <PriceWithTiers value={item.cached_input_price} tiers={item.cached_input_price_tiers} />
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
  const copy = language === "zh" ? zhCopy : enCopy

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

function StatusBadge({ enabled }: { enabled: boolean }) {
  const { t } = useI18n()
  return (
    <span className={cn("rounded-full px-2 py-1 text-xs font-medium", enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
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
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function PriceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="grid gap-3 lg:grid-cols-2">{children}</div>
    </div>
  )
}

function PriceEditor({
  label,
  price,
  tiers,
  tierLabel,
  onPriceChange,
  onTiersChange,
}: {
  label: string
  price?: string | number
  tiers: PriceTier[]
  tierLabel: string
  onPriceChange: (value: number) => void
  onTiersChange: (tiers: PriceTier[]) => void
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <FieldLabel label={label}>
        <Input
          type="number"
          value={String(price ?? 0)}
          onChange={(event) => onPriceChange(Number(event.target.value))}
          placeholder="2.5000"
        />
      </FieldLabel>
      <TierEditor label={tierLabel} tiers={tiers} onChange={onTiersChange} />
    </div>
  )
}

function PriceWithTiers({ value, tiers }: { value: string | number; tiers?: PriceTier[] }) {
  return (
    <div>
      <div>{formatModelPrice(value)}</div>
      <TierSummary tiers={tiers} />
    </div>
  )
}

function TierSummary({ tiers }: { tiers?: PriceTier[] }) {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const normalized = normalizePriceTiers(tiers || [])
  if (normalized.length === 0) {
    return null
  }
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      {normalized.map((tier) => `${tierConditionLabel(tier.condition, copy)} ${formatTokenCount(tier.min_tokens)}: ${formatModelPrice(tier.price)}`).join(" / ")}
    </div>
  )
}

function TierEditor({
  label,
  tiers,
  onChange,
}: {
  label: string
  tiers: PriceTier[]
  onChange: (tiers: PriceTier[]) => void
}) {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const normalized = normalizePriceTiers(tiers)

  const updateTier = (index: number, patch: Partial<PriceTier>) => {
    onChange(normalizePriceTiers(normalized.map((tier, tierIndex) => tierIndex === index ? { ...tier, ...patch } : tier)))
  }

  const addTier = () => {
    const currentTiers = normalized.filter((tier) => !tier.condition)
    const maxMinTokens = currentTiers.reduce((maxValue, tier) => Math.max(maxValue, tier.min_tokens), 0)
    const minTokens = maxMinTokens > 0 ? maxMinTokens + 1000000 : 1000000
    onChange([...normalized, { min_tokens: minTokens, price: 0, condition: "" }])
  }

  const removeTier = (index: number) => {
    onChange(normalized.filter((_, tierIndex) => tierIndex !== index))
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={addTier}
        >
          <Plus size={14} />
          {copy.addTier}
        </Button>
      </div>
      {normalized.length === 0 ? (
        <div className="text-xs text-muted-foreground">{copy.noTiers}</div>
      ) : (
        <div className="space-y-2">
          {normalized.map((tier, index) => (
            <div key={`${tier.condition || "current"}-${tier.min_tokens}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(150px,1.3fr)_minmax(120px,1fr)_minmax(120px,1fr)_auto]">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={tier.condition || ""}
                onChange={(event) => updateTier(index, { condition: event.target.value })}
              >
                {tierConditionOptions(copy).map((option) => (
                  <option key={option.value || "current"} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Input
                type="number"
                value={String(tier.min_tokens)}
                onChange={(event) => updateTier(index, { min_tokens: Number(event.target.value) || 0 })}
                placeholder={copy.tierMinTokensPlaceholder}
              />
              <Input
                type="number"
                value={String(tier.price)}
                onChange={(event) => updateTier(index, { price: Number(event.target.value) || 0 })}
                placeholder={copy.tierPricePlaceholder}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => removeTier(index)} title={copy.deleteTier}>
                <Trash size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyModel(): Partial<ModelConfig> {
  return {
    model_name: "",
    provider: "",
    provider_icon_url: "",
    input_price: 0,
    output_price: 0,
    cached_input_price: 0,
    cache_write_input_price: 0,
    cache_write_1h_input_price: 0,
    image_input_price: 0,
    image_output_price: 0,
    audio_input_price: 0,
    audio_output_price: 0,
    input_price_tiers: [],
    output_price_tiers: [],
    cached_input_price_tiers: [],
    cache_write_input_price_tiers: [],
    cache_write_1h_input_price_tiers: [],
    image_input_price_tiers: [],
    image_output_price_tiers: [],
    audio_input_price_tiers: [],
    audio_output_price_tiers: [],
    enabled: true,
  }
}

function modelPayload(model: Partial<ModelConfig>) {
  return {
    model_name: model.model_name || "",
    provider: model.provider || "",
    provider_icon_url: model.provider_icon_url || "",
    input_price: Number(model.input_price || 0),
    output_price: Number(model.output_price || 0),
    cached_input_price: Number(model.cached_input_price || 0),
    cache_write_input_price: Number(model.cache_write_input_price || 0),
    cache_write_1h_input_price: Number(model.cache_write_1h_input_price || 0),
    image_input_price: Number(model.image_input_price || 0),
    image_output_price: Number(model.image_output_price || 0),
    audio_input_price: Number(model.audio_input_price || 0),
    audio_output_price: Number(model.audio_output_price || 0),
    input_price_tiers: normalizePriceTiers(model.input_price_tiers || []),
    output_price_tiers: normalizePriceTiers(model.output_price_tiers || []),
    cached_input_price_tiers: normalizePriceTiers(model.cached_input_price_tiers || []),
    cache_write_input_price_tiers: normalizePriceTiers(model.cache_write_input_price_tiers || []),
    cache_write_1h_input_price_tiers: normalizePriceTiers(model.cache_write_1h_input_price_tiers || []),
    image_input_price_tiers: normalizePriceTiers(model.image_input_price_tiers || []),
    image_output_price_tiers: normalizePriceTiers(model.image_output_price_tiers || []),
    audio_input_price_tiers: normalizePriceTiers(model.audio_input_price_tiers || []),
    audio_output_price_tiers: normalizePriceTiers(model.audio_output_price_tiers || []),
    enabled: model.enabled ?? true,
  }
}

function formatModelPrice(value: string | number) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) {
    return "-"
  }
  return `$${parsed.toFixed(6)} / 1M`
}

function formatTokenCount(value: number) {
  if (value >= 1000000) {
    return `${trimNumber(value / 1000000)}M`
  }
  if (value >= 1000) {
    return `${trimNumber(value / 1000)}K`
  }
  return String(value)
}

function trimNumber(value: number) {
  return value.toFixed(3).replace(/\.?0+$/, "")
}

function normalizePriceTiers(tiers: PriceTier[]) {
  const byMinTokens = new Map<string, PriceTier>()
  for (const tier of tiers || []) {
    const minTokens = Math.max(0, Math.floor(Number(tier.min_tokens || 0)))
    const price = Number(tier.price || 0)
    const condition = normalizeTierCondition(tier.condition || "")
    if (!Number.isFinite(minTokens) || !Number.isFinite(price) || price < 0) {
      continue
    }
    byMinTokens.set(`${condition}:${minTokens}`, { min_tokens: minTokens, price, condition })
  }
  return Array.from(byMinTokens.values()).sort((a, b) => {
    const conditionSort = tierConditionSort(a.condition) - tierConditionSort(b.condition)
    return conditionSort || a.min_tokens - b.min_tokens
  })
}

function normalizeTierCondition(condition: string) {
  switch ((condition || "").trim()) {
    case "full_input_tokens":
    case "billable_input_tokens":
    case "billable_output_tokens":
      return condition
    default:
      return ""
  }
}

function tierConditionSort(condition?: string) {
  switch (normalizeTierCondition(condition || "")) {
    case "full_input_tokens":
      return 1
    case "billable_input_tokens":
      return 2
    case "billable_output_tokens":
      return 3
    default:
      return 0
  }
}

function tierConditionOptions(copy: typeof zhCopy) {
  return [
    { value: "", label: copy.tierConditionCurrent },
    { value: "full_input_tokens", label: copy.tierConditionFullInput },
    { value: "billable_input_tokens", label: copy.tierConditionBillableInput },
    { value: "billable_output_tokens", label: copy.tierConditionBillableOutput },
  ]
}

function tierConditionLabel(condition: string | undefined, copy: typeof zhCopy) {
  return tierConditionOptions(copy).find((item) => item.value === normalizeTierCondition(condition || ""))?.label || copy.tierConditionCurrent
}

function browserFallbackForChannel(channel: UpstreamChannel, format: string, customPath: string, error: string): BrowserSyncFallback {
  const path = priceSyncPath(format, customPath)
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

function priceSyncPath(format: string, customPath: string) {
  switch (format) {
    case "generic_models":
    case "models":
      return "/models"
    case "api_models":
    case "oneapi_models":
      return "/api/models"
    case "api_prices":
    case "legacy_api_prices":
      return "/api/prices"
    case "custom":
      return normalizeBrowserSyncPath(customPath)
    case "auto":
    case "newapi_prices":
    case "newapi_pricing":
    case "api_pricing":
    default:
      return "/api/pricing"
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

function shouldIncludeChannelToken(path: string) {
  return path !== "/api/pricing"
}

function syncSummary(results: SyncResult[], copy: typeof zhCopy) {
  const failed = results.filter((item) => item.error).length
  const created = results.reduce((sum, item) => sum + (item.created || 0), 0)
  const updated = results.reduce((sum, item) => sum + (item.updated || 0), 0)
  if (failed > 0) {
    return copy.syncPartial.replace("{created}", String(created)).replace("{updated}", String(updated)).replace("{failed}", String(failed))
  }
  return copy.syncDone.replace("{created}", String(created)).replace("{updated}", String(updated))
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

function priceSyncFormatOptionLabels(language: string) {
  if (language === "zh") {
    return [
      { value: "auto", label: "自动识别" },
      { value: "newapi_prices", label: "New API /api/pricing" },
      { value: "api_prices", label: "通用 /api/prices" },
      { value: "generic_models", label: "通用 /models" },
      { value: "api_models", label: "通用 /api/models" },
      { value: "custom", label: "自定义路径" },
    ]
  }
  return [
    { value: "auto", label: "Auto detect" },
    { value: "newapi_prices", label: "New API /api/pricing" },
    { value: "api_prices", label: "Generic /api/prices" },
    { value: "generic_models", label: "Generic /models" },
    { value: "api_models", label: "Generic /api/models" },
    { value: "custom", label: "Custom path" },
  ]
}

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

const zhCopy = {
  subtitle: "配置全局模型和基础价格",
  provider: "供应商",
  cachedInputPrice: "缓存读取价格",
  textTokenPricing: "文本 token 价格",
  cachePricing: "缓存价格",
  multimodalPricing: "多模态价格",
  cacheReadInputPrice: "缓存读取价格",
  cacheWriteInputPrice: "缓存写入价格",
  cacheWrite1hInputPrice: "1 小时缓存写入价格",
  imageInputPrice: "图像输入价格",
  imageOutputPrice: "图像输出价格",
  audioInputPrice: "音频输入价格",
  audioOutputPrice: "音频输出价格",
  autoProvider: "自动识别",
  customProvider: "自定义供应商",
  customProviderName: "供应商名称",
  providerIconURL: "供应商图标 URL",
  inputPriceTiers: "输入分段价格",
  outputPriceTiers: "输出分段价格",
  cachedInputPriceTiers: "缓存读取分段价格",
  cacheReadInputPriceTiers: "缓存读取分段价格",
  cacheWriteInputPriceTiers: "缓存写入分段价格",
  cacheWrite1hInputPriceTiers: "1 小时缓存写入分段价格",
  imageInputPriceTiers: "图像输入分段价格",
  imageOutputPriceTiers: "图像输出分段价格",
  audioInputPriceTiers: "音频输入分段价格",
  audioOutputPriceTiers: "音频输出分段价格",
  addTier: "添加分段",
  noTiers: "未配置分段，使用基础价格",
  tierMinTokensPlaceholder: "起始 token，例如 1000000",
  tierPricePlaceholder: "分段价格 / 1M",
  tierConditionCurrent: "当前计价项",
  tierConditionFullInput: "完整输入长度",
  tierConditionBillableInput: "计价输入 token",
  tierConditionBillableOutput: "计价输出 token",
  deleteTier: "删除分段",
  priceSync: "价格拉取",
  sourceChannel: "来源上级渠道",
  selectChannel: "选择上级渠道",
  syncFormat: "价格格式",
  customSyncPath: "自定义路径",
  fetchPrices: "拉取价格",
  channelRequired: "请选择上级渠道",
  syncPreviewFailed: "获取价格失败",
  syncFailed: "同步价格失败",
  syncPreviewTitle: "选择要同步的价格",
  selectAll: "全选",
  syncStatus: "状态",
  exists: "已存在",
  newModel: "新增",
  noSyncModels: "未获取到价格",
  submitSelected: "提交同步",
  browserFallbackTitle: "拉取失败",
  browserRequestURL: "请求地址",
  includeChannelToken: "携带渠道令牌",
  browserFetch: "使用浏览器获取",
  browserFetching: "正在使用浏览器获取",
  browserFetchFailed: "浏览器获取失败",
  browserPreviewFailed: "解析价格失败",
  manualPayload: "手动 JSON",
  manualPayloadPlaceholder: "粘贴价格接口返回的 JSON",
  manualPayloadInvalid: "JSON 格式不正确",
  parseManualPayload: "解析 JSON",
  missingBaseURL: "渠道 Base URL 不能为空",
  close: "关闭",
  syncDone: "价格已同步，新增 {created}，更新 {updated}",
  syncPartial: "价格部分同步，新增 {created}，更新 {updated}，失败 {failed}",
}

const enCopy: typeof zhCopy = {
  subtitle: "Configure global models and base prices",
  provider: "Provider",
  cachedInputPrice: "Cache read price",
  textTokenPricing: "Text token pricing",
  cachePricing: "Cache pricing",
  multimodalPricing: "Multimodal pricing",
  cacheReadInputPrice: "Cache read price",
  cacheWriteInputPrice: "Cache write price",
  cacheWrite1hInputPrice: "1h cache write price",
  imageInputPrice: "Image input price",
  imageOutputPrice: "Image output price",
  audioInputPrice: "Audio input price",
  audioOutputPrice: "Audio output price",
  autoProvider: "Auto detect",
  customProvider: "Custom provider",
  customProviderName: "Provider name",
  providerIconURL: "Provider icon URL",
  inputPriceTiers: "Input price tiers",
  outputPriceTiers: "Output price tiers",
  cachedInputPriceTiers: "Cache read price tiers",
  cacheReadInputPriceTiers: "Cache read price tiers",
  cacheWriteInputPriceTiers: "Cache write price tiers",
  cacheWrite1hInputPriceTiers: "1h cache write price tiers",
  imageInputPriceTiers: "Image input price tiers",
  imageOutputPriceTiers: "Image output price tiers",
  audioInputPriceTiers: "Audio input price tiers",
  audioOutputPriceTiers: "Audio output price tiers",
  addTier: "Add tier",
  noTiers: "No tiers configured; base price is used",
  tierMinTokensPlaceholder: "Start tokens, for example 1000000",
  tierPricePlaceholder: "Tier price / 1M",
  tierConditionCurrent: "Current item",
  tierConditionFullInput: "Full input length",
  tierConditionBillableInput: "Billable input tokens",
  tierConditionBillableOutput: "Billable output tokens",
  deleteTier: "Delete tier",
  priceSync: "Price fetch",
  sourceChannel: "Source upstream channel",
  selectChannel: "Select upstream channel",
  syncFormat: "Price format",
  customSyncPath: "Custom path",
  fetchPrices: "Fetch prices",
  channelRequired: "Select an upstream channel",
  syncPreviewFailed: "Failed to fetch prices",
  syncFailed: "Failed to sync prices",
  syncPreviewTitle: "Select prices to sync",
  selectAll: "Select all",
  syncStatus: "Status",
  exists: "Exists",
  newModel: "New",
  noSyncModels: "No prices fetched",
  submitSelected: "Submit sync",
  browserFallbackTitle: "Fetch failed",
  browserRequestURL: "Request URL",
  includeChannelToken: "Include channel token",
  browserFetch: "Fetch in browser",
  browserFetching: "Fetching in browser",
  browserFetchFailed: "Browser fetch failed",
  browserPreviewFailed: "Failed to parse prices",
  manualPayload: "Manual JSON",
  manualPayloadPlaceholder: "Paste the JSON returned by the price endpoint",
  manualPayloadInvalid: "Invalid JSON",
  parseManualPayload: "Parse JSON",
  missingBaseURL: "Channel Base URL is required",
  close: "Close",
  syncDone: "Prices synced, created {created}, updated {updated}",
  syncPartial: "Prices partially synced, created {created}, updated {updated}, failed {failed}",
}
