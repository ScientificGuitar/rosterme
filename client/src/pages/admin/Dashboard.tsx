import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { EventList } from "@/components/admin/EventList"
import { WeeklyGrid } from "@/components/admin/WeeklyGrid"
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

export function Dashboard() {
  const navigate = useNavigate()

  return (
    <AdminPageShell>
      <Tabs defaultValue="list" className="flex min-h-0 flex-1 flex-col gap-0">
        <div>
          <AdminHeaderBand withTabs>
            <AdminHeaderTitleRow>
              <AdminHeaderTitleBlock>
                <AdminHeaderTitle>Dashboard</AdminHeaderTitle>
              </AdminHeaderTitleBlock>
              <div className="flex shrink-0 items-start">
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
              <WeeklyGrid />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  )
}
