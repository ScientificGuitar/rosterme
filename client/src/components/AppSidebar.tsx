import { Link, useLocation } from "react-router-dom"
import { UserButton, useClerk, useUser } from "@clerk/react"
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Sun,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, soon: false },
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
  const { theme, setTheme } = useTheme()

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          to="/dashboard"
          onClick={onClose}
          className="text-lg font-semibold hover:underline"
        >
          RosterMe
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
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
        {navItems.map((item) => {
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
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.soon && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  Soon
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <UserButton />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">
              {user?.fullName ?? "Account"}
            </p>
            {(user?.primaryEmailAddress?.emailAddress ||
              user?.username) && (
              <p className="truncate text-xs text-muted-foreground">
                {user.primaryEmailAddress?.emailAddress ?? user.username}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
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
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-card text-card-foreground md:block">
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
          <aside className="absolute inset-y-0 left-0 w-64 bg-card text-card-foreground shadow-lg">
            {sidebar}
          </aside>
        </div>
      )}
    </>
  )
}
