import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"

interface SetupResponse {
  token: string
}

export default function Setup() {
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
  const [siteNameEdited, setSiteNameEdited] = useState(false)
  const [siteName, setSiteName] = useState("WindyPear API")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (siteNameEdited) {
      return
    }
    const configuredName = publicSettings.site_name.trim()
    if (configuredName && configuredName !== "flai") {
      setSiteName(configuredName)
    }
  }, [publicSettings.site_name, siteNameEdited])

  const completeSetup = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: siteName,
          username,
          email,
          password,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || copy.failed)
      }
      return body as SetupResponse
    },
    onSuccess: (result) => {
      localStorage.setItem("token", result.token)
      localStorage.removeItem("referral_code")
      window.location.href = "/dashboard"
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : copy.failed),
  })

  const canSubmit = Boolean(siteName.trim() && username.trim() && email.trim() && password.length >= 8)

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-[460px]">
        <CardHeader className="text-center">
          {publicSettings.icon_url && (
            <img src={publicSettings.icon_url} alt="" className="mx-auto h-12 w-12 rounded object-cover" />
          )}
          <CardTitle className="text-3xl font-bold">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Input
              value={siteName}
              maxLength={80}
              placeholder={copy.siteNamePlaceholder}
              onChange={(event) => {
                setSiteNameEdited(true)
                setSiteName(event.target.value)
              }}
            />
            <Input
              value={username}
              maxLength={100}
              placeholder={copy.usernamePlaceholder}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              value={email}
              type="email"
              maxLength={100}
              placeholder={copy.emailPlaceholder}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              value={password}
              type="password"
              placeholder={copy.passwordPlaceholder}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <Button className="w-full" disabled={!canSubmit || completeSetup.isPending} onClick={() => completeSetup.mutate()}>
            {completeSetup.isPending ? copy.creating : copy.submit}
          </Button>

          {status && <div className="text-center text-sm text-muted-foreground">{status}</div>}
        </CardContent>
      </Card>
    </div>
  )
}

const zhCopy = {
  title: "初始化站点",
  description: "配置首个管理员账号",
  siteNamePlaceholder: "站点名称",
  usernamePlaceholder: "管理员用户名",
  emailPlaceholder: "管理员邮箱",
  passwordPlaceholder: "管理员密码，至少 8 位",
  submit: "完成初始化",
  creating: "正在初始化...",
  failed: "初始化失败",
}

const enCopy: typeof zhCopy = {
  title: "Initial Setup",
  description: "Create the first administrator account",
  siteNamePlaceholder: "Site name",
  usernamePlaceholder: "Admin username",
  emailPlaceholder: "Admin email",
  passwordPlaceholder: "Admin password, at least 8 characters",
  submit: "Complete setup",
  creating: "Setting up...",
  failed: "Setup failed",
}
