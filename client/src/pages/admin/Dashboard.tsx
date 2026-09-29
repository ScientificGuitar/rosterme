import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { EventList } from "@/components/admin/EventList"
import { MonthlyCalendar } from "@/components/admin/MonthlyCalendar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  AdminHeaderBand,
  AdminHeaderTitle,
  AdminHeaderTitleBlock,
  AdminHeaderTitleRow,
  AdminPageBody,
  AdminPageCenter,
  AdminPageShell,
  AdminTabsList,
  AdminTabsTrigger,
} from "@/components/ui/layout"

/**
 * Persists the last-active Dashboard tab so back/forward navigation (and
 * restarts) restore the view instead of always remounting on List.
 */
const DASHBOARD_TAB_KEY = "dashboard:tab"
const DASHBOARD_TABS = ["list", "calendar"] as const

function initialDashboardTab(): string {
  const stored = localStorage.getItem(DASHBOARD_TAB_KEY)
  return DASHBOARD_TABS.includes(stored as (typeof DASHBOARD_TABS)[number])
    ? (stored as string)
    : "list"
}

export function Dashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(initialDashboardTab)

  const handleTabChange = (value: string) => {
    setTab(value)
    localStorage.setItem(DASHBOARD_TAB_KEY, value)
  }

  return (
    <AdminPageShell>
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div>
          <AdminHeaderBand withTabs>
            <AdminHeaderTitleRow>
              <AdminHeaderTitleBlock>
                <AdminHeaderTitle>Dashboard</AdminHeaderTitle>
              </AdminHeaderTitleBlock>
              <div className="flex shrink-0 items-start md:hidden">
                <Button size="sm" onClick={() => navigate("/events/new")}>
                  <Plus className="mr-1 h-3 w-3" />
                  New Event
                </Button>
              </div>
            </AdminHeaderTitleRow>
            <AdminTabsList>
              <AdminTabsTrigger value="list">List</AdminTabsTrigger>
              <AdminTabsTrigger value="calendar">Calendar</AdminTabsTrigger>
            </AdminTabsList>
          </AdminHeaderBand>
          <Separator />
        </div>
        <TabsContent value="list">
          <AdminPageBody>
            <AdminPageCenter className="space-y-0">
              <EventList />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
        <TabsContent value="calendar">
          <AdminPageBody>
            <AdminPageCenter className="space-y-0">
              <MonthlyCalendar />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  )
}
