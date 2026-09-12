import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { MapPin, Search } from "lucide-react"
import { useApi } from "@/hooks/useApi"
import { Badge } from "@/components/ui/badge"
import { CapacityBar } from "@/components/ui/capacity-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { EventWithSlots } from "@/lib/types"

interface EventListProps {
  orgId: string
}

type EventStatusFilter = "active" | "inactive" | "all"
type EventSortBy = "date" | "title" | "status"

function toDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function todayLocal(): string {
  return toDateString(new Date())
}

/** Derived status until the backend gains a real status/draft field. */
function getEventStatus(date: string, today: string): "active" | "inactive" {
  return date >= today ? "active" : "inactive"
}

function formatEventDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"

export function EventList({ orgId }: EventListProps) {
  const api = useApi()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("active")
  const [sortBy, setSortBy] = useState<EventSortBy>("date")

  const today = useMemo(() => todayLocal(), [])

  const { from, to } = useMemo(() => {
    const now = new Date()
    const fromDate = new Date(now)
    fromDate.setFullYear(fromDate.getFullYear() - 1)
    const toDate = new Date(now)
    toDate.setFullYear(toDate.getFullYear() + 2)
    return { from: toDateString(fromDate), to: toDateString(toDate) }
  }, [])

  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["events", orgId, from, to],
    queryFn: () => api.listEvents(orgId, from, to),
    staleTime: 5 * 60 * 1000,
  })

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = (events ?? []).filter((evt) => {
      if (statusFilter !== "all" && getEventStatus(evt.date, today) !== statusFilter) {
        return false
      }
      if (!q) return true
      return [evt.title, evt.location ?? "", evt.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
    const sorted = [...filtered]
    switch (sortBy) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title))
        break
      case "status":
        sorted.sort((a, b) => {
          const sa = getEventStatus(a.date, today)
          const sb = getEventStatus(b.date, today)
          if (sa !== sb) return sa === "active" ? -1 : 1
          if (a.date !== b.date) return a.date < b.date ? -1 : 1
          return a.title.localeCompare(b.title)
        })
        break
      case "date":
      default:
        sorted.sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1
          return a.title.localeCompare(b.title)
        })
        break
    }
    return sorted
  }, [events, search, statusFilter, sortBy, today])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            aria-label="Search events"
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EventStatusFilter)}
            aria-label="Filter by status"
            title="Filter by status"
            className={selectClassName}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as EventSortBy)}
            aria-label="Sort events"
            title="Sort by"
            className={selectClassName}
          >
            <option value="date">Start date</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {isLoading && !events && (
        <div className="py-12 text-center text-muted-foreground">
          Loading events...
        </div>
      )}
      {error && (
        <div className="py-12 text-center text-destructive">
          {(error as Error).message}
        </div>
      )}
      {!isLoading && !error && visible.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          {events && events.length > 0 ? (
            <>No events match your filters.</>
          ) : (
            <>
              No events yet.{" "}
              <Link to="/events/new" className="text-primary hover:underline">
                Create one
              </Link>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((evt) => (
          <EventListItem key={evt.id} event={evt} today={today} />
        ))}
      </div>
    </div>
  )
}

function EventListItem({ event, today }: { event: EventWithSlots; today: string }) {
  const status = getEventStatus(event.date, today)
  const filled = event.slots.reduce((sum, s) => sum + Number(s.signupCount), 0)
  const capacity = event.slots.reduce((sum, s) => sum + Number(s.capacity), 0)
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {formatEventDate(event.date)}
          </p>
          <Badge variant={status === "active" ? "default" : "secondary"}>
            {status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>
        <CardTitle className="text-base font-semibold">
          <Link to={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {event.location && (
          <p
            className="flex items-center gap-1 truncate text-xs text-muted-foreground"
            title={event.location}
          >
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        )}
        {event.slots.length === 0 ? (
          <p className="text-xs text-muted-foreground">No slots</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {event.slots.length}{" "}
                {event.slots.length === 1 ? "slot" : "slots"}
              </span>
              <Badge
                variant={filled >= capacity ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {filled}/{capacity} volunteers
              </Badge>
            </div>
            <CapacityBar filled={filled} capacity={capacity} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
