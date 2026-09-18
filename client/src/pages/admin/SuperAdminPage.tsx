import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Activity,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Mail,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  AdminHeaderBand,
  AdminHeaderSubtitle,
  AdminHeaderTitle,
  AdminHeaderTitleBlock,
  AdminHeaderTitleRow,
  AdminPageBody,
  AdminPageCenter,
  AdminPageShell,
  AdminTabsList,
  AdminTabsTrigger,
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
  MobileRowList,
  RowPrimary,
  RowSecondary,
  StatCard,
  TableBleed,
} from "@/components/ui/layout"
import {
  useDeleteOutboxMessage,
  useOutbox,
  useSuperAdminActivity,
  useSuperAdminRecent,
  useSuperAdminStats,
  type OutboxSentFilter,
} from "@/hooks/useSuperAdmin"
import { ApiError, formatApiError } from "@/lib/api"

type Tab = "overview" | "recent" | "outbox"

function OverviewTab() {
  const stats = useSuperAdminStats()
  const activity = useSuperAdminActivity(30)

  const chartData =
    activity.data?.signupsPerDay.map((d, i) => ({
      date: d.date.slice(5),
      Signups: d.count,
      Events: activity.data?.eventsPerDay[i]?.count ?? 0,
    })) ?? []

  return (
    <div className="space-y-4">
      {stats.isLoading ? (
        <p className="muted">Loading stats…</p>
      ) : stats.error ? (
        <p className="field-error">
          {formatApiError(stats.error, "Failed to load stats")}
        </p>
      ) : stats.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Groups" value={stats.data.groups} />
            <StatCard label="Events" value={stats.data.events} />
            <StatCard label="Slots" value={stats.data.slots} />
            <StatCard label="Signups" value={stats.data.signups} />
            <StatCard label="Owners" value={stats.data.owners} />
            <StatCard label="Invite links" value={stats.data.inviteLinks} />
            <StatCard label="Pending emails" value={stats.data.emailsPending} />
            <StatCard
              label="Fill rate"
              value={`${Math.round(stats.data.capacityFillRate * 100)}%`}
            />
          </div>
          <DataCard>
            <DataCardHeader>
              <DataCardTitle icon={Activity}>Signups by status</DataCardTitle>
            </DataCardHeader>
            <DataCardDivider />
            <DataCardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.data.signupsByStatus).map(
                  ([status, count]) => (
                    <Badge key={status} variant="secondary">
                      {status}: {count}
                    </Badge>
                  )
                )}
                {Object.keys(stats.data.signupsByStatus).length === 0 && (
                  <span className="muted">No signups yet</span>
                )}
              </div>
            </DataCardContent>
          </DataCard>
        </>
      ) : null}

      <DataCard>
        <DataCardHeader>
          <DataCardTitle icon={ChartColumn}>
            Activity — last 30 days
          </DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent>
          {activity.isLoading ? (
            <p className="muted">Loading activity…</p>
          ) : activity.error ? (
            <p className="field-error">
              {formatApiError(activity.error, "Failed to load activity")}
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Signups"
                    stroke="#2563eb"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Events"
                    stroke="#16a34a"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </DataCardContent>
      </DataCard>
    </div>
  )
}

