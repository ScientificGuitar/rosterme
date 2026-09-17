import { Link, useLocation } from "react-router-dom"
import { useClerk, useUser } from "@clerk/react"
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemedUserButton } from "@/components/ThemedUserButton"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, soon: false },
  { to: "/groups", label: "Groups", icon: Users, soon: false },
  { to: "/reports", label: "Reports", icon: BarChart3, soon: true },
]

function isActive(pathname: string, to: string): boolean {
  if (to === "/dashboard") return pathname === "/dashboard"
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppSidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean
  onClose: () => void
}) {
  const location = useLocation()
  const { signOut } = useClerk()
  const { user } = useUser()
  const isSuperAdmin =
    (user?.publicMetadata as { role?: string } | undefined)?.role ===
    "superAdmin"
  const visibleNavItems = isSuperAdmin
    ? [
        ...navItems,
        { to: "/admin", label: "SuperAdmin", icon: ShieldCheck, soon: false },
      ]
    : navItems

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          to="/"
          onClick={onClose}
          className="text-lg font-semibold text-sidebar-foreground hover:underline"
        >
          RosterMe
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="px-3 pb-2">
        <Button asChild className="w-full justify-start" size="sm">
          <Link to="/events/new" onClick={onClose}>
            <Plus className="h-4 w-4" />
            Create Event
          </Link>
        </Button>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="App">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(location.pathname, item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.soon && (
                <Badge
                  variant="secondary"
                  size="xs"
                  className="ml-auto bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  Soon
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <ThemedUserButton />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.fullName ?? "Account"}
            </p>
            {(user?.primaryEmailAddress?.emailAddress || user?.username) && (
              <p className="truncate text-xs text-sidebar-foreground/60">
                {user.primaryEmailAddress?.emailAddress ?? user.username}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => signOut({ redirectUrl: "/" })}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
        {sidebar}
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg">
            {sidebar}
          </aside>
        </div>
      )}
    </>
  )
}
