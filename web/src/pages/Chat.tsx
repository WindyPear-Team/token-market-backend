import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bot, Check, MessageSquarePlus, Pencil, Send, Trash2, User, X } from "lucide-react"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface UserChannelCatalog {
  id: number
  name: string
  models: string[]
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  updated_at?: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

type ChatEndpoint = "chat" | "responses" | "claude" | "gemini"

const sessionsStoreKey = "windypear.chat.sessions.v1"
const legacyMessagesStoreKey = "windypear.chat.messages.v1"
const selectedSessionStoreKey = "windypear.chat.selected_session.v1"
const modelStoreKey = "windypear.chat.model.v1"
const endpointStoreKey = "windypear.chat.endpoint.v1"

export default function Chat() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const [sessions, setSessions] = useState<ChatSession[]>(() => readStoredSessions())
  const [activeSessionID, setActiveSessionID] = useState(() => localStorage.getItem(selectedSessionStoreKey) || "")
  const [modelName, setModelName] = useState(() => localStorage.getItem(modelStoreKey) || "")
  const [endpointMode, setEndpointMode] = useState<ChatEndpoint>(() => readStoredEndpoint())
  const [apiKey, setAPIKey] = useState("")
  const [prompt, setPrompt] = useState("")
  const [status, setStatus] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [editingMessageID, setEditingMessageID] = useState("")
  const [editingContent, setEditingContent] = useState("")

  const { data: catalog = [] } = useQuery<UserChannelCatalog[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await api.get("/user/catalog")
      return Array.isArray(res.data) ? res.data.map(normalizeCatalogItem) : []
    },
  })

  const modelOptions = useMemo(() => uniqueModels(catalog), [catalog])
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionID) || sessions[0],
    [sessions, activeSessionID]
  )

  useEffect(() => {
    localStorage.setItem(sessionsStoreKey, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    if (!activeSessionID && sessions[0]) {
      setActiveSessionID(sessions[0].id)
      return
    }
    if (activeSessionID && !sessions.some((session) => session.id === activeSessionID) && sessions[0]) {
      setActiveSessionID(sessions[0].id)
    }
  }, [activeSessionID, sessions])

  useEffect(() => {
    if (activeSessionID) {
      localStorage.setItem(selectedSessionStoreKey, activeSessionID)
    }
  }, [activeSessionID])

  useEffect(() => {
    if (modelName) {
      localStorage.setItem(modelStoreKey, modelName)
    }
  }, [modelName])

  useEffect(() => {
    localStorage.setItem(endpointStoreKey, endpointMode)
  }, [endpointMode])

  useEffect(() => {
    if (!modelName && modelOptions.length > 0) {
      setModelName(modelOptions[0])
    }
  }, [modelName, modelOptions])

  const createNewSession = () => {
    const session = createSession()
    setSessions((current) => [session, ...current])
    setActiveSessionID(session.id)
    setPrompt("")
    setStatus("")
    cancelEdit()
  }

  const deleteSession = (sessionID: string) => {
    const nextSessions = sessions.filter((session) => session.id !== sessionID)
    const fallbackSessions = nextSessions.length > 0 ? nextSessions : [createSession()]
    setSessions(fallbackSessions)
    if (activeSessionID === sessionID || !fallbackSessions.some((session) => session.id === activeSessionID)) {
      setActiveSessionID(fallbackSessions[0].id)
    }
    setStatus("")
    cancelEdit()
  }

  const updateSession = (sessionID: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionID) {
          return session
        }
        return { ...updater(session), updated_at: new Date().toISOString() }
      })
    )
  }

  const sendMessage = async () => {
    const content = prompt.trim()
    const rawKey = apiKey.trim()
    const session = activeSession
    if (!session) {
      return
    }
    if (!rawKey) {
      setStatus(copy.keyRequired)
      return
    }
    if (!modelName.trim()) {
      setStatus(copy.modelRequired)
      return
    }
    if (!content) {
      return
    }

    const userMessage = createMessage("user", content)
    const nextMessages = [...session.messages, userMessage]
    const nextTitle = session.title || titleFromMessage(content, copy)
    updateSession(session.id, (current) => ({ ...current, title: nextTitle, messages: nextMessages }))
    setPrompt("")
    setIsSending(true)
    setStatus("")
    cancelEdit()

    try {
      const request = chatRequest(endpointMode, modelName.trim(), rawKey, nextMessages)
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
      })
      const text = await response.text()
      let payload: any = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        payload = null
      }
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || text || `HTTP ${response.status}`)
      }
      const answer = responseTextFromPayload(payload)
      const assistantMessage = createMessage("assistant", answer || copy.emptyResponse)
      updateSession(session.id, (current) => ({ ...current, messages: [...current.messages, assistantMessage] }))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.sendFailed)
    } finally {
      setIsSending(false)
    }
  }

  const beginEditMessage = (message: ChatMessage) => {
    setEditingMessageID(message.id)
    setEditingContent(message.content)
  }

  const saveEditedMessage = () => {
    const content = editingContent.trim()
    if (!activeSession || !editingMessageID || !content) {
      return
    }
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.id === editingMessageID ? { ...message, content, updated_at: new Date().toISOString() } : message
      ),
    }))
    cancelEdit()
  }

  const deleteMessage = (messageID: string) => {
    if (!activeSession) {
      return
    }
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.filter((message) => message.id !== messageID),
    }))
    if (editingMessageID === messageID) {
      cancelEdit()
    }
  }

  function cancelEdit() {
    setEditingMessageID("")
    setEditingContent("")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <Button className="gap-2" onClick={createNewSession}>
          <MessageSquarePlus size={16} />
          {copy.newSession}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{copy.sessions}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border p-2",
                  session.id === activeSession?.id && "border-primary bg-primary/5"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => {
                    setActiveSessionID(session.id)
                    setStatus("")
                    cancelEdit()
                  }}
                >
                  <div className="truncate text-sm font-medium">{session.title || copy.untitledSession}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {copy.messageCount.replace("{count}", String(session.messages.length))}
                  </div>
                </button>
                <Button variant="ghost" size="sm" onClick={() => deleteSession(session.id)} title={copy.deleteSession}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{copy.config}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_minmax(0,1fr)]">
              <Input
                value={apiKey}
                type="password"
                placeholder={copy.keyPlaceholder}
                onChange={(event) => {
                  setAPIKey(event.target.value)
                  setStatus("")
                }}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={endpointMode}
                onChange={(event) => setEndpointMode(normalizeEndpoint(event.target.value))}
              >
                <option value="chat">{copy.chatCompletions}</option>
                <option value="responses">{copy.responsesAPI}</option>
                <option value="claude">{copy.claudeMessages}</option>
                <option value="gemini">{copy.geminiGenerate}</option>
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
              >
                <option value="">{copy.selectModel}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.conversation}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="min-h-[360px] space-y-3 rounded-md border p-3">
                {!activeSession || activeSession.messages.length === 0 ? (
                  <div className="py-20 text-center text-sm text-muted-foreground">{copy.noMessages}</div>
                ) : (
                  activeSession.messages.map((message) => (
                    <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div className="max-w-[92%] rounded-md border bg-background p-3 text-sm">
                        <div className="flex items-start gap-2">
                          {message.role === "user" ? (
                            <User className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <Bot className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            {editingMessageID === message.id ? (
                              <textarea
                                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                value={editingContent}
                                onChange={(event) => setEditingContent(event.target.value)}
                              />
                            ) : (
                              <div className="whitespace-pre-wrap break-words">{message.content}</div>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {editingMessageID === message.id ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={saveEditedMessage} title={copy.saveMessage}>
                                  <Check size={15} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={cancelEdit} title={copy.cancelEdit}>
                                  <X size={15} />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => beginEditMessage(message)} title={copy.editMessage}>
                                  <Pencil size={15} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteMessage(message.id)} title={copy.deleteMessage}>
                                  <Trash2 size={15} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <textarea
                  className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  placeholder={copy.promptPlaceholder}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault()
                      sendMessage()
                    }
                  }}
                />
                <Button className="gap-2 self-end" disabled={!prompt.trim() || isSending} onClick={sendMessage}>
                  <Send size={16} />
                  {isSending ? copy.sending : copy.send}
                </Button>
              </div>
              {status && <div className="text-sm text-muted-foreground">{status}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function readStoredSessions(): ChatSession[] {
  try {
    const value = JSON.parse(localStorage.getItem(sessionsStoreKey) || "[]")
    const sessions = Array.isArray(value) ? value.map(normalizeSession).filter((session): session is ChatSession => Boolean(session)) : []
    if (sessions.length > 0) {
      return sessions
    }
  } catch {
    // Ignore invalid browser storage and fall back to a new session.
  }

  const legacyMessages = readLegacyMessages()
  if (legacyMessages.length > 0) {
    const now = new Date().toISOString()
    return [{ id: createID(), title: "", messages: legacyMessages, created_at: now, updated_at: now }]
  }
  return [createSession()]
}

function readLegacyMessages(): ChatMessage[] {
  try {
    const value = JSON.parse(localStorage.getItem(legacyMessagesStoreKey) || "[]")
    return Array.isArray(value) ? value.map(normalizeMessage).filter((message): message is ChatMessage => Boolean(message)) : []
  } catch {
    return []
  }
}

function readStoredEndpoint(): ChatEndpoint {
  return normalizeEndpoint(localStorage.getItem(endpointStoreKey) || "chat")
}

function normalizeEndpoint(value: string): ChatEndpoint {
  if (value === "responses" || value === "claude" || value === "gemini") {
    return value
  }
  return "chat"
}

function chatRequest(endpoint: ChatEndpoint, modelName: string, apiKey: string, messages: ChatMessage[]) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (endpoint === "gemini") {
    return {
      url: `/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers,
      body: chatRequestPayload(endpoint, modelName, messages),
    }
  }
  if (endpoint === "claude") {
    headers["x-api-key"] = apiKey
    return {
      url: "/v1/messages",
      headers,
      body: chatRequestPayload(endpoint, modelName, messages),
    }
  }
  headers.Authorization = `Bearer ${apiKey}`
  return {
    url: endpoint === "responses" ? "/v1/responses" : "/v1/chat/completions",
    headers,
    body: chatRequestPayload(endpoint, modelName, messages),
  }
}

function chatRequestPayload(endpoint: ChatEndpoint, modelName: string, messages: ChatMessage[]) {
  if (endpoint === "responses") {
    return {
      model: modelName,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }
  }
  if (endpoint === "claude") {
    return {
      model: modelName,
      max_tokens: 1024,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    }
  }
  if (endpoint === "gemini") {
    return {
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    }
  }
  return {
    model: modelName,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
  }
}

function responseTextFromPayload(payload: any): string {
  const chatText = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text
  if (typeof chatText === "string") {
    return chatText
  }
  if (typeof payload?.output_text === "string") {
    return payload.output_text
  }
  if (Array.isArray(payload?.content)) {
    const claudeText = payload.content
      .map((item: any) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim()
    if (claudeText) {
      return claudeText
    }
  }
  if (Array.isArray(payload?.candidates)) {
    const geminiText = payload.candidates
      .flatMap((candidate: any) => {
        const parts = isRecord(candidate?.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : []
        return parts.map((part: any) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      })
      .filter(Boolean)
      .join("\n")
      .trim()
    if (geminiText) {
      return geminiText
    }
  }

  const texts: string[] = []
  const output = Array.isArray(payload?.output) ? payload.output : []
  for (const item of output) {
    if (!isRecord(item)) {
      continue
    }
    if (typeof item.text === "string") {
      texts.push(item.text)
    }
    if (typeof item.content === "string") {
      texts.push(item.content)
    }
    if (Array.isArray(item.content)) {
      for (const content of item.content) {
        if (!isRecord(content)) {
          continue
        }
        if (typeof content.text === "string") {
          texts.push(content.text)
        } else if (typeof content.output_text === "string") {
          texts.push(content.output_text)
        }
      }
    }
  }
  return texts.join("\n").trim()
}

function normalizeSession(value: unknown): ChatSession | null {
  if (!isRecord(value)) {
    return null
  }
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((message): message is ChatMessage => Boolean(message))
    : []
  return {
    id: typeof value.id === "string" && value.id ? value.id : createID(),
    title: typeof value.title === "string" ? value.title : "",
    messages,
    created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString(),
  }
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) {
    return null
  }
  if (value.role !== "user" && value.role !== "assistant") {
    return null
  }
  if (typeof value.content !== "string") {
    return null
  }
  return {
    id: typeof value.id === "string" && value.id ? value.id : createID(),
    role: value.role,
    content: value.content,
    created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
  }
}

function createSession(): ChatSession {
  const now = new Date().toISOString()
  return { id: createID(), title: "", messages: [], created_at: now, updated_at: now }
}

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: createID(), role, content, created_at: new Date().toISOString() }
}

function createID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function titleFromMessage(content: string, copy: typeof zhCopy) {
  const title = content.replace(/\s+/g, " ").trim()
  return title ? title.slice(0, 28) : copy.untitledSession
}

function uniqueModels(catalog: UserChannelCatalog[]) {
  return Array.from(new Set(catalog.flatMap((channel) => channel.models))).sort()
}

function normalizeCatalogItem(value: unknown): UserChannelCatalog {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    models: Array.isArray(item.models) ? item.models.filter((model): model is string => typeof model === "string") : [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const zhCopy = {
  title: "聊天",
  sessions: "会话",
  newSession: "新会话",
  untitledSession: "新会话",
  messageCount: "{count} 条消息",
  deleteSession: "删除会话",
  config: "配置",
  chatCompletions: "Chat Completions",
  responsesAPI: "Responses",
  claudeMessages: "Claude Messages",
  geminiGenerate: "Gemini GenerateContent",
  keyPlaceholder: "填写 sk- 令牌",
  selectModel: "选择模型",
  conversation: "对话",
  noMessages: "暂无对话",
  promptPlaceholder: "输入消息",
  send: "发送",
  sending: "发送中",
  editMessage: "编辑消息",
  deleteMessage: "删除消息",
  saveMessage: "保存消息",
  cancelEdit: "取消编辑",
  keyRequired: "请填写令牌",
  modelRequired: "请选择模型",
  sendFailed: "发送失败",
  emptyResponse: "空响应",
}

const enCopy: typeof zhCopy = {
  title: "Chat",
  sessions: "Sessions",
  newSession: "New chat",
  untitledSession: "New chat",
  messageCount: "{count} messages",
  deleteSession: "Delete session",
  config: "Config",
  chatCompletions: "Chat Completions",
  responsesAPI: "Responses",
  claudeMessages: "Claude Messages",
  geminiGenerate: "Gemini GenerateContent",
  keyPlaceholder: "Enter sk- token",
  selectModel: "Select model",
  conversation: "Conversation",
  noMessages: "No messages",
  promptPlaceholder: "Enter message",
  send: "Send",
  sending: "Sending",
  editMessage: "Edit message",
  deleteMessage: "Delete message",
  saveMessage: "Save message",
  cancelEdit: "Cancel edit",
  keyRequired: "Enter a token first",
  modelRequired: "Select a model",
  sendFailed: "Send failed",
  emptyResponse: "Empty response",
}