function RecentTab() {
  const recent = useSuperAdminRecent(10)

  if (recent.isLoading) return <p className="muted">Loading recent items…</p>
  if (recent.error)
    return (
      <p className="field-error">
        {formatApiError(recent.error, "Failed to load recent items")}
      </p>
    )
  if (!recent.data) return null

  return (
    <div className="space-y-4">
      <DataCard>
        <DataCardHeader>
          <DataCardTitle icon={Users}>Recent groups</DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent variant="rows">
          {recent.data.groups.length === 0 ? (
            <p className="muted py-3 text-center text-sm">No groups yet.</p>
          ) : (
            <>
              <TableBleed>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.data.groups.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{g.name}</TableCell>
                        <TableCell className="max-w-48 truncate">
                          {g.groupOwner}
                        </TableCell>
                        <TableCell>
                          {new Date(g.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableBleed>
              <MobileRowList>
                {recent.data.groups.map((g) => (
                  <li key={g.id} className="px-4 py-2">
                    <RowPrimary>{g.name}</RowPrimary>
                    <RowSecondary>
                      {g.groupOwner} ·{" "}
                      {new Date(g.createdAt).toLocaleDateString()}
                    </RowSecondary>
                  </li>
                ))}
              </MobileRowList>
            </>
          )}
        </DataCardContent>
      </DataCard>
      <DataCard>
        <DataCardHeader>
          <DataCardTitle icon={CalendarDays}>Recent events</DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent variant="rows">
          {recent.data.events.length === 0 ? (
            <p className="muted py-3 text-center text-sm">No events yet.</p>
          ) : (
            <>
              <TableBleed>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.data.events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.title}</TableCell>
                        <TableCell>{e.date}</TableCell>
                        <TableCell>
                          {new Date(e.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableBleed>
              <MobileRowList>
                {recent.data.events.map((e) => (
                  <li key={e.id} className="px-4 py-2">
                    <RowPrimary>{e.title}</RowPrimary>
                    <RowSecondary>
                      {e.date} · {new Date(e.createdAt).toLocaleDateString()}
                    </RowSecondary>
                  </li>
                ))}
              </MobileRowList>
            </>
          )}
        </DataCardContent>
      </DataCard>
      <DataCard>
        <DataCardHeader>
          <DataCardTitle icon={ClipboardList}>Recent signups</DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent variant="rows">
          {recent.data.signups.length === 0 ? (
            <p className="muted py-3 text-center text-sm">No signups yet.</p>
          ) : (
            <>
              <TableBleed>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.data.signups.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.volunteerName}</TableCell>
                        <TableCell className="max-w-48 truncate">
                          {s.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{s.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(s.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableBleed>
              <MobileRowList>
                {recent.data.signups.map((s) => (
                  <li key={s.id} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <RowPrimary>{s.volunteerName}</RowPrimary>
                      <Badge variant="secondary" className="shrink-0">
                        {s.status}
                      </Badge>
                    </div>
                    <RowSecondary>
                      {s.email} · {new Date(s.createdAt).toLocaleDateString()}
                    </RowSecondary>
                  </li>
                ))}
              </MobileRowList>
            </>
          )}
        </DataCardContent>
      </DataCard>
    </div>
  )
}

function OutboxTab() {
  const [filter, setFilter] = useState<OutboxSentFilter>("all")
  const queryClient = useQueryClient()
  const outbox = useOutbox(filter)
  const del = useDeleteOutboxMessage()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await del.mutateAsync(deletingId)
      toast.success("Message deleted")
      setDeletingId(null)
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_sent") {
        toast.error(
          "Already sent — sent history is preserved and cannot be deleted"
        )
      } else {
        toast.error(formatApiError(err, "Failed to delete message"))
      }
    }
  }

  const deletingRow = outbox.data?.items.find((i) => i.id === deletingId)

  return (
    <DataCard>
      <DataCardHeader>
        <DataCardTitle icon={Mail}>Email outbox</DataCardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as OutboxSentFilter)}
          >
            <SelectTrigger size="sm" aria-label="Filter by sent status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["superadmin", "outbox"],
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </DataCardHeader>
      <DataCardDivider />
      <DataCardContent variant="rows">
        {outbox.isLoading ? (
          <p className="muted py-3">Loading outbox…</p>
        ) : outbox.error ? (
          <p className="field-error py-3">
            {formatApiError(outbox.error, "Failed to load outbox")}
          </p>
        ) : (
          <>
            <p className="muted py-2">{outbox.data?.total ?? 0} message(s)</p>
            {(outbox.data?.items.length ?? 0) === 0 ? (
              <p className="muted py-3 text-center text-sm">
                No messages found.
              </p>
            ) : (
              <>
                <TableBleed>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead aria-label="Actions" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outbox.data?.items.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="max-w-48 truncate">
                            {m.to}
                          </TableCell>
                          <TableCell className="max-w-64 truncate">
                            {m.subject}
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.sent ? "secondary" : "default"}>
                              {m.sent ? "Sent" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(m.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {!m.sent && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete message to ${m.to}`}
                                onClick={() => setDeletingId(m.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableBleed>
                <MobileRowList>
                  {outbox.data?.items.map((m) => (
                    <li key={m.id} className="px-4 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <RowPrimary>{m.subject}</RowPrimary>
                        <Badge
                          variant={m.sent ? "secondary" : "default"}
                          className="shrink-0"
                        >
                          {m.sent ? "Sent" : "Pending"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <RowSecondary>
                          {m.to} · {new Date(m.createdAt).toLocaleDateString()}
                        </RowSecondary>
                        {!m.sent && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label={`Delete message to ${m.to}`}
                            onClick={() => setDeletingId(m.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </MobileRowList>
              </>
            )}
          </>
        )}
      </DataCardContent>
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null)
        }}
        title="Delete outbox message?"
        description={
          deletingRow
            ? `This will permanently remove the unsent message "${deletingRow.subject}" to ${deletingRow.to}.`
            : undefined
        }
        confirmLabel="Delete"
        isLoading={del.isPending}
        onConfirm={handleDelete}
      />
    </DataCard>
  )
}

export function SuperAdminPage() {
  const [tab, setTab] = useState<Tab>("overview")

  return (
    <AdminPageShell>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div>
          <AdminHeaderBand withTabs>
            <AdminHeaderTitleRow>
              <AdminHeaderTitleBlock>
                <AdminHeaderTitle>SuperAdmin</AdminHeaderTitle>
                <AdminHeaderSubtitle>
                  Platform stats, recent activity and email outbox.
                </AdminHeaderSubtitle>
              </AdminHeaderTitleBlock>
            </AdminHeaderTitleRow>
            <AdminTabsList>
              <AdminTabsTrigger value="overview">Overview</AdminTabsTrigger>
              <AdminTabsTrigger value="recent">Recent</AdminTabsTrigger>
              <AdminTabsTrigger value="outbox">Outbox</AdminTabsTrigger>
            </AdminTabsList>
          </AdminHeaderBand>
          <DataCardDivider />
        </div>
        <TabsContent value="overview">
          <AdminPageBody>
            <AdminPageCenter className="space-y-0">
              <OverviewTab />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
        <TabsContent value="recent">
          <AdminPageBody>
            <AdminPageCenter className="space-y-0">
              <RecentTab />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
        <TabsContent value="outbox">
          <AdminPageBody>
            <AdminPageCenter className="space-y-0">
              <OutboxTab />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  )
}
