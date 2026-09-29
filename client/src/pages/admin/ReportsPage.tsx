import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChartColumn,
  Download,
  Users,
  X,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useApi } from "@/hooks/useApi"
import { useGroups } from "@/hooks/useGroups"
import { useReports } from "@/hooks/useReports"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MultiSelectMenu } from "@/components/admin/MultiSelectMenu"
import { GroupFilter } from "@/components/admin/GroupFilter"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AdminHeader,
  AdminPageBody,
  AdminPageCenter,
  AdminPageShell,
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
  EmptyState,
  StatCard,
} from "@/components/ui/layout"
import { LoadingState } from "@/components/ui/spinner"
import { formatApiError } from "@/lib/api"
import { exportReportsToExcel } from "@/lib/reportExport"

function toDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const TOP_N = 10

const STATUS_COLORS: Record<string, string> = {
  Pending: "#eab308",
  Confirmed: "#16a34a",
  WaitlistPending: "#f97316",
  Waitlisted: "#f97316",
  Cancelled: "#94a3b8",
  Removed: "#ef4444",
}

export function ReportsPage() {
  const api = useApi()
  const { groups, loading: groupsLoading } = useGroups()
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [days, setDays] = useState(30)

  // Same wide window and query key as the dashboard list: the event cache
  // is shared, this fetch only builds the event filter options.
  const { from, to } = useMemo(() => {
    const now = new Date()
    const fromDate = new Date(now)
    fromDate.setFullYear(fromDate.getFullYear() - 1)
    const toDate = new Date(now)
    toDate.setFullYear(toDate.getFullYear() + 2)
    return { from: toDateString(fromDate), to: toDateString(toDate) }
  }, [])

  const eventsQuery = useQuery({
    queryKey: ["events", from, to],
    queryFn: () => api.listEvents(from, to),
    staleTime: 5 * 60 * 1000,
  })
  const allEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])

  // Selecting groups narrows the event options; drop selected events that
  // fall outside the narrowed list so the two filters can't contradict.
  const eventOptions = useMemo(
    () =>
      allEvents
        .filter(
          (e) =>
            selectedGroupIds.length === 0 ||
            selectedGroupIds.includes(e.groupId)
        )
        .map((e) => ({
          value: e.id,
          label: `${e.title} · ${e.date}`,
        })),
    [allEvents, selectedGroupIds]
  )

  const handleGroupChange = (ids: string[]) => {
    setSelectedGroupIds(ids)
    if (ids.length > 0) {
      const visible = new Set(
        allEvents.filter((e) => ids.includes(e.groupId)).map((e) => e.id)
      )
      setSelectedEventIds((prev) => prev.filter((id) => visible.has(id)))
    }
  }

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const evt of allEvents) {
      counts[evt.groupId] = (counts[evt.groupId] ?? 0) + 1
    }
    return counts
  }, [allEvents])

  const hasActiveFilters =
    selectedGroupIds.length > 0 || selectedEventIds.length > 0
  const clearAllFilters = () => {
    setSelectedGroupIds([])
    setSelectedEventIds([])
  }

  const reports = useReports(selectedGroupIds, selectedEventIds, days)
  const data = reports.data
  const canExport = Boolean(data && Number(data.summary.events) > 0)

  const handleExport = async () => {
    if (!data) return
    try {
      await exportReportsToExcel(data)
      toast.success("Report exported to Excel")
    } catch (err) {
      toast.error(formatApiError(err, "Failed to export report"))
    }
  }

  const summary = data?.summary
  const byGroup = useMemo(
    () =>
      [...(data?.groups ?? [])]
        .sort((a, b) => Number(b.activeSignups) - Number(a.activeSignups))
        .slice(0, TOP_N)
        .map((g) => ({ name: g.name, signups: Number(g.activeSignups) })),
    [data]
  )
  const byEvent = useMemo(
    () =>
      [...(data?.events ?? [])]
        .sort((a, b) => Number(b.activeSignups) - Number(a.activeSignups))
        .slice(0, TOP_N)
        .map((e) => ({
          name: e.title,
          signups: Number(e.activeSignups),
          capacity: Number(e.capacity),
          fillRate: Math.round(Number(e.fillRate) * 100),
        })),
    [data]
  )
  const timeline = useMemo(
    () =>
      (data?.signupsPerDay ?? []).map((d) => ({
        date: d.date.slice(5),
        Signups: Number(d.count),
      })),
    [data]
  )
  const byStatus = useMemo(
    () =>
      Object.entries(data?.signupsByStatus ?? {})
        .map(([status, count]) => ({
          status,
          count: Number(count),
        }))
        .sort((a, b) => b.count - a.count),
    [data]
  )
  const isEmpty = data && Number(data.summary.events) === 0

  return (
    <AdminPageShell>
      <AdminHeader
        title="Reports"
        subtitle="Attendance and signup insights for your events."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!canExport || reports.isLoading}
            className="bg-background"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />
      <AdminPageBody>
        <AdminPageCenter>
          <div className="field-stack">
            <div className="flex flex-wrap items-center gap-2">
              <GroupFilter
                groups={groups}
                selectedIds={selectedGroupIds}
                onChange={handleGroupChange}
                loading={groupsLoading}
                counts={groupCounts}
              />
              <MultiSelectMenu
                title="Filter by event"
                shortLabel="Events"
                allLabel="All events"
                multiSuffix="events"
                icon={CalendarDays}
                options={eventOptions}
                selected={selectedEventIds}
                onChange={setSelectedEventIds}
                loading={eventsQuery.isLoading}
              />
              <Select
                value={String(days)}
                onValueChange={(v) => setDays(Number(v))}
              >
                <SelectTrigger
                  size="sm"
                  className="w-auto"
                  aria-label="Timeline window"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedGroupIds.map((id) => {
                  const name = groups.find((g) => g.id === id)?.name
                  if (!name) return null
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      <span className="max-w-40 truncate font-normal">
                        {name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleGroupChange(
                            selectedGroupIds.filter((g) => g !== id)
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
                {selectedEventIds.map((id) => {
                  const label = eventOptions.find((o) => o.value === id)?.label
                  if (!label) return null
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      <span className="max-w-40 truncate font-normal">
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEventIds((prev) =>
                            prev.filter((e) => e !== id)
                          )
                        }
                        aria-label={`Remove ${label} filter`}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {reports.isLoading && !data ? (
            <LoadingState className="py-8" label="Loading reports..." />
          ) : reports.error ? (
            <p className="field-error">
              {formatApiError(reports.error, "Failed to load reports")}
            </p>
          ) : !data || isEmpty ? (
            <DataCard>
              <DataCardContent className="py-8">
                <EmptyState>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <BarChart3 className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-sm font-medium">
                    {allEvents.length === 0
                      ? "No events yet."
                      : "No events match your filters."}
                  </p>
                  <p className="muted mt-1">
                    {allEvents.length === 0
                      ? "Create an event to start seeing signup insights."
                      : "Try widening the group or event selection."}
                  </p>
                  {allEvents.length === 0 ? (
                    <Button asChild className="mt-6" size="sm">
                      <Link to="/events/new">Create event</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-6"
                      size="sm"
                      onClick={clearAllFilters}
                    >
                      Clear filters
                    </Button>
                  )}
                </EmptyState>
              </DataCardContent>
            </DataCard>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard label="Events" value={Number(summary?.events ?? 0)} />
                <StatCard
                  label="Capacity"
                  value={Number(summary?.capacity ?? 0)}
                />
                <StatCard
                  label="Active signups"
                  value={Number(summary?.activeSignups ?? 0)}
                />
                <StatCard
                  label="Fill rate"
                  value={`${Math.round(Number(summary?.fillRate ?? 0) * 100)}%`}
                />
                <StatCard
                  label="Waitlisted"
                  value={Number(summary?.waitlisted ?? 0)}
                />
              </div>

              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={Activity}>
                    Signups over time — last {days} days
                  </DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          interval={Math.max(
                            0,
                            Math.floor(timeline.length / 8) - 1
                          )}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="Signups"
                          stroke="#2563eb"
                          fill="#2563eb"
                          fillOpacity={0.2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </DataCardContent>
              </DataCard>

              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={Users}>Signups by group</DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent>
                  {byGroup.length === 0 ? (
                    <p className="muted py-3 text-center text-sm">
                      No signups yet.
                    </p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byGroup} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Bar dataKey="signups" fill="#16a34a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </DataCardContent>
              </DataCard>

              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={ChartColumn}>
                    Fill rate by event
                  </DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent>
                  {byEvent.length === 0 ? (
                    <p className="muted py-3 text-center text-sm">
                      No events in scope.
                    </p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byEvent} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: number) => `${v}%`}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value) => [`${value}%`, "Fill rate"]}
                          />
                          <Bar dataKey="fillRate" fill="#2563eb" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </DataCardContent>
              </DataCard>

              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={BarChart3}>
                    Signups by status
                  </DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent>
                  {byStatus.length === 0 ? (
                    <p className="muted py-3 text-center text-sm">
                      No signups yet.
                    </p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byStatus} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="status"
                            width={120}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Bar dataKey="count">
                            {byStatus.map((row) => (
                              <Cell
                                key={row.status}
                                fill={STATUS_COLORS[row.status] ?? "#2563eb"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </DataCardContent>
              </DataCard>
            </div>
          )}
        </AdminPageCenter>
      </AdminPageBody>
    </AdminPageShell>
  )
}
