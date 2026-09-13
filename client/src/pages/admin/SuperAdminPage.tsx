import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { RefreshCw, Trash2 } from "lucide-react"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

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
    <div className="space-y-6">
      {stats.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading stats…</p>
      ) : stats.error ? (
        <p className="text-sm text-destructive">
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
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.data.signupsByStatus).map(([status, count]) => (
              <Badge key={status} variant="secondary">
                {status}: {count}
              </Badge>
            ))}
            {Object.keys(stats.data.signupsByStatus).length === 0 && (
              <span className="text-sm text-muted-foreground">No signups yet</span>
            )}
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Activity — last 30 days</h2>
        </CardHeader>
        <CardContent>
          {activity.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : activity.error ? (
            <p className="text-sm text-destructive">
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
                  <Line type="monotone" dataKey="Signups" stroke="#2563eb" dot={false} />
                  <Line type="monotone" dataKey="Events" stroke="#16a34a" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RecentTab() {
  const recent = useSuperAdminRecent(10)

  if (recent.isLoading)
    return <p className="text-sm text-muted-foreground">Loading recent items…</p>
  if (recent.error)
    return (
      <p className="text-sm text-destructive">
        {formatApiError(recent.error, "Failed to load recent items")}
      </p>
    )
  if (!recent.data) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Recent groups</h2>
        </CardHeader>
        <CardContent>
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
                  <TableCell className="max-w-48 truncate">{g.groupOwner}</TableCell>
                  <TableCell>{new Date(g.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Recent events</h2>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Recent signups</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.data.signups.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.volunteerName}</TableCell>
                  <TableCell className="max-w-48 truncate">{s.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
        toast.error("Already sent — sent history is preserved and cannot be deleted")
      } else {
        toast.error(formatApiError(err, "Failed to delete message"))
      }
    }
  }

  const deletingRow = outbox.data?.items.find((i) => i.id === deletingId)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Email outbox</h2>
          <div className="ml-auto flex items-center gap-2">
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
                queryClient.invalidateQueries({ queryKey: ["superadmin", "outbox"] })
              }
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent>
        {outbox.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading outbox…</p>
        ) : outbox.error ? (
          <p className="text-sm text-destructive">
            {formatApiError(outbox.error, "Failed to load outbox")}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {outbox.data?.total ?? 0} message(s)
            </p>
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
                    <TableCell className="max-w-48 truncate">{m.to}</TableCell>
                    <TableCell className="max-w-64 truncate">{m.subject}</TableCell>
                    <TableCell>
                      <Badge variant={m.sent ? "secondary" : "default"}>
                        {m.sent ? "Sent" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(m.createdAt).toLocaleDateString()}</TableCell>
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
          </>
        )}
      </CardContent>
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
    </Card>
  )
}

export function SuperAdminPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "recent", label: "Recent" },
    { id: "outbox", label: "Outbox" },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">SuperAdmin</h1>
      <div role="group" aria-label="Sections" className="inline-flex rounded-lg border p-1">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "recent" && <RecentTab />}
      {tab === "outbox" && <OutboxTab />}
    </div>
  )
}
