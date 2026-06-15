import { Link } from "react-router-dom"
import type { PublicSettings } from "@/lib/public-settings"
import { parseTopNavItems } from "@/lib/public-settings"

export function PublicTopBar({ settings }: { settings: PublicSettings }) {
  const topNavItems = parseTopNavItems(settings.top_nav_items)

  return (
    <header className="border-b px-4 sm:px-6">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          {settings.icon_url && (
            <img src={settings.icon_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
          )}
          <div className="truncate text-lg font-semibold">{settings.site_name}</div>
        </Link>
        {settings.top_nav_enabled && topNavItems.length > 0 && (
          <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
            {topNavItems.map((item) => (
              <TopNavLink key={`${item.label}-${item.href}`} label={item.label} href={item.href} external={item.external} />
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}

function TopNavLink({ label, href, external }: { label: string; href: string; external: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    )
  }
  return <Link to={href}>{label}</Link>
}
