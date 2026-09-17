import { useState } from "react"
import { CalendarDays, LayoutList } from "lucide-react"
import { EventList } from "@/components/admin/EventList"
import { WeeklyGrid } from "@/components/admin/WeeklyGrid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function Dashboard() {
  const [view, setView] = useState<"list" | "calendar">("list")

  return (
    <Card className="shell-admin">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Dashboard</h1>
          <div
            role="group"
            aria-label="View mode"
            className="inline-flex rounded-lg border p-1"
          >
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <LayoutList className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Button>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent>
        {view === "list" ? <EventList /> : <WeeklyGrid />}
      </CardContent>
    </Card>
  )
}
