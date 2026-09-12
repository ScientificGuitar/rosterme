import { Toaster } from "sonner"
import { Show, UserButton, useAuth, useClerk } from "@clerk/react"
import { Moon, Sun, LayoutDashboard, CalendarPlus } from "lucide-react"
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
  useParams,
} from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { Dashboard } from "@/pages/admin/Dashboard"
import { CreateEvent } from "@/pages/admin/CreateEvent"
import { EventDetail } from "@/pages/admin/EventDetail"
import { EditEvent } from "@/pages/admin/EditEvent"
import { InvitePage } from "@/pages/public/InvitePage"
import { LandingPage } from "@/pages/public/LandingPage"
import { SignupManagePage } from "@/pages/public/SignupManagePage"
import { TermsOfServicePage } from "@/pages/legal/TermsOfServicePage"
import { PrivacyPolicyPage } from "@/pages/legal/PrivacyPolicyPage"
import { Footer } from "@/components/Footer"
import { cn } from "@/lib/utils"
import { useOrg } from "@/hooks/useOrg"

function EditEventWrapper() {
  const { id } = useParams()
  return <EditEvent key={id} />
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/events/new", label: "Create Event", icon: CalendarPlus },
]

function Header() {
  const { openSignIn, openSignUp, signOut } = useClerk()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const { org } = useOrg()

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold hover:underline">
          RosterMe
        </Link>
        <Show when="signed-in">
          <nav className="flex items-center gap-1">
            {navItems
              .filter((item) => item.to !== "/events/new" || org)
              .map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
          </nav>
        </Show>
      </div>
      <Show when="signed-in">
        <div className="flex items-center gap-2">
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label={theme === "dark" ? "Light mode" : "Dark mode"}
                labelIcon={
                  theme === "dark" ? <Sun size={16} /> : <Moon size={16} />
                }
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
            </UserButton.MenuItems>
          </UserButton>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            Sign out
          </Button>
        </div>
      </Show>
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              openSignIn({ fallbackRedirectUrl: window.location.pathname })
            }
          >
            Sign in
          </Button>
          <Button
            onClick={() =>
              openSignUp({ fallbackRedirectUrl: window.location.pathname })
            }
          >
            Sign up
          </Button>
        </div>
      </Show>
    </header>
  )
}

function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/" replace />

  return <Outlet />
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return null
  if (isSignedIn) return <Navigate to="/dashboard" replace />

  return <LandingPage />
}

function Shell() {
  const location = useLocation()
  const { isSignedIn } = useAuth()
  // Signed-out users only ever see the landing page (auth routes redirect
  // to "/"), the invite page, the signup-manage page, or the legal pages.
  const isLegalPage =
    location.pathname === "/terms-of-service" ||
    location.pathname === "/privacy-policy"
  const isLanding =
    !isSignedIn &&
    !isLegalPage &&
    !location.pathname.startsWith("/invite") &&
    !location.pathname.startsWith("/signup")

  return (
    <main className={cn("flex-1", !isLanding && "p-6")}>
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/signup/manage/:token" element={<SignupManagePage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/" element={<HomeRoute />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/events/new" element={<CreateEvent />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/edit" element={<EditEventWrapper />} />
        </Route>
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </main>
  )
}

export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <Toaster richColors position="top-right" />
      <Header />
      <Shell />
      <Footer />
    </div>
  )
}

export default App
