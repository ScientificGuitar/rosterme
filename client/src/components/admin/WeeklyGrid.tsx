import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/layout"
import { EventCard } from "@/components/admin/EventCard"
import { useRoster } from "@/hooks/useRoster"

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDayHeader(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return `${days[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return `${months[monday.getMonth()]} ${monday.getDate()} - ${months[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`
}

export function WeeklyGrid() {
  const [monday, setMonday] = useState(() => getMonday(new Date()))
  const weekStart = formatDate(monday)
  const { data: events, isLoading, error, refetch } = useRoster(weekStart)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return { date: formatDate(d), label: formatDayHeader(d) }
  })

  const prevWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    setMonday(d)
  }

  const nextWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    setMonday(d)
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof events>>()
    for (const evt of events ?? []) {
      const existing = map.get(evt.date) ?? []
      existing.push(evt)
      map.set(evt.date, existing)
    }
    return map
  }, [events])

  return (
    <DataCard>
      <DataCardHeader>
        <DataCardTitle
          icon={CalendarDays}
          actions={
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={prevWeek}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={nextWeek}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                aria-label="Refresh roster"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          }
        >
          {formatWeekRange(monday)}
        </DataCardTitle>
      </DataCardHeader>
      <DataCardDivider />
      <DataCardContent>
        {isLoading && !events && (
          <p className="muted py-8 text-center">Loading roster...</p>
        )}
        {error && (
          <p className="py-8 text-center text-destructive">
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && events?.length === 0 && (
          <p className="muted py-8 text-center">
            No events this week.{" "}
            <Link to="/events/new" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        )}

        <div className="-mx-4 overflow-x-auto px-4">
          <div className="grid min-w-[840px] grid-cols-7 gap-3 lg:min-w-0">
            {days.map((day) => (
              <div key={day.date} className="min-w-0">
                <div className="mb-2 rounded-md bg-muted px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
                  {day.label}
                </div>
                <div className="space-y-2">
                  {(eventsByDate.get(day.date) ?? []).map((evt) => (
                    <EventCard key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DataCardContent>
    </DataCard>
  )
}
