import { useQuery } from "@tanstack/react-query"
import { PublicTopBar } from "@/components/layout/PublicTopBar"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"

type ContentKind = "about" | "privacy" | "terms"

export default function PublicContent({ kind }: { kind: ContentKind }) {
  const { language } = useI18n()
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const labels = language === "zh"
    ? { about: "关于", privacy: "隐私政策", terms: "用户协议" }
    : { about: "About", privacy: "Privacy", terms: "Terms" }
  const title = labels[kind]
  const content = kind === "about"
    ? publicSettings.about_html
    : kind === "privacy"
      ? publicSettings.privacy_policy
      : publicSettings.terms

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicTopBar settings={publicSettings} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div
          className="min-h-40 rounded-md border bg-card p-4 text-sm leading-7 text-foreground sm:p-6"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </main>
      {publicSettings.footer_text && (
        <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground sm:px-6">
          {publicSettings.footer_text}
        </footer>
      )}
    </div>
  )
}
