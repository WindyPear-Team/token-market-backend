import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import api, { getAuthLoginURL } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"
import { passkeyCredentialToJSON, passkeySupported, preparePasskeyRequestOptions } from "@/lib/passkey"

type Mode = "login" | "register"

export default function Login() {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const initialMode = publicSettings.password_login_enabled ? "login" : "register"
  const [mode, setMode] = useState<Mode>(initialMode)
  const [identifier, setIdentifier] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [status, setStatus] = useState("")
  const labels = language === "zh"
    ? { about: "关于", privacy: "隐私政策", terms: "用户协议" }
    : { about: "About", privacy: "Privacy", terms: "Terms" }

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get("ref")
    if (referralCode) {
      localStorage.setItem("referral_code", referralCode)
    }
  }, [])

  useEffect(() => {
    if (mode === "login" && !publicSettings.password_login_enabled && publicSettings.password_registration_enabled) {
      setMode("register")
    }
    if (mode === "register" && !publicSettings.password_registration_enabled && publicSettings.password_login_enabled) {
      setMode("login")
    }
  }, [mode, publicSettings.password_login_enabled, publicSettings.password_registration_enabled])

  const submitPassword = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/auth/password/login" : "/auth/password/register"
      const payload = mode === "login"
        ? { identifier, password, captcha_token: captchaToken }
        : {
            username,
            email,
            password,
            email_code: emailCode,
            captcha_token: captchaToken,
            referral_code: localStorage.getItem("referral_code") || "",
          }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || copy.authFailed)
      }
      return body as { token: string }
    },
    onSuccess: (result) => {
      localStorage.setItem("token", result.token)
      localStorage.removeItem("referral_code")
      window.location.href = "/dashboard"
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : copy.authFailed),
  })

  const signInWithPasskey = useMutation({
    mutationFn: async () => {
      if (!passkeySupported()) {
        throw new Error(copy.passkeyUnsupported)
      }
      const optionsResponse = await fetch("/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      })
      const options = await optionsResponse.json().catch(() => ({}))
      if (!optionsResponse.ok) {
        throw new Error(options.error || copy.passkeyFailed)
      }
      const credential = await navigator.credentials.get({
        publicKey: preparePasskeyRequestOptions(options),
      })
      const payload = passkeyCredentialToJSON(credential)
      if (!payload) {
        throw new Error(copy.passkeyFailed)
      }
      const response = await fetch("/auth/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || copy.passkeyFailed)
      }
      return body as { token: string }
    },
    onSuccess: (result) => {
      localStorage.setItem("token", result.token)
      localStorage.removeItem("referral_code")
      window.location.href = "/dashboard"
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : copy.passkeyFailed),
  })

  const sendCode = useMutation({
    mutationFn: async () => {
      const response = await fetch("/auth/password/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captcha_token: captchaToken }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || copy.sendCodeFailed)
      }
      return body
    },
    onSuccess: () => setStatus(copy.codeSent),
    onError: (error) => setStatus(error instanceof Error ? error.message : copy.sendCodeFailed),
  })

  const handleOIDCLogin = () => {
    window.location.href = getAuthLoginURL(new URLSearchParams(window.location.search).get("ref"))
  }

  const canSubmit = mode === "login"
    ? Boolean(identifier.trim() && password)
    : Boolean(username.trim() && email.trim() && password && (!publicSettings.email_verification_required || emailCode.trim()))
  const noLoginMethod = !publicSettings.password_login_enabled && !publicSettings.password_registration_enabled && !publicSettings.oidc_enabled && !publicSettings.passkey_enabled

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-[440px]">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto block">
            {publicSettings.icon_url && (
              <img src={publicSettings.icon_url} alt="" className="mx-auto h-12 w-12 rounded object-cover" />
            )}
            <CardTitle className="mt-2 text-3xl font-bold">{publicSettings.site_name}</CardTitle>
          </Link>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {noLoginMethod ? (
            <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">{copy.noLoginMethod}</div>
          ) : (
            <>
              {(publicSettings.password_login_enabled || publicSettings.password_registration_enabled) && (
                <div className="flex rounded-md border p-1">
                  {publicSettings.password_login_enabled && (
                    <Button variant={mode === "login" ? "default" : "ghost"} className="flex-1" onClick={() => setMode("login")}>
                      {copy.login}
                    </Button>
                  )}
                  {publicSettings.password_registration_enabled && (
                    <Button variant={mode === "register" ? "default" : "ghost"} className="flex-1" onClick={() => setMode("register")}>
                      {copy.register}
                    </Button>
                  )}
                </div>
              )}

              {mode === "login" && publicSettings.password_login_enabled && (
                <div className="space-y-3">
                  <Input value={identifier} placeholder={copy.identifierPlaceholder} onChange={(event) => setIdentifier(event.target.value)} />
                  <Input value={password} type="password" placeholder={copy.passwordPlaceholder} onChange={(event) => setPassword(event.target.value)} />
                </div>
              )}

              {mode === "register" && publicSettings.password_registration_enabled && (
                <div className="space-y-3">
                  <Input value={username} placeholder={copy.usernamePlaceholder} onChange={(event) => setUsername(event.target.value)} />
                  <Input value={email} type="email" placeholder={copy.emailPlaceholder} onChange={(event) => setEmail(event.target.value)} />
                  <Input value={password} type="password" placeholder={copy.passwordPlaceholder} onChange={(event) => setPassword(event.target.value)} />
                  {publicSettings.email_verification_required && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input value={emailCode} placeholder={copy.emailCodePlaceholder} onChange={(event) => setEmailCode(event.target.value)} />
                      <Button variant="outline" className="shrink-0" disabled={!email.trim() || sendCode.isPending} onClick={() => sendCode.mutate()}>
                        {copy.sendCode}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {publicSettings.passkey_enabled && !publicSettings.password_login_enabled && (
                <Input value={identifier} placeholder={copy.passkeyIdentifierPlaceholder} onChange={(event) => setIdentifier(event.target.value)} />
              )}

              {publicSettings.password_hcaptcha_enabled && publicSettings.hcaptcha_site_key && (
                <HCaptcha siteKey={publicSettings.hcaptcha_site_key} onToken={setCaptchaToken} />
              )}

              {(publicSettings.password_login_enabled || publicSettings.password_registration_enabled) && (
                <Button className="w-full" disabled={!canSubmit || submitPassword.isPending} onClick={() => submitPassword.mutate()}>
                  {mode === "login" ? copy.login : copy.register}
                </Button>
              )}

              {publicSettings.oidc_enabled && (
                <Button variant="outline" className="w-full" onClick={handleOIDCLogin}>
                  {t("login.button")}
                </Button>
              )}

              {publicSettings.passkey_enabled && (
                <Button variant="outline" className="w-full" disabled={signInWithPasskey.isPending} onClick={() => signInWithPasskey.mutate()}>
                  {copy.passkeyLogin}
                </Button>
              )}
            </>
          )}

          {status && <div className="text-center text-sm text-muted-foreground">{status}</div>}
          {(publicSettings.about_html || publicSettings.privacy_policy || publicSettings.terms) && (
            <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              {publicSettings.about_html && <Link to="/about">{labels.about}</Link>}
              {publicSettings.privacy_policy && <Link to="/privacy">{labels.privacy}</Link>}
              {publicSettings.terms && <Link to="/terms">{labels.terms}</Link>}
            </div>
          )}
          {publicSettings.footer_text && (
            <div className="text-center text-xs text-muted-foreground">{publicSettings.footer_text}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HCaptcha({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIDRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const render = () => {
      const hcaptcha = (window as any).hcaptcha
      if (!containerRef.current || !hcaptcha || widgetIDRef.current || cancelled) {
        return
      }
      widgetIDRef.current = hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken(""),
      })
    }

    if (!(window as any).hcaptcha) {
      const existingScript = document.querySelector<HTMLScriptElement>("script[data-hcaptcha]")
      const script = existingScript || document.createElement("script")
      script.src = "https://js.hcaptcha.com/1/api.js?render=explicit"
      script.async = true
      script.defer = true
      script.dataset.hcaptcha = "true"
      script.addEventListener("load", render)
      if (!existingScript) {
        document.body.appendChild(script)
      }
    } else {
      render()
    }

    return () => {
      cancelled = true
    }
  }, [siteKey, onToken])

  return <div ref={containerRef} className="flex justify-center" />
}

const zhCopy = {
  login: "登录",
  register: "注册",
  identifierPlaceholder: "用户名或邮箱",
  usernamePlaceholder: "用户名",
  emailPlaceholder: "邮箱",
  passwordPlaceholder: "密码，至少 8 位",
  emailCodePlaceholder: "邮箱验证码",
  sendCode: "发送验证码",
  codeSent: "验证码已发送",
  sendCodeFailed: "验证码发送失败",
  authFailed: "认证失败",
  passkeyLogin: "Passkey 登录",
  passkeyIdentifierPlaceholder: "用户名或邮箱（可选）",
  passkeyUnsupported: "当前浏览器不支持 Passkey",
  passkeyFailed: "Passkey 登录失败",
  noLoginMethod: "当前没有启用可用的登录方式",
}

const enCopy: typeof zhCopy = {
  login: "Sign in",
  register: "Sign up",
  identifierPlaceholder: "Username or email",
  usernamePlaceholder: "Username",
  emailPlaceholder: "Email",
  passwordPlaceholder: "Password, at least 8 characters",
  emailCodePlaceholder: "Email code",
  sendCode: "Send code",
  codeSent: "Verification code sent",
  sendCodeFailed: "Failed to send code",
  authFailed: "Authentication failed",
  passkeyLogin: "Sign in with passkey",
  passkeyIdentifierPlaceholder: "Username or email (optional)",
  passkeyUnsupported: "This browser does not support passkeys",
  passkeyFailed: "Passkey sign-in failed",
  noLoginMethod: "No login method is enabled",
}
