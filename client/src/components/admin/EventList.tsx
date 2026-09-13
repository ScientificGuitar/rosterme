import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { MapPin, Search, X } from "lucide-react"
import { useApi } from "@/hooks/useApi"
import { useGroups } from "@/hooks/useGroups"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CapacityBar } from "@/components/ui/capacity-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { GroupFilter } from "@/components/admin/GroupFilter"
import { SortControl, type EventSortBy } from "@/components/admin/SortControl"
import { StatusFilter } from "@/components/admin/StatusFilter"
import { STATUS_LABELS, type EventStatus } from "@/lib/eventStatus"
import type { EventWithSlots } from "@/lib/types"

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

export function EventList() {
  const api = useApi()
  const [search, setSearch] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<EventStatus[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<EventSortBy>("date")
  const { groups, loading: groupsLoading } = useGroups()

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
    queryKey: ["events", from, to],
    queryFn: () => api.listEvents(from, to),
    staleTime: 5 * 60 * 1000,
  })

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const evt of events ?? []) {
      counts[evt.groupId] = (counts[evt.groupId] ?? 0) + 1
    }
    return counts
  }, [events])

  const selectedGroupSet = useMemo(
    () => new Set(selectedGroupIds),
    [selectedGroupIds]
  )

  const selectedStatusSet = useMemo(
    () => new Set(selectedStatuses),
    [selectedStatuses]
  )

  const query = search.trim()
  const hasActiveFilters =
    query !== "" || selectedStatuses.length > 0 || selectedGroupIds.length > 0

  const clearAllFilters = () => {
    setSearch("")
    setSelectedStatuses([])
    setSelectedGroupIds([])
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = (events ?? []).filter((evt) => {
      if (
        selectedStatusSet.size > 0 &&
        !selectedStatusSet.has(getEventStatus(evt.date, today))
      ) {
        return false
      }
      if (selectedGroupSet.size > 0 && !selectedGroupSet.has(evt.groupId)) {
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
  }, [events, search, selectedStatusSet, selectedGroupSet, sortBy, today])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          <div className="flex flex-wrap items-center gap-2">
            <GroupFilter
              groups={groups}
              selectedIds={selectedGroupIds}
              onChange={setSelectedGroupIds}
              loading={groupsLoading}
              counts={groupCounts}
            />
            <StatusFilter
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
            />
            <SortControl value={sortBy} onChange={setSortBy} />
          </div>
        </div>

        {(hasActiveFilters || (events && events.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {query !== "" && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <span className="max-w-40 truncate font-normal">“{query}”</span>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedGroupIds.map((id) => {
              const name = groups.find((g) => g.id === id)?.name
              if (!name) return null
              return (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  <span className="max-w-40 truncate font-normal">{name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGroupIds((prev) =>
                        prev.filter((g) => g !== id)
                      )
                    }
                    aria-label={`Remove ${name} filter`}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
            {selectedStatuses.map((status) => (
              <Badge key={status} variant="secondary" className="gap-1 pr-1">
                <span className="font-normal">{STATUS_LABELS[status]}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStatuses((prev) =>
                      prev.filter((s) => s !== status)
                    )
                  }
                  aria-label={`Remove ${STATUS_LABELS[status]} filter`}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <span className="ml-auto flex items-center gap-2">
              {!isLoading && !error && events && (
                <span
                  className="text-xs text-muted-foreground tabular-nums"
                  aria-live="polite"
                >
                  Showing {visible.length} of {events.length}{" "}
                  {events.length === 1 ? "event" : "events"}
                </span>
              )}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              )}
            </span>
          </div>
        )}
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
            <div className="space-y-3">
              <p>No events match your filters.</p>
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                Clear filters
              </Button>
            </div>
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

function EventListItem({
  event,
  today,
}: {
  event: EventWithSlots
  today: string
}) {
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
        <p className="text-xs text-muted-foreground">{event.groupName}</p>
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
            <CapacityBar
              filled={filled}
              capacity={capacity}
              className="h-1.5"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
