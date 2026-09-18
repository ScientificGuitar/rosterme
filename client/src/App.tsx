import { useEffect, useState } from "react"
import { Toaster } from "sonner"
import { useAuth, useUser } from "@clerk/react"
import { ArrowLeft, Menu } from "lucide-react"
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
  useNavigate,
  useParams,
  matchPath,
} from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Dashboard } from "@/pages/admin/Dashboard"
import { SuperAdminPage } from "@/pages/admin/SuperAdminPage"
import { GroupsPage } from "@/pages/admin/GroupsPage"
import { CreateEvent } from "@/pages/admin/CreateEvent"
import { EventDetail } from "@/pages/admin/EventDetail"
import { EditEvent } from "@/pages/admin/EditEvent"
import { ReportsPage } from "@/pages/admin/ReportsPage"
import { InvitePage } from "@/pages/public/InvitePage"
import { LandingPage } from "@/pages/public/LandingPage"
import { FeaturesPage } from "@/pages/public/FeaturesPage"
import { ResourcesPage } from "@/pages/public/ResourcesPage"
import { SignupManagePage } from "@/pages/public/SignupManagePage"
import { TermsOfServicePage } from "@/pages/legal/TermsOfServicePage"
import { PrivacyPolicyPage } from "@/pages/legal/PrivacyPolicyPage"
import { Footer } from "@/components/Footer"
import { MarketingHeader } from "@/components/MarketingHeader"
import { AppSidebar } from "@/components/AppSidebar"
import { ThemeToggle } from "@/components/ThemeToggle"

function EditEventWrapper() {
  const { id } = useParams()
  return <EditEvent key={id} />
}

function EventDetailWrapper() {
  const { id } = useParams()
  return <EventDetail key={id} />
}

/** Keeps private areas (app + invite links) out of Google. */
function useNoindex() {
  useEffect(() => {
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!el) {
      el = document.createElement("meta")
      el.setAttribute("name", "robots")
      document.head.appendChild(el)
    }
    el.setAttribute("content", "noindex, nofollow")
  }, [])
}

function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/" replace />

  return <Outlet />
}

function RequireSuperAdmin() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) return null
  const role = (user?.publicMetadata as { role?: string } | undefined)?.role
  if (role !== "superAdmin") return <Navigate to="/" replace />

  return <Outlet />
}

function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

/** Public-facing pages: minimal brand header, no app or marketing nav. */
function PublicLayout() {
  useNoindex()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold hover:underline">
            RosterMe
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

/** Mobile bar config: page context + where back goes (null = top-level). */
function useMobileBar(): { title: string; backTo: string | null } {
  const { pathname } = useLocation()
  if (matchPath("/events/new", pathname))
    return { title: "New Event", backTo: "/dashboard" }
  const editMatch = matchPath("/events/:id/edit", pathname)
  if (editMatch)
    return { title: "Edit Event", backTo: `/events/${editMatch.params.id}` }
  if (matchPath("/events/:id", pathname))
    return { title: "Event Details", backTo: "/dashboard" }
  if (matchPath("/groups", pathname)) return { title: "Groups", backTo: null }
  if (matchPath("/reports", pathname))
    return { title: "Reports", backTo: null }
  if (matchPath("/admin", pathname)) return { title: "Admin", backTo: null }
  return { title: "Dashboard", backTo: null }
}

/** Signed-in app: sidebar aside + sticky mobile bar (menu, back, title). */
function AppLayout() {
  useNoindex()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const { title, backTo } = useMobileBar()

  return (
    <div className="flex min-h-svh">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background px-2 py-1.5 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {backTo && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backTo)}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
            {title}
          </span>
        </div>
        <main className="flex-1 bg-muted/60 p-4 md:p-6 dark:bg-muted/40">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="*" element={<LandingPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/events" element={<Dashboard />} />
            <Route path="/events/new" element={<CreateEvent />} />
            <Route path="/events/:id" element={<EventDetailWrapper />} />
            <Route path="/events/:id/edit" element={<EditEventWrapper />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route element={<RequireSuperAdmin />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<SuperAdminPage />} />
            </Route>
          </Route>
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route path="/signup/manage/:token" element={<SignupManagePage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
