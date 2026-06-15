import { BarChart3, Boxes, ChevronDown, Database, History, KeyRound, LayoutDashboard, MessageSquare, Palette, Settings, Shield, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"
import { cn } from "@/lib/utils"

interface CurrentUser {
  is_admin: boolean
}

interface MenuItem {
  icon: LucideIcon
  labelKey: "nav.dashboard" | "nav.usage" | "nav.apiKeys" | "nav.chat" | "nav.images" | "nav.settings" | "nav.adminOverview" | "nav.system" | "nav.channels" | "nav.models" | "nav.users"
  path: string
  settingKey: keyof PublicSettings
  children?: SystemSubItem[]
}

interface SystemSubItem {
  path: string
  zh: string
  en: string
}

const systemSubItems: SystemSubItem[] = [
  { path: "/dashboard/admin/general", zh: "系统设置", en: "General" },
  { path: "/dashboard/admin/auth", zh: "认证邮件", en: "Auth & Email" },
  { path: "/dashboard/admin/content", zh: "内容导航", en: "Content & Navigation" },
  { path: "/dashboard/admin/operations", zh: "运营工具", en: "Operations" },
]

const userMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/dashboard", settingKey: "sidebar_dashboard_enabled" },
  { icon: History, labelKey: "nav.usage", path: "/dashboard/logs", settingKey: "sidebar_usage_enabled" },
  { icon: KeyRound, labelKey: "nav.apiKeys", path: "/dashboard/api-keys", settingKey: "sidebar_api_keys_enabled" },
  { icon: MessageSquare, labelKey: "nav.chat", path: "/dashboard/chat", settingKey: "sidebar_chat_enabled" },
  { icon: Palette, labelKey: "nav.images", path: "/dashboard/images", settingKey: "sidebar_images_enabled" },
  { icon: Settings, labelKey: "nav.settings", path: "/dashboard/settings", settingKey: "sidebar_settings_enabled" },
]

const adminMenuItems: MenuItem[] = [
  { icon: BarChart3, labelKey: "nav.adminOverview", path: "/dashboard/admin-overview", settingKey: "sidebar_admin_overview_enabled" },
  { icon: Shield, labelKey: "nav.system", path: "/dashboard/admin/general", settingKey: "sidebar_system_enabled", children: systemSubItems },
  { icon: Database, labelKey: "nav.channels", path: "/dashboard/channels", settingKey: "sidebar_channels_enabled" },
  { icon: Boxes, labelKey: "nav.models", path: "/dashboard/models", settingKey: "sidebar_models_enabled" },
  { icon: Users, labelKey: "nav.users", path: "/dashboard/users", settingKey: "sidebar_users_enabled" },
]

export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const location = useLocation()
  const { language, setLanguage, t } = useI18n()
  const { data: user } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const visibleUserItems = userMenuItems.filter((item) => publicSettings[item.settingKey] !== false)
  const visibleAdminItems = adminMenuItems.filter((item) => publicSettings[item.settingKey] !== false)

  return (
    <div className={cn("flex h-full w-64 flex-col border-r bg-card", className)}>
      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-1">
          {visibleUserItems.map((item) => (
            <SidebarLink key={item.path} item={item} active={location.pathname === item.path} onNavigate={onNavigate} />
          ))}
          {user?.is_admin && visibleAdminItems.length > 0 && (
            <>
              <div className="my-2 border-t" />
              {visibleAdminItems.map((item) => (
                <SidebarLink
                  key={item.path}
                  item={item}
                  active={isSidebarItemActive(location.pathname, item)}
                  currentPath={location.pathname}
                  language={language}
                  onNavigate={onNavigate}
                />
              ))}
            </>
          )}
        </div>
      </nav>
      <div className="shrink-0 border-t p-4">
        <div className="flex rounded-md border p-1 text-sm">
          <button
            type="button"
            className={cn("flex-1 rounded px-2 py-1", language === "zh" && "bg-primary text-primary-foreground")}
            onClick={() => setLanguage("zh")}
          >
            {t("settings.chinese")}
          </button>
          <button
            type="button"
            className={cn("flex-1 rounded px-2 py-1", language === "en" && "bg-primary text-primary-foreground")}
            onClick={() => setLanguage("en")}
          >
            {t("settings.english")}
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarLink({
  item,
  active,
  currentPath = "",
  language = "zh",
  onNavigate,
}: {
  item: MenuItem
  active: boolean
  currentPath?: string
  language?: "zh" | "en"
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  const isExpanded = active && Boolean(item.children?.length)
  return (
    <div>
      <Link
        to={item.path}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm font-medium",
          active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        )}
      >
        <item.icon size={18} />
        <span className="flex-1">{t(item.labelKey)}</span>
        {item.children && <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />}
      </Link>
      {isExpanded && item.children && (
        <div className="ml-7 mt-1 flex flex-col gap-1 border-l pl-3">
          {item.children.map((child) => {
            const childActive = currentPath === child.path
            return (
              <Link
                key={child.path}
                to={child.path}
                onClick={onNavigate}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  childActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {language === "zh" ? child.zh : child.en}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function isSidebarItemActive(pathname: string, item: MenuItem) {
  if (item.children?.length) {
    return pathname === item.path || item.children.some((child) => pathname === child.path) || pathname.startsWith("/dashboard/admin/")
  }
  return pathname === item.path
}
