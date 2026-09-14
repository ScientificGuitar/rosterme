import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Show } from "@clerk/react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemedUserButton } from "@/components/ThemedUserButton"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"

const marketingLinks = [
  { to: "/features", label: "Features" },
  { to: "/resources", label: "Resources" },
]

export function MarketingHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const isActive = (to: string) =>
    to.startsWith("/#")
      ? false
      : location.pathname === to ||
        (to !== "/" && location.pathname.startsWith(to))

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-semibold hover:underline">
            RosterMe
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Marketing"
          >
            {marketingLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive(item.to)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Show when="signed-out">
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate("/signin")}>
              Sign in
            </Button>
            <Button onClick={() => navigate("/signup")}>Sign up</Button>
          </Show>
          <Show when="signed-in">
            <Button asChild>
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
            <ThemedUserButton />
          </Show>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <Show when="signed-out">
            <ThemeToggle />
          </Show>
          <Show when="signed-in">
            <ThemedUserButton />
          </Show>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t px-6 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Marketing mobile">
            {marketingLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  isActive(item.to)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            <Show when="signed-out">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false)
                  navigate("/signin")
                }}
              >
                Sign in
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setOpen(false)
                  navigate("/signup")
                }}
              >
                Sign up
              </Button>
            </Show>
            <Show when="signed-in">
              <Button asChild className="flex-1">
                <Link to="/dashboard" onClick={() => setOpen(false)}>
                  Go to dashboard
                </Link>
              </Button>
            </Show>
          </div>
        </div>
      )}
    </header>
  )
}
