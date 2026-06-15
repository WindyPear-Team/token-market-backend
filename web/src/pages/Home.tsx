import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicTopBar } from "@/components/layout/PublicTopBar"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"

export default function Home() {
  const { language } = useI18n()
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const hasToken = Boolean(localStorage.getItem("token"))
  const labels =
    language === "zh"
      ? { dashboard: "进入控制台", login: "登录" }
      : { dashboard: "Dashboard", login: "Sign in" }

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get("ref")
    if (referralCode) {
      localStorage.setItem("referral_code", referralCode)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicTopBar settings={publicSettings} />

      {publicSettings.announcement && (
        <div className="border-b bg-muted/50 px-4 py-3 text-sm sm:px-6">
          <div className="mx-auto max-w-6xl whitespace-pre-wrap">{publicSettings.announcement}</div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {publicSettings.home_iframe_url ? (
          <iframe title="home" src={publicSettings.home_iframe_url} className="min-h-[70vh] w-full flex-1 rounded-md border" />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xl space-y-6 text-center">
              <h1 className="text-4xl font-bold">{publicSettings.site_name}</h1>
              <Button className="gap-2" asChild>
                <Link to={hasToken ? "/dashboard" : "/login"}>
                  {hasToken ? labels.dashboard : labels.login}
                  <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </div>
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
