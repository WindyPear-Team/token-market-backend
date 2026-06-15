import { Sidebar } from "./Sidebar"
import { Menu, UserCircle, X } from "lucide-react"
import { Link, Outlet } from "react-router-dom"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import type { PublicSettings } from "@/lib/public-settings"
import { parseTopNavItems, withPublicSettingsDefaults } from "@/lib/public-settings"

interface CurrentUser {
  username?: string
  email?: string
  avatar_url?: string
}

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const { data: user } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const topNavItems = parseTopNavItems(publicSettings.top_nav_items)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button className="lg:hidden" variant="outline" size="icon" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </Button>
          <Brand settings={publicSettings} />
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {publicSettings.top_nav_enabled && topNavItems.length > 0 && (
            <div className="hidden min-w-0 items-center gap-4 text-sm text-muted-foreground lg:flex">
              {topNavItems.map((item) => (
                <NavLink key={`${item.label}-${item.href}`} label={item.label} href={item.href} external={item.external} />
              ))}
            </div>
          )}
          <UserAvatar user={user} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block lg:h-full lg:shrink-0">
          <Sidebar />
        </div>

        {isSidebarOpen && (
          <div className="fixed inset-0 top-16 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close menu"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="relative z-50 h-full w-72 max-w-[85vw]">
              <Sidebar className="w-full" onNavigate={() => setIsSidebarOpen(false)} />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-4 z-50 bg-background"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </Button>
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {publicSettings.announcement && (
            <div className="border-b bg-muted/50 px-4 py-3 text-sm sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl whitespace-pre-wrap">{publicSettings.announcement}</div>
            </div>
          )}
          <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
          {publicSettings.footer_text && (
            <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
              {publicSettings.footer_text}
            </footer>
          )}
        </main>
      </div>
    </div>
  )
}

function UserAvatar({ user }: { user?: CurrentUser }) {
  const label = user?.username || user?.email || "User"
  const initials = avatarInitials(label)
  return (
    <Link
      to="/dashboard/settings"
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold text-foreground hover:bg-accent"
      title={label}
      aria-label={label}
    >
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <UserCircle size={20} />
      )}
    </Link>
  )
}

function avatarInitials(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

function Brand({ settings, className }: { settings: PublicSettings; className?: string }) {
  return (
    <Link to="/" className={className ? `flex min-w-0 items-center gap-2 ${className}` : "flex min-w-0 items-center gap-2"}>
      {settings.icon_url && <img src={settings.icon_url} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />}
      <span className="truncate text-sm font-semibold">{settings.site_name}</span>
    </Link>
  )
}

function NavLink({ label, href, external }: { label: string; href: string; external: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    )
  }
  return <Link to={href}>{label}</Link>
}
