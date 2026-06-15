import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Image as ImageIcon, WandSparkles } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"

interface UserChannelCatalog {
  id: number
  name: string
  models: string[]
}

interface ImageResult {
  url: string
  b64_json: string
  revised_prompt: string
}

type ImageResponseFormat = "auto" | "url" | "b64_json"

const modelStoreKey = "windypear.images.model.v1"
const sizeStoreKey = "windypear.images.size.v1"
const responseFormatStoreKey = "windypear.images.response_format.v1"
const countStoreKey = "windypear.images.count.v1"

const imageSizes = ["auto", "1024x1024", "1024x1536", "1536x1024", "1024x1792", "1792x1024"]
const responseFormats: ImageResponseFormat[] = ["auto", "url", "b64_json"]

export default function Images() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const [apiKey, setAPIKey] = useState("")
  const [modelName, setModelName] = useState(() => localStorage.getItem(modelStoreKey) || "")
  const [prompt, setPrompt] = useState("")
  const [size, setSize] = useState(() => localStorage.getItem(sizeStoreKey) || "auto")
  const [count, setCount] = useState(() => normalizeCount(localStorage.getItem(countStoreKey) || "1"))
  const [responseFormat, setResponseFormat] = useState<ImageResponseFormat>(() => normalizeResponseFormat(localStorage.getItem(responseFormatStoreKey) || "auto"))
  const [results, setResults] = useState<ImageResult[]>([])
  const [status, setStatus] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: catalog = [] } = useQuery<UserChannelCatalog[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await api.get("/user/catalog")
      return Array.isArray(res.data) ? res.data.map(normalizeCatalogItem) : []
    },
  })

  const modelOptions = useMemo(() => uniqueModels(catalog), [catalog])

  useEffect(() => {
    if (!modelName && modelOptions.length > 0) {
      setModelName(modelOptions[0])
    }
  }, [modelName, modelOptions])

  useEffect(() => {
    if (modelName) {
      localStorage.setItem(modelStoreKey, modelName)
    }
  }, [modelName])

  useEffect(() => {
    localStorage.setItem(sizeStoreKey, size)
  }, [size])

  useEffect(() => {
    localStorage.setItem(countStoreKey, String(count))
  }, [count])

  useEffect(() => {
    localStorage.setItem(responseFormatStoreKey, responseFormat)
  }, [responseFormat])

  const generateImages = async () => {
    const rawKey = apiKey.trim()
    const cleanPrompt = prompt.trim()
    const cleanModel = modelName.trim()
    if (!rawKey) {
      setStatus(copy.keyRequired)
      return
    }
    if (!cleanModel) {
      setStatus(copy.modelRequired)
      return
    }
    if (!cleanPrompt) {
      setStatus(copy.promptRequired)
      return
    }

    setIsGenerating(true)
    setStatus("")
    try {
      const body: Record<string, string | number> = {
        model: cleanModel,
        prompt: cleanPrompt,
        n: count,
      }
      if (size !== "auto") {
        body.size = size
      }
      if (responseFormat !== "auto") {
        body.response_format = responseFormat
      }

      const response = await fetch("/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rawKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      const text = await response.text()
      const payload = parseJSON(text)
      if (!response.ok) {
        throw new Error(errorMessage(payload, text, response.status))
      }
      const nextResults = imageResultsFromPayload(payload)
      setResults(nextResults)
      setStatus(nextResults.length > 0 ? copy.generated.replace("{count}", String(nextResults.length)) : copy.emptyResponse)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.generateFailed)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <Button className="gap-2" disabled={isGenerating || !prompt.trim()} onClick={generateImages}>
          <WandSparkles size={16} />
          {isGenerating ? copy.generating : copy.generate}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{copy.config}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">{copy.apiKey}</span>
              <Input
                value={apiKey}
                type="password"
                placeholder={copy.keyPlaceholder}
                onChange={(event) => {
                  setAPIKey(event.target.value)
                  setStatus("")
                }}
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">{copy.model}</span>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={modelName} onChange={(event) => setModelName(event.target.value)}>
                <option value="">{copy.selectModel}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{copy.size}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={size} onChange={(event) => setSize(event.target.value)}>
                  {imageSizes.map((option) => (
                    <option key={option} value={option}>
                      {option === "auto" ? copy.auto : option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{copy.count}</span>
                <Input min={1} max={4} type="number" value={count} onChange={(event) => setCount(normalizeCount(event.target.value))} />
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">{copy.responseFormat}</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={responseFormat}
                onChange={(event) => setResponseFormat(normalizeResponseFormat(event.target.value))}
              >
                {responseFormats.map((format) => (
                  <option key={format} value={format}>
                    {format === "auto" ? copy.auto : format}
                  </option>
                ))}
              </select>
            </label>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{copy.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="min-h-36 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={prompt}
                placeholder={copy.promptPlaceholder}
                onChange={(event) => {
                  setPrompt(event.target.value)
                  setStatus("")
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button className="gap-2" disabled={isGenerating || !prompt.trim()} onClick={generateImages}>
                  <WandSparkles size={16} />
                  {isGenerating ? copy.generating : copy.generate}
                </Button>
                {status && <div className="text-sm text-muted-foreground">{status}</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.results}</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-md border text-center text-sm text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <div>{copy.noResults}</div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {results.map((result, index) => {
                    const source = imageSource(result)
                    return (
                      <div key={`${index}-${source.slice(0, 36)}`} className="space-y-3 rounded-md border p-3">
                        <div className="aspect-square overflow-hidden rounded-md bg-muted">
                          {source ? <img src={source} alt={copy.resultAlt.replace("{index}", String(index + 1))} className="h-full w-full object-contain" /> : null}
                        </div>
                        {result.revised_prompt && <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{result.revised_prompt}</div>}
                        {source && (
                          <Button asChild variant="outline" size="sm" className="gap-2">
                            <a href={source} download={`image-${index + 1}.png`} target={result.url ? "_blank" : undefined} rel={result.url ? "noreferrer" : undefined}>
                              <Download size={15} />
                              {copy.download}
                            </a>
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function normalizeCount(value: string) {
  const count = Number.parseInt(value, 10)
  if (!Number.isFinite(count)) {
    return 1
  }
  return Math.min(4, Math.max(1, count))
}

function normalizeResponseFormat(value: string): ImageResponseFormat {
  if (value === "url" || value === "b64_json") {
    return value
  }
  return "auto"
}

function normalizeCatalogItem(value: unknown): UserChannelCatalog {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    models: Array.isArray(item.models) ? item.models.filter((model): model is string => typeof model === "string") : [],
  }
}

function uniqueModels(catalog: UserChannelCatalog[]) {
  return Array.from(new Set(catalog.flatMap((channel) => channel.models))).sort()
}

function parseJSON(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function errorMessage(payload: unknown, text: string, status: number) {
  if (isRecord(payload)) {
    if (typeof payload.error === "string") {
      return payload.error
    }
    if (isRecord(payload.error) && typeof payload.error.message === "string") {
      return payload.error.message
    }
    if (typeof payload.message === "string") {
      return payload.message
    }
  }
  return text || `HTTP ${status}`
}

function imageResultsFromPayload(payload: unknown): ImageResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return []
  }
  return payload.data
    .filter(isRecord)
    .map((item) => ({
      url: typeof item.url === "string" ? item.url : "",
      b64_json: typeof item.b64_json === "string" ? item.b64_json : "",
      revised_prompt: typeof item.revised_prompt === "string" ? item.revised_prompt : "",
    }))
    .filter((item) => item.url || item.b64_json)
}

function imageSource(result: ImageResult) {
  if (result.url) {
    return result.url
  }
  if (result.b64_json.startsWith("data:")) {
    return result.b64_json
  }
  return `data:image/png;base64,${result.b64_json}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const zhCopy = {
  title: "AI 绘画",
  config: "配置",
  apiKey: "API Key",
  keyPlaceholder: "填写 sk- 令牌",
  model: "模型",
  selectModel: "选择模型",
  size: "尺寸",
  count: "数量",
  responseFormat: "响应格式",
  auto: "自动",
  prompt: "提示词",
  promptPlaceholder: "输入绘画提示词",
  generate: "生成",
  generating: "生成中",
  results: "结果",
  noResults: "暂无图片",
  download: "下载",
  keyRequired: "请填写令牌",
  modelRequired: "请选择模型",
  promptRequired: "请输入提示词",
  generateFailed: "生成失败",
  generated: "已生成 {count} 张图片",
  emptyResponse: "空响应",
  resultAlt: "生成图片 {index}",
}

const enCopy: typeof zhCopy = {
  title: "AI Images",
  config: "Config",
  apiKey: "API Key",
  keyPlaceholder: "Enter sk- token",
  model: "Model",
  selectModel: "Select model",
  size: "Size",
  count: "Count",
  responseFormat: "Response format",
  auto: "Auto",
  prompt: "Prompt",
  promptPlaceholder: "Enter an image prompt",
  generate: "Generate",
  generating: "Generating",
  results: "Results",
  noResults: "No images yet",
  download: "Download",
  keyRequired: "Enter a token first",
  modelRequired: "Select a model",
  promptRequired: "Enter a prompt",
  generateFailed: "Generation failed",
  generated: "Generated {count} images",
  emptyResponse: "Empty response",
  resultAlt: "Generated image {index}",
}
