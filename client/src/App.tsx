import { useState } from "react"
import { Toaster } from "sonner"
import { useAuth } from "@clerk/react"
import { Menu } from "lucide-react"
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useParams,
} from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Dashboard } from "@/pages/admin/Dashboard"
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

function EditEventWrapper() {
  const { id } = useParams()
  return <EditEvent key={id} />
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

/** Public marketing pages: header with Features/Resources + footer. */
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

/** Volunteer-facing pages: minimal brand header, no app or marketing nav. */
function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-6 py-3">
        <Link to="/" className="text-lg font-semibold hover:underline">
          RosterMe
        </Link>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

/** Signed-in app: sidebar aside only, no top header. */
function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-svh">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b px-4 py-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
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
          <Route path="/" element={<HomeRoute />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="*" element={<HomeRoute />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/events" element={<Dashboard />} />
            <Route path="/events/new" element={<CreateEvent />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/events/:id/edit" element={<EditEventWrapper />} />
            <Route path="/reports" element={<ReportsPage />} />
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
