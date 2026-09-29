import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
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
import { LoadingState } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useApi } from "@/hooks/useApi"
import { cn, formatTime } from "@/lib/utils"
import { groupColor } from "@/lib/groupColors"
import type { EventWithSlots } from "@/lib/types"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** Max event chips/dots shown inside a day cell before collapsing to "+N". */
const MAX_CHIPS = 3

function toDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function todayString(): string {
  return toDateString(new Date())
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

/** "HH:mm–HH:mm" across the first/last slot, or null when the event has none. */
function eventTimeRange(evt: EventWithSlots): string | null {
  const slots = evt.slots
  if (slots.length === 0) return null
  const start = formatTime(slots[0].startTime)
  const end = formatTime(slots[slots.length - 1].endTime)
  return `${start}–${end}`
}

interface DayCell {
  date: Date
  dateStr: string
  isCurrentMonth: boolean
  isToday: boolean
  events: EventWithSlots[]
}

/**
 * Monday-aligned weeks covering the month, plus the from/to range to fetch.
 * Total days is a multiple of 7 (5 or 6 rows) so the grid never drifts.
 */
function buildGrid(
  year: number,
  month: number
): {
  cells: DayCell[]
  from: string
  to: string
} {
  const first = new Date(year, month, 1)
  const firstIndex = (first.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(first)
  start.setDate(first.getDate() - firstIndex)

  const last = new Date(year, month + 1, 0) // last day of the month
  const lastIndex = (last.getDay() + 6) % 7
  const end = new Date(last)
  end.setDate(last.getDate() + (6 - lastIndex))

  const dayMs = 24 * 60 * 60 * 1000
  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1
  const today = todayString()

  const cells: DayCell[] = []
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const dateStr = toDateString(date)
    cells.push({
      date,
      dateStr,
      isCurrentMonth: date.getMonth() === month,
      isToday: dateStr === today,
      events: [],
    })
  }

  return { cells, from: toDateString(start), to: toDateString(end) }
}

function DayIndicator({ cell }: { cell: DayCell }) {
  if (cell.events.length === 0) return null
  const overflow = cell.events.length - MAX_CHIPS
  const visible = cell.events.slice(0, MAX_CHIPS)
  return (
    <>
      {/* Desktop: colored title chips */}
      <div className="mt-0.5 hidden min-w-0 flex-col gap-0.5 sm:flex">
        {visible.map((evt) => (
          <span
            key={evt.id}
            className={cn(
              "truncate rounded-sm px-1.5 py-0.5 text-[11px] leading-tight font-medium",
              groupColor(evt.groupId).chip
            )}
          >
            {evt.title}
          </span>
        ))}
        {overflow > 0 && (
          <span className="px-1 text-[11px] font-semibold text-muted-foreground">
            +{overflow} more
          </span>
        )}
      </div>
      {/* Mobile: compact color dots */}
      <div className="mt-1 flex flex-wrap items-center gap-0.5 sm:hidden">
        {visible.map((evt) => (
          <span
            key={evt.id}
            className={cn("h-2 w-2 rounded-full", groupColor(evt.groupId).dot)}
            aria-hidden
          />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] leading-tight font-medium text-muted-foreground">
            +{overflow}
          </span>
        )}
      </div>
    </>
  )
}

export function MonthlyCalendar() {
  const api = useApi()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { cells, from, to, monthKey } = useMemo(() => {
    const { cells, from, to } = buildGrid(month.year, month.month)
    const monthKey = `${month.year}-${String(month.month + 1).padStart(2, "0")}`
    return { cells, from, to, monthKey }
  }, [month])

  const {
    data: events,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["events", "calendar", monthKey],
    queryFn: () => api.listEvents(from, to),
    staleTime: 5 * 60 * 1000,
  })

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithSlots[]>()
    for (const evt of events ?? []) {
      const list = map.get(evt.date) ?? []
      list.push(evt)
      map.set(evt.date, list)
    }
    return map
  }, [events])

  const cellsWithEvents = useMemo(
    () =>
      cells.map((cell) => ({
        ...cell,
        events: eventsByDate.get(cell.dateStr) ?? [],
      })),
    [cells, eventsByDate]
  )

  const legendGroups = useMemo(() => {
    const byId = new Map<string, string>()
    for (const evt of events ?? []) {
      if (!byId.has(evt.groupId)) byId.set(evt.groupId, evt.groupName)
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [events])

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  )
  const dayEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : []
  const selectedLabel = selectedDate ? formatDayLabel(selectedDate) : ""

  const prevMonth = () =>
    setMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    )
  const nextMonth = () =>
    setMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    )
  const goToday = () => {
    const now = new Date()
    setMonth({ year: now.getFullYear(), month: now.getMonth() })
  }

  return (
    <>
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
                  onClick={prevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={goToday}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={nextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => refetch()}
                  aria-label="Refresh calendar"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            }
          >
            {monthLabel}
          </DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent>
          {isLoading && !events && <LoadingState label="Loading calendar..." />}
          {error && (
            <p className="py-8 text-center text-destructive">
              {(error as Error).message}
            </p>
          )}
          {!isLoading && !error && events && (
            <>
              <div className="grid grid-cols-7 gap-px">
                {WEEKDAYS.map((label) => (
                  <div
                    key={label}
                    className="px-1 pb-1 text-center text-[11px] font-semibold text-muted-foreground sm:px-2 sm:text-xs"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
                {cellsWithEvents.map((cell) => (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={cn(
                      "flex min-h-14 flex-col items-stretch p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:min-h-24 sm:p-1.5",
                      cell.isCurrentMonth
                        ? "bg-background hover:bg-muted/60"
                        : "bg-muted/40 hover:bg-muted/70"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums sm:h-6 sm:w-6 sm:text-xs",
                        cell.isToday
                          ? "bg-primary text-primary-foreground"
                          : cell.isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    <DayIndicator cell={cell} />
                  </button>
                ))}
              </div>

              {events.length === 0 && (
                <p className="muted py-6 text-center">
                  No events this month.{" "}
                  <Link to="/events/new" className="link-primary">
                    Create one
                  </Link>
                </p>
              )}

              {legendGroups.length > 0 && (
                <div className="-mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 pt-3">
                  {legendGroups.map((group) => (
                    <span
                      key={group.id}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          groupColor(group.id).dot
                        )}
                        aria-hidden
                      />
                      {group.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </DataCardContent>
      </DataCard>

      <Dialog
        open={selectedDate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedLabel}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {dayEvents.length === 0 && (
              <p className="muted py-4 text-center">No events this day.</p>
            )}
            {dayEvents.map((evt) => {
              const color = groupColor(evt.groupId)
              const time = eventTimeRange(evt)
              return (
                <Link
                  key={evt.id}
                  to={`/events/${evt.id}`}
                  onClick={() => setSelectedDate(null)}
                  className="flex items-start gap-2.5 rounded-md border p-2.5 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      color.dot
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {evt.title}
                    </span>
                    <span className="muted-xs block truncate">
                      {[evt.groupName, evt.location, time]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
