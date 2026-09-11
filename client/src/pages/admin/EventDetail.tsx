import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Trash2,
  Link2,
  Copy,
  Plus,
  Power,
  Pencil,
  MapPin,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CapacityBar } from "@/components/ui/capacity-bar"
import {
  activeSignupCount,
  compareSignupsByStatus,
  formatTime,
  waitlistCount,
} from "@/lib/utils"
import {
  buildEventVolunteersCsv,
  buildVolunteersFilename,
  downloadCsv,
} from "@/lib/csv"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useOrg } from "@/hooks/useOrg"
import { useEvent } from "@/hooks/useEvent"
import { useDeleteSignup } from "@/hooks/useDeleteSignup"
import { useApi } from "@/hooks/useApi"
import type { InviteLink } from "@/lib/types"

export function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const { org, loading: orgLoading, error: orgError } = useOrg()
  const { data: event, isLoading, error } = useEvent(org && id ? id : undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [pendingSignupId, setPendingSignupId] = useState<string | null>(null)
  const deleteSignup = useDeleteSignup()
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleDeleteSignup = async (signupId: string) => {
    try {
      await deleteSignup.mutateAsync(signupId)
      toast.success("Signup removed — volunteer notified")
      setPendingSignupId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete signup")
    }
  }

  const handleDeleteEvent = async () => {
    if (!id) return
    setDeletingEvent(true)
    try {
      await api.deleteEvent(id)
      await queryClient.invalidateQueries({ queryKey: ["roster"] })
      await queryClient.invalidateQueries({ queryKey: ["event", id] })
      toast.success("Event deleted")
      setDeleteDialogOpen(false)
      navigate("/dashboard")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete event")
    } finally {
      setDeletingEvent(false)
    }
  }

  const handleExportCsv = () => {
    if (!event) return
    try {
      const csv = buildEventVolunteersCsv(event)
      downloadCsv(buildVolunteersFilename(event.title, event.date), csv)
      toast.success("Volunteers exported to CSV")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export CSV")
    }
  }

  if (orgLoading || (isLoading && !event)) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading...</div>
    )
  }

  if (orgError) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-muted-foreground">
          {orgError instanceof Error
            ? orgError.message
            : "Failed to load organization"}
        </p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-muted-foreground">
          {error instanceof Error ? error.message : "Event not found"}
        </p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const totalSignups = event.slots.reduce(
    (count, slot) => count + slot.signups.length,
    0
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-muted-foreground">{event.date}</p>
          {event.location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={totalSignups === 0}
          title={
            totalSignups === 0 ? "No volunteers to export" : "Export as CSV"
          }
        >
          <Download className="mr-1 h-3 w-3" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/events/${event.id}/edit`)}
        >
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Event
        </Button>
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete event?"
          description={
            <>
              This will permanently delete &ldquo;{event.title}&rdquo; and all
              associated signups. This action cannot be undone.
            </>
          }
          confirmLabel="Delete"
          variant="destructive"
          isLoading={deletingEvent}
          loadingLabel="Deleting..."
          onConfirm={handleDeleteEvent}
        />
      </div>

      <ConfirmDialog
        open={pendingSignupId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSignupId(null)
        }}
        title="Remove signup?"
        description="This will remove the volunteer from this slot and notify them by email. This action cannot be undone."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={deleteSignup.isPending}
        loadingLabel="Removing..."
        onConfirm={() => {
          if (pendingSignupId) handleDeleteSignup(pendingSignupId)
        }}
      />

      <InviteLinkSection eventId={event.id} />

      <div className="space-y-4">
        {event.slots.length === 0 && (
          <p className="text-center text-muted-foreground">
            No time slots for this event.
          </p>
        )}
        {event.slots.map((slot) => (
          <Card key={slot.id}>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>
                  {slot.label}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {formatTime(slot.startTime)}&ndash;
                    {formatTime(slot.endTime)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge
                    variant={
                      activeSignupCount(slot.signups) >= slot.capacity
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {activeSignupCount(slot.signups)}/{slot.capacity}
                    {waitlistCount(slot.signups) > 0 &&
                      ` · ${waitlistCount(slot.signups)} waiting`}
                  </Badge>
                  <Badge
                    variant={slot.allowWaitlist ? "outline" : "secondary"}
                    title={
                      slot.allowWaitlist
                        ? "Volunteers can join the waitlist when this slot is full"
                        : "Waitlist disabled — full slots reject new signups"
                    }
                  >
                    {slot.allowWaitlist ? "Waitlist on" : "No waitlist"}
                  </Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-3">
              <CapacityBar
                filled={activeSignupCount(slot.signups)}
                capacity={slot.capacity}
              />

              {slot.signups.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-1 font-medium">Volunteer</th>
                      <th className="pb-1 font-medium">Email</th>
                      <th className="pb-1 font-medium">Signed up</th>
                      <th className="pb-1 font-medium">Status</th>
                      <th className="w-10 pb-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...slot.signups]
                      .sort(compareSignupsByStatus)
                      .map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-1">{s.volunteerName}</td>
                          <td className="py-1 break-all text-muted-foreground">
                            {s.email}
                          </td>
                          <td className="py-1 text-muted-foreground">
                            {new Date(s.createdAt).toLocaleString()}
                          </td>
                          <td className="py-1">
                            <SignupStatusBadge status={s.status} />
                          </td>
                          <td className="py-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => setPendingSignupId(s.id)}
                              disabled={s.status === "Cancelled" || s.status === "Removed"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

interface InviteLinkSectionProps {
  eventId: string
}

function InviteLinkSection({ eventId }: InviteLinkSectionProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [pendingLink, setPendingLink] = useState<InviteLink | null>(null)
  const [revoking, setRevoking] = useState(false)

  const { data: links, isLoading } = useQuery({
    queryKey: ["inviteLinks", eventId],
    queryFn: () => api.listInviteLinks(eventId),
  })

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const link = await api.createInviteLink(eventId)
      const url = `${window.location.origin}/invite/${link.code}`
      await copyToClipboard(url)
      toast.success("Invite link copied to clipboard")
      queryClient.invalidateQueries({ queryKey: ["inviteLinks", eventId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate link")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`
    await copyToClipboard(url)
    toast.success("Link copied")
  }

  const handleRevoke = async () => {
    if (!pendingLink) return
    setRevoking(true)
    try {
      await api.revokeInviteLink(pendingLink.id)
      toast.success("Invite link revoked")
      setPendingLink(null)
      queryClient.invalidateQueries({ queryKey: ["inviteLinks", eventId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke link")
    } finally {
      setRevoking(false)
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Invite links
          </span>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            <Plus className="mr-1 h-3 w-3" />
            {generating ? "Generating..." : "Generate link"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {links && links.length === 0 && (
          <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">
            No invite links yet. Generate one to share with volunteers.
          </p>
        )}
        {links?.map((link) => (
          <div
            key={link.id}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <Input
              readOnly
              value={`${window.location.origin}/invite/${link.code}`}
              className="h-8 font-mono text-xs"
              onClick={(e) => e.currentTarget.select()}
            />
            <Badge variant={link.isActive ? "default" : "secondary"}>
              {link.isActive ? "Active" : "Revoked"}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleCopy(link.code)}
              title="Copy"
              disabled={!link.isActive}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setPendingLink(link)}
              title="Revoke"
              disabled={!link.isActive}
            >
              <Power className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={pendingLink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLink(null)
        }}
        title="Revoke invite link?"
        description="Volunteers using it will see an invalid link. This action cannot be undone."
        confirmLabel="Revoke"
        variant="destructive"
        isLoading={revoking}
        loadingLabel="Revoking..."
        onConfirm={handleRevoke}
      />
    </Card>
  )
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    className?: string
  }
> = {
  Confirmed: { label: "Confirmed", variant: "default" },
  Pending: {
    label: "Pending",
    variant: "outline",
    className:
      "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  },
  Waitlisted: {
    label: "Waitlisted",
    variant: "outline",
    className:
      "border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400",
  },
  WaitlistPending: {
    label: "Waitlist pending",
    variant: "outline",
    className:
      "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  },
  Cancelled: { label: "Cancelled", variant: "destructive" },
  Removed: { label: "Removed", variant: "secondary" },
}

function SignupStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    variant: "secondary" as const,
  }
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  )
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through to execCommand fallback
    }
  }
  const input = document.createElement("input")
  input.value = text
  document.body.appendChild(input)
  input.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(input)
  if (!ok) throw new Error("Clipboard copy failed")
}
