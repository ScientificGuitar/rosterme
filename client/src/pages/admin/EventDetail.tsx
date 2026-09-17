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
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
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
import { Separator } from "@/components/ui/separator"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState, MetaRow } from "@/components/ui/layout"
import { useEvent } from "@/hooks/useEvent"
import { useDeleteSignup } from "@/hooks/useDeleteSignup"
import { useApi } from "@/hooks/useApi"
import type { InviteLink } from "@/lib/types"

export function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: event, isLoading, error } = useEvent(id)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [pendingSignupId, setPendingSignupId] = useState<string | null>(null)
  const [expandedSignupId, setExpandedSignupId] = useState<string | null>(null)
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
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      await queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.removeQueries({ queryKey: ["event", id] })
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

  if (isLoading && !event) {
    return <div className="loading-state">Loading...</div>
  }

  if (error || !event) {
    return (
      <div className="loading-state">
        <p className="muted mb-4">
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
    <Card className="shell-admin">
      <CardHeader>
        <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="page-title text-xl break-words sm:text-2xl">
              {event.title}
            </h1>
            <p className="muted truncate">
              {event.groupName} · {event.date}
            </p>
            {event.location && (
              <MetaRow className="text-sm">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </MetaRow>
            )}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center px-2 sm:flex-none sm:px-2.5"
              onClick={handleExportCsv}
              disabled={totalSignups === 0}
              title={
                totalSignups === 0 ? "No volunteers to export" : "Export as CSV"
              }
              aria-label="Export volunteers as CSV"
            >
              <Download className="mr-1 h-3 w-3" />
              <span className="sm:hidden">Export</span>
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center px-2 sm:flex-none sm:px-2.5"
              onClick={() => navigate(`/events/${event.id}/edit`)}
              title="Edit event"
              aria-label="Edit event"
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 justify-center px-2 sm:flex-none sm:px-2.5"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete event"
              aria-label="Delete event"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              <span className="sm:hidden">Delete</span>
              <span className="hidden sm:inline">Delete Event</span>
            </Button>
          </div>
        </div>
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
      </CardHeader>
      <Separator />
      <CardContent className="form-stack">
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

        <div className="stack-md">
          {event.slots.length === 0 && (
            <p className="muted text-center">No time slots for this event.</p>
          )}
          {event.slots.map((slot) => {
            const sortedSignups = [...slot.signups].sort(compareSignupsByStatus)
            return (
              <Card key={slot.id}>
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">
                      {slot.label}
                      <span className="ml-2 font-normal whitespace-nowrap text-muted-foreground">
                        {formatTime(slot.startTime)}&ndash;
                        {formatTime(slot.endTime)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                <CardContent className="section-stack p-4 pt-3">
                  <CapacityBar
                    filled={activeSignupCount(slot.signups)}
                    capacity={slot.capacity}
                  />

                  {slot.signups.length > 0 && (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="w-8 pb-1" />
                              <th className="pb-1 font-medium">Volunteer</th>
                              <th className="pb-1 font-medium">Email</th>
                              <th className="pb-1 font-medium">Signed up</th>
                              <th className="pb-1 font-medium">Status</th>
                              <th className="w-10 pb-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedSignups.map((s) => {
                              const answers = s.answers ?? []
                              const hasAnswers = answers.length > 0
                              const expanded = expandedSignupId === s.id
                              return (
                                <SignupRow
                                  key={s.id}
                                  signup={s}
                                  answers={answers}
                                  questions={event.questions}
                                  hasAnswers={hasAnswers}
                                  expanded={expanded}
                                  onToggle={() =>
                                    setExpandedSignupId(expanded ? null : s.id)
                                  }
                                  onRemove={() => setPendingSignupId(s.id)}
                                />
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <ul className="space-y-2 md:hidden">
                        {sortedSignups.map((s) => {
                          const expanded = expandedSignupId === s.id
                          return (
                            <SignupCard
                              key={s.id}
                              signup={s}
                              answers={s.answers ?? []}
                              questions={event.questions}
                              expanded={expanded}
                              onToggle={() =>
                                setExpandedSignupId(expanded ? null : s.id)
                              }
                              onRemove={() => setPendingSignupId(s.id)}
                            />
                          )
                        })}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
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
        <CardTitle className="flex items-center justify-between">
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
      <CardContent className="field-stack p-4 pt-2">
        {isLoading && <p className="muted">Loading...</p>}
        {links && links.length === 0 && (
          <EmptyState>
            No invite links yet. Generate one to share with volunteers.
          </EmptyState>
        )}
        {links?.map((link) => (
          <div
            key={link.id}
            className="row-card-sm flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <Input
              readOnly
              value={`${window.location.origin}/invite/${link.code}`}
              className="h-8 w-full font-mono text-xs"
              onClick={(e) => e.currentTarget.select()}
            />
            <div className="flex items-center gap-2">
              <Badge variant={link.isActive ? "default" : "secondary"}>
                {link.isActive ? "Active" : "Revoked"}
              </Badge>
              <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCopy(link.code)}
                  title="Copy"
                  aria-label="Copy invite link"
                  disabled={!link.isActive}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPendingLink(link)}
                  title="Revoke"
                  aria-label="Revoke invite link"
                  disabled={!link.isActive}
                >
                  <Power className="h-3 w-3" />
                </Button>
              </div>
            </div>
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
    variant: NonNullable<VariantProps<typeof badgeVariants>["variant"]>
  }
> = {
  Confirmed: { label: "Confirmed", variant: "default" },
  Pending: { label: "Pending", variant: "pending" },
  Waitlisted: { label: "Waitlisted", variant: "waitlist" },
  WaitlistPending: { label: "Waitlist pending", variant: "pending" },
  Cancelled: { label: "Cancelled", variant: "destructive" },
  Removed: { label: "Removed", variant: "secondary" },
}

function SignupStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    variant: "secondary" as const,
  }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

interface SignupRowProps {
  signup: {
    id: string
    volunteerName: string
    email: string
    status: string
    createdAt: string
  }
  answers: { questionId: string; value: string }[]
  questions: { id: string; label: string; isDeleted: boolean }[]
  hasAnswers: boolean
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}

interface SignupCardProps {
  signup: {
    id: string
    volunteerName: string
    email: string
    status: string
    createdAt: string
  }
  answers: { questionId: string; value: string }[]
  questions: { id: string; label: string; isDeleted: boolean }[]
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}

function SignupCard({
  signup,
  answers,
  questions,
  expanded,
  onToggle,
  onRemove,
}: SignupCardProps) {
  const questionById = new Map(questions.map((q) => [q.id, q]))
  return (
    <li className="row-card-sm">
      <div className="flex items-start gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={onToggle}
          title={expanded ? "Hide details" : "Show details"}
          aria-label={expanded ? "Hide details" : "Show details"}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="min-w-0 flex-1 text-sm font-medium break-words">
              {signup.volunteerName}
            </p>
            <span className="shrink-0">
              <SignupStatusBadge status={signup.status} />
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove signup"
          aria-label={`Remove signup for ${signup.volunteerName}`}
          disabled={
            signup.status === "Cancelled" || signup.status === "Removed"
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expanded && (
        <dl className="mt-2 space-y-1 border-t pt-2 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-muted-foreground">
              Email:
            </dt>
            <dd className="min-w-0 flex-1 break-all">{signup.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-muted-foreground">
              Signed up:
            </dt>
            <dd className="break-words text-muted-foreground">
              {new Date(signup.createdAt).toLocaleString()}
            </dd>
          </div>
          {answers.map((answer) => {
            const question = questionById.get(answer.questionId)
            const label = question ? question.label : "Deleted question"
            return (
              <div key={answer.questionId} className="flex gap-2">
                <dt className="shrink-0 font-medium text-muted-foreground">
                  {label}
                  {question?.isDeleted && (
                    <span className="ml-1 font-normal opacity-70">
                      (deleted)
                    </span>
                  )}
                  :
                </dt>
                <dd className="min-w-0 flex-1 break-all">
                  {formatAnswerValue(answer.value)}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </li>
  )
}

function SignupRow({
  signup,
  answers,
  questions,
  hasAnswers,
  expanded,
  onToggle,
  onRemove,
}: SignupRowProps) {
  const questionById = new Map(questions.map((q) => [q.id, q]))
  return (
    <>
      <tr className="border-b last:border-0">
        <td className="py-1">
          {hasAnswers ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={onToggle}
              title={expanded ? "Hide answers" : "Show answers"}
              aria-label={expanded ? "Hide answers" : "Show answers"}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : null}
        </td>
        <td className="py-1">{signup.volunteerName}</td>
        <td className="py-1 break-all text-muted-foreground">{signup.email}</td>
        <td className="py-1 text-muted-foreground">
          {new Date(signup.createdAt).toLocaleString()}
        </td>
        <td className="py-1">
          <SignupStatusBadge status={signup.status} />
        </td>
        <td className="py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={
              signup.status === "Cancelled" || signup.status === "Removed"
            }
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </td>
      </tr>
      {expanded && hasAnswers && (
        <tr className="border-b bg-muted/40 last:border-0">
          <td />
          <td colSpan={5} className="py-2 pr-2">
            <dl className="space-y-1">
              {answers.map((answer) => {
                const question = questionById.get(answer.questionId)
                const label = question ? question.label : "Deleted question"
                return (
                  <div key={answer.questionId} className="flex gap-2 text-sm">
                    <dt className="shrink-0 font-medium text-muted-foreground">
                      {label}
                      {question?.isDeleted && (
                        <span className="ml-1 font-normal opacity-70">
                          (deleted)
                        </span>
                      )}
                      :
                    </dt>
                    <dd className="break-all">
                      {formatAnswerValue(answer.value)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

function formatAnswerValue(value: string): string {
  if (value === "true") return "Yes"
  if (value === "false") return "No"
  return value
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
