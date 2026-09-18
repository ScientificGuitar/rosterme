import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
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
  Search,
  X,
  Users,
  Activity,
  ChartColumn,
  Clock,
  Info,
  ListChecks,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { CapacityBar } from "@/components/ui/capacity-bar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  activeSignupCount,
  cn,
  compareSignupsByStatus,
  formatTime,
  waitlistCount,
} from "@/lib/utils"
import {
  buildEventSignupsCsv,
  buildSignupsFilename,
  downloadCsv,
} from "@/lib/csv"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  AdminHeaderBand,
  AdminHeaderEyebrow,
  AdminHeaderSubtitle,
  AdminHeaderTitle,
  AdminHeaderTitleBlock,
  AdminHeaderTitleRow,
  AdminPageBody,
  AdminPageCenter,
  AdminPageShell,
  AdminTabsList,
  AdminTabsTrigger,
  CardSearchInput,
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
  EmptyState,
  GhostAddRow,
  MetaRow,
  MobileRowList,
  RowIconButton,
  RowPrimary,
  RowSecondary,
  TableBleed,
} from "@/components/ui/layout"
import { SlotDialog, type SlotDialogSlot } from "@/components/admin/SlotDialog"
import { useEvent } from "@/hooks/useEvent"
import { useDeleteSignup } from "@/hooks/useDeleteSignup"
import { useApi } from "@/hooks/useApi"
import { formatApiError } from "@/lib/api"
import { QUESTION_TYPES } from "@/lib/eventQuestions"
import { todayLocal } from "@/lib/eventSlots"
import type { InviteLink, RosterEvent } from "@/lib/types"

export function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: event, isLoading, error } = useEvent(id)
  const [tab, setTab] = useState("overview")
  const navigate = useNavigate()

  const handleExportCsv = () => {
    if (!event) return
    try {
      const csv = buildEventSignupsCsv(event)
      downloadCsv(buildSignupsFilename(event.title, event.date), csv)
      toast.success("Signups exported to CSV")
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
  const totalCapacity = event.slots.reduce((n, s) => n + s.capacity, 0)
  const totalActive = event.slots.reduce(
    (n, s) => n + activeSignupCount(s.signups),
    0
  )
  const totalWaitlisted = event.slots.reduce(
    (n, s) => n + waitlistCount(s.signups),
    0
  )
  const fillPercent =
    totalCapacity > 0 ? Math.round((totalActive / totalCapacity) * 100) : 0

  return (
    <AdminPageShell>
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div>
          <AdminHeaderBand withTabs>
            <AdminHeaderTitleRow>
              <AdminHeaderTitleBlock>
                {event.createdAt && (
                  <AdminHeaderEyebrow>
                    Created {formatCreatedAt(event.createdAt)}
                  </AdminHeaderEyebrow>
                )}
                <AdminHeaderTitle>{event.title}</AdminHeaderTitle>
                <AdminHeaderSubtitle>
                  {event.groupName} · {formatEventDate(event.date)}
                </AdminHeaderSubtitle>
                {event.location && (
                  <MetaRow className="mt-1 text-sm">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </MetaRow>
                )}
              </AdminHeaderTitleBlock>
            </AdminHeaderTitleRow>
            <AdminTabsList>
              <AdminTabsTrigger value="overview">Overview</AdminTabsTrigger>
              <AdminTabsTrigger value="signups">Signups</AdminTabsTrigger>
              <AdminTabsTrigger value="invites">Invites</AdminTabsTrigger>
              <AdminTabsTrigger value="settings">Settings</AdminTabsTrigger>
            </AdminTabsList>
          </AdminHeaderBand>
          <Separator />
        </div>
        <TabsContent value="overview">
          <AdminPageBody>
            <AdminPageCenter>
              <DataCard>
                <DataCardHeader>
                  <DataCardTitle
                    icon={Info}
                    actions={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        disabled={totalSignups === 0}
                        title={
                          totalSignups === 0
                            ? "No signups to export"
                            : "Export as CSV"
                        }
                        aria-label="Export signups as CSV"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Export CSV
                      </Button>
                    }
                  >
                    About this event
                  </DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent>
                  {event.description ? (
                    <p className="max-w-3xl text-sm whitespace-pre-wrap">
                      {event.description}
                    </p>
                  ) : (
                    <p className="muted">No description yet.</p>
                  )}
                </DataCardContent>
              </DataCard>
              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={ChartColumn}>
                    Signup progress
                  </DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-2xl font-bold">
                      {totalActive}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {totalCapacity} spots filled
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fillPercent}%
                    </p>
                  </div>
                  <CapacityBar filled={totalActive} capacity={totalCapacity} />
                  {totalWaitlisted > 0 && (
                    <p className="muted-xs">
                      {totalWaitlisted} on the waitlist
                    </p>
                  )}
                </DataCardContent>
              </DataCard>
              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={Clock}>Timeslots</DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent variant="rows">
                  {event.slots.length === 0 ? (
                    <p className="muted py-2 text-center">No time slots yet.</p>
                  ) : (
                    <>
                      <TableBleed>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-2 font-medium">Slot</th>
                              <th className="py-2 font-medium">Time</th>
                              <th className="py-2 text-right font-medium">
                                Filled
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {event.slots.map((slot) => {
                              const count = activeSignupCount(slot.signups)
                              const waiting = waitlistCount(slot.signups)
                              return (
                                <tr
                                  key={slot.id}
                                  className="border-b last:border-0"
                                >
                                  <td className="py-2 text-sm font-medium">
                                    {slot.label}
                                  </td>
                                  <td className="py-2 text-sm text-muted-foreground">
                                    {formatTime(slot.startTime)}&ndash;
                                    {formatTime(slot.endTime)}
                                  </td>
                                  <td className="py-2 text-right">
                                    <Badge
                                      variant={
                                        count >= slot.capacity
                                          ? "destructive"
                                          : "secondary"
                                      }
                                    >
                                      {count}/{slot.capacity}
                                      {waiting > 0 && ` · ${waiting} waiting`}
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </TableBleed>
                      <MobileRowList>
                        {event.slots.map((slot) => {
                          const count = activeSignupCount(slot.signups)
                          const waiting = waitlistCount(slot.signups)
                          return (
                            <li
                              key={slot.id}
                              className="flex items-center justify-between gap-2 px-4 py-2"
                            >
                              <div className="min-w-0">
                                <RowPrimary>{slot.label}</RowPrimary>
                                <RowSecondary>
                                  {formatTime(slot.startTime)}&ndash;
                                  {formatTime(slot.endTime)}
                                </RowSecondary>
                              </div>
                              <Badge
                                variant={
                                  count >= slot.capacity
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {count}/{slot.capacity}
                                {waiting > 0 && ` · ${waiting} waiting`}
                              </Badge>
                            </li>
                          )
                        })}
                      </MobileRowList>
                    </>
                  )}
                </DataCardContent>
              </DataCard>
              <DataCard>
                <DataCardHeader>
                  <DataCardTitle icon={Activity}>Recent activity</DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent>
                  <p className="muted">Recent activity coming soon.</p>
                </DataCardContent>
              </DataCard>
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
        <TabsContent value="signups" className="flex flex-col">
          <SignupsTab event={event} />
        </TabsContent>
        <TabsContent value="invites">
          <AdminPageBody>
            <AdminPageCenter>
              <InviteLinkSection eventId={event.id} />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
        <TabsContent value="settings">
          <AdminPageBody>
            <AdminPageCenter>
              <SettingsTab event={event} />
            </AdminPageCenter>
          </AdminPageBody>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  )
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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

function toSlotDialogSlot(slot: RosterEvent["slots"][number]): SlotDialogSlot {
  return {
    id: slot.id,
    label: slot.label,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    allowWaitlist: slot.allowWaitlist,
    signupCount: activeSignupCount(slot.signups),
  }
}

function SignupsTab({ event }: { event: RosterEvent }) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [expandedSignupId, setExpandedSignupId] = useState<string | null>(null)
  const [slotsExpanded, setSlotsExpanded] = useState(false)
  const [pendingSignupId, setPendingSignupId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [signupQuery, setSignupQuery] = useState("")
  const [slotDialogOpen, setSlotDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<
    RosterEvent["slots"][number] | null
  >(null)
  const [deletingSlot, setDeletingSlot] = useState<
    RosterEvent["slots"][number] | null
  >(null)
  const [deletingSlotBusy, setDeletingSlotBusy] = useState(false)
  const deleteSignup = useDeleteSignup()
  const api = useApi()
  const queryClient = useQueryClient()
  const isPast = event.date < todayLocal()

  const editingSlotDialogSlot = editingSlot
    ? toSlotDialogSlot(editingSlot)
    : undefined

  const visibleSlots = event.slots.filter((slot) =>
    slot.label.toLowerCase().includes(query.trim().toLowerCase())
  )
  const selectedSlot =
    event.slots.find((slot) => slot.id === selectedSlotId) ??
    visibleSlots[0] ??
    null
  // Below lg the slot list collapses to the selected slot + an expander so
  // the roster isn't buried under a long list. If the selection is filtered
  // out, fall back to showing every visible row.
  const selectedIsVisible =
    selectedSlot != null &&
    visibleSlots.some((slot) => slot.id === selectedSlot.id)

  const handleDeleteSignup = async (signupId: string) => {
    try {
      await deleteSignup.mutateAsync(signupId)
      toast.success("Signup removed — participant notified")
      setPendingSignupId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete signup")
    }
  }

  const handleDeleteSlot = async () => {
    if (!deletingSlot) return
    setDeletingSlotBusy(true)
    try {
      await api.deleteSlot(event.id, deletingSlot.id)
      if (deletingSlot.id === selectedSlotId) setSelectedSlotId(null)
      toast.success("Time slot deleted")
      setDeletingSlot(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", event.id] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ])
    } catch (e) {
      toast.error(formatApiError(e, "Failed to delete time slot"))
    } finally {
      setDeletingSlotBusy(false)
    }
  }

  const sortedSignups = selectedSlot
    ? [...selectedSlot.signups].sort(compareSignupsByStatus)
    : []
  const signupFilter = signupQuery.trim().toLowerCase()
  const filteredSignups = sortedSignups.filter(
    (s) =>
      s.volunteerName.toLowerCase().includes(signupFilter) ||
      s.email.toLowerCase().includes(signupFilter)
  )
  const hasAnyAnswers = filteredSignups.some(
    (s) => (s.answers?.length ?? 0) > 0
  )
  const activeCount = selectedSlot ? activeSignupCount(selectedSlot.signups) : 0

  return (
    <>
      <ConfirmDialog
        open={pendingSignupId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSignupId(null)
        }}
        title="Remove signup?"
        description="This will remove the participant from this slot and notify them by email. This action cannot be undone."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={deleteSignup.isPending}
        loadingLabel="Removing..."
        onConfirm={() => {
          if (pendingSignupId) handleDeleteSignup(pendingSignupId)
        }}
      />
      <SlotDialog
        key={editingSlot?.id ?? "new"}
        eventId={event.id}
        open={slotDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingSlot(null)
          setSlotDialogOpen(open)
        }}
        slot={editingSlotDialogSlot}
        onSaved={(slotId) => {
          setQuery("")
          setSelectedSlotId(slotId)
          setExpandedSignupId(null)
        }}
      />
      <ConfirmDialog
        open={deletingSlot !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSlot(null)
        }}
        title={`Delete "${deletingSlot?.label ?? ""}"?`}
        description={
          deletingSlot && activeSignupCount(deletingSlot.signups) > 0
            ? `This slot has ${activeSignupCount(deletingSlot.signups)} active signup(s), which will be removed with the slot. This action cannot be undone.`
            : "This will permanently remove the time slot. This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deletingSlotBusy}
        loadingLabel="Deleting..."
        onConfirm={handleDeleteSlot}
      />
      <div className="grid flex-1 content-start items-start gap-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:content-stretch lg:items-stretch">
        <div className="flex flex-col">
          <div className="divide-y divide-border">
            <div
              role="search"
              className={cn(
                "bg-green-50 px-4 py-3 lg:border-r lg:border-r-border dark:bg-green-950",
                event.slots.length === 0 && "border-b"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search slots..."
                    aria-label="Search slots"
                    className="h-8 bg-background pr-8 pl-8 text-sm"
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground pointer-coarse:size-8 pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']"
                      onClick={() => setQuery("")}
                      aria-label="Clear filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setEditingSlot(null)
                    setSlotDialogOpen(true)
                  }}
                  title="Add time slot"
                  aria-label="Add time slot"
                  disabled={isPast}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {visibleSlots.length === 0 && event.slots.length > 0 && (
              <p className="muted-xs px-4 py-3 lg:border-r lg:border-r-border">
                No timeslots match.
              </p>
            )}
            {visibleSlots.map((slot) => {
              const count = activeSignupCount(slot.signups)
              const waiting = waitlistCount(slot.signups)
              const isSelected = slot.id === selectedSlot?.id
              return (
                <div
                  key={slot.id}
                  className={cn(
                    "flex items-center gap-1 rounded-none border-l-4 py-2 pr-2 pl-4 transition-colors last:border-b last:border-b-border",
                    isSelected
                      ? "border-l-green-700"
                      : "border-l-transparent bg-green-50 hover:bg-green-100 lg:border-r lg:border-r-border dark:bg-green-950 dark:hover:bg-green-900",
                    !isSelected &&
                      !slotsExpanded &&
                      selectedIsVisible &&
                      "max-lg:hidden"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSlotId(slot.id)
                      setExpandedSignupId(null)
                      setSlotsExpanded(false)
                    }}
                    aria-pressed={isSelected}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {slot.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(slot.startTime)}&ndash;
                          {formatTime(slot.endTime)}
                        </div>
                      </div>
                      <Badge
                        variant={
                          count >= slot.capacity ? "destructive" : "secondary"
                        }
                      >
                        {count}/{slot.capacity}
                        {waiting > 0 && ` · ${waiting} waiting`}
                      </Badge>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center">
                    <RowIconButton
                      onClick={() => {
                        setEditingSlot(slot)
                        setSlotDialogOpen(true)
                      }}
                      title={`Edit ${slot.label}`}
                      aria-label={`Edit ${slot.label}`}
                      disabled={isPast}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </RowIconButton>
                    <RowIconButton
                      className="hover:text-destructive"
                      onClick={() => setDeletingSlot(slot)}
                      title={`Delete ${slot.label}`}
                      aria-label={`Delete ${slot.label}`}
                      disabled={isPast}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </RowIconButton>
                  </div>
                </div>
              )
            })}
            {visibleSlots.length > 1 && selectedIsVisible && (
              <button
                type="button"
                onClick={() => setSlotsExpanded((v) => !v)}
                aria-expanded={slotsExpanded}
                className="flex w-full items-center justify-center gap-1 border-b border-b-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-green-100 hover:text-foreground lg:hidden dark:hover:bg-green-900"
              >
                {slotsExpanded
                  ? "Show less"
                  : `Show all ${visibleSlots.length} slots`}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    slotsExpanded && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
          <div
            aria-hidden="true"
            className="hidden flex-1 lg:block lg:border-r lg:border-r-border"
          />
        </div>
        <AdminPageBody>
          {selectedSlot ? (
            <AdminPageCenter>
              <DataCard>
                <DataCardHeader className="flex-col items-stretch gap-1 px-4 pt-3 pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">
                      {selectedSlot.label}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Badge
                        variant={
                          selectedSlot.allowWaitlist ? "outline" : "secondary"
                        }
                        title={
                          selectedSlot.allowWaitlist
                            ? "Participants can join the waitlist when this slot is full"
                            : "Waitlist disabled — full slots reject new signups"
                        }
                      >
                        {selectedSlot.allowWaitlist
                          ? "Waitlist on"
                          : "No waitlist"}
                      </Badge>
                    </span>
                  </div>
                  <p className="muted-xs mt-0.5">
                    {formatTime(selectedSlot.startTime)}&ndash;
                    {formatTime(selectedSlot.endTime)}
                  </p>
                </DataCardHeader>
                <DataCardContent className="pt-2 pb-3">
                  <CapacityBar
                    filled={activeCount}
                    capacity={selectedSlot.capacity}
                  />
                </DataCardContent>
              </DataCard>
              <DataCard>
                <DataCardHeader>
                  <DataCardTitle
                    icon={Users}
                    actions={
                      <CardSearchInput
                        value={signupQuery}
                        onChange={setSignupQuery}
                        placeholder="Search..."
                        placeholderDesktop="Search signups..."
                        ariaLabel="Search signups"
                        clearLabel="Clear signup search"
                      />
                    }
                  >
                    Signups
                  </DataCardTitle>
                </DataCardHeader>
                <DataCardDivider />
                <DataCardContent variant="rows">
                  {sortedSignups.length === 0 ? (
                    <p className="muted py-2 text-center">
                      No signups for this slot yet.
                    </p>
                  ) : filteredSignups.length === 0 ? (
                    <p className="muted py-2 text-center">
                      No signups match your search.
                    </p>
                  ) : (
                    <>
                      <TableBleed>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              {hasAnyAnswers && <th className="w-8 py-2" />}
                              <th className="py-2 font-medium">Name</th>
                              <th className="py-2 font-medium">Email</th>
                              <th className="py-2 font-medium">Signed up</th>
                              <th className="py-2 font-medium">Status</th>
                              <th className="w-10 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSignups.map((s) => {
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
                                  showExpand={hasAnyAnswers}
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
                      </TableBleed>
                      <MobileRowList>
                        {filteredSignups.map((s) => {
                          const signupAnswers = s.answers ?? []
                          const expanded = expandedSignupId === s.id
                          return (
                            <SignupCard
                              key={s.id}
                              signup={s}
                              answers={signupAnswers}
                              questions={event.questions}
                              hasAnswers={signupAnswers.length > 0}
                              expanded={expanded}
                              onToggle={() =>
                                setExpandedSignupId(expanded ? null : s.id)
                              }
                              onRemove={() => setPendingSignupId(s.id)}
                            />
                          )
                        })}
                      </MobileRowList>
                    </>
                  )}
                </DataCardContent>
              </DataCard>
            </AdminPageCenter>
          ) : (
            <EmptyState>
              {event.slots.length === 0
                ? "No time slots for this event."
                : "No time slots match your search."}
            </EmptyState>
          )}
        </AdminPageBody>
      </div>
    </>
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
  const [inviteQuery, setInviteQuery] = useState("")

  const { data: links, isLoading } = useQuery({
    queryKey: ["inviteLinks", eventId],
    queryFn: () => api.listInviteLinks(eventId),
  })

  const inviteFilter = inviteQuery.trim().toLowerCase()
  const visibleLinks = (links ?? [])
    .map((link, index) => ({ link, name: `Invite link ${index + 1}` }))
    .filter(
      ({ link, name }) =>
        name.toLowerCase().includes(inviteFilter) ||
        `${window.location.origin}/invite/${link.code}`
          .toLowerCase()
          .includes(inviteFilter)
    )
    .sort((a, b) => Number(b.link.isActive) - Number(a.link.isActive))

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
    <>
      <DataCard>
        <DataCardHeader>
          <DataCardTitle
            icon={Link2}
            actions={
              <CardSearchInput
                value={inviteQuery}
                onChange={setInviteQuery}
                placeholder="Search..."
                placeholderDesktop="Search invites..."
                ariaLabel="Search invite links"
                clearLabel="Clear invite search"
              />
            }
          >
            Invite links
          </DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent variant="rows">
          {isLoading && <p className="muted px-4 py-2">Loading...</p>}
          {!isLoading && (
            <>
              <TableBleed>
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="w-40 py-2 font-medium">Name</th>
                      <th className="py-2 font-medium">Link</th>
                      <th className="w-24 py-2 font-medium">Status</th>
                      <th className="w-20 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLinks.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted px-4 py-2 text-center">
                          {links?.length === 0
                            ? "No invite links yet."
                            : "No invite links match your search."}
                        </td>
                      </tr>
                    )}
                    {visibleLinks.map(({ link, name }) => {
                      const url = `${window.location.origin}/invite/${link.code}`
                      return (
                        <tr key={link.id} className="border-b last:border-0">
                          <td className="py-2 text-sm font-medium">
                            <span className="block truncate">{name}</span>
                          </td>
                          <td className="py-2">
                            <span
                              title={url}
                              className="block truncate font-mono text-xs text-muted-foreground"
                            >
                              {url}
                            </span>
                          </td>
                          <td className="py-2">
                            <Badge
                              variant={link.isActive ? "default" : "secondary"}
                            >
                              {link.isActive ? "Active" : "Revoked"}
                            </Badge>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center justify-end gap-1">
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
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableBleed>
              <MobileRowList>
                {visibleLinks.length === 0 && (
                  <li className="muted px-4 py-2 text-center text-sm">
                    {links?.length === 0
                      ? "No invite links yet."
                      : "No invite links match your search."}
                  </li>
                )}
                {visibleLinks.map(({ link, name }) => {
                  const url = `${window.location.origin}/invite/${link.code}`
                  return (
                    <li key={link.id} className="px-4 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <RowPrimary>{name}</RowPrimary>
                        <Badge
                          variant={link.isActive ? "default" : "secondary"}
                        >
                          {link.isActive ? "Active" : "Revoked"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p
                          title={url}
                          className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
                        >
                          {url}
                        </p>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
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
                          className="h-8 w-8 shrink-0"
                          onClick={() => setPendingLink(link)}
                          title="Revoke"
                          aria-label="Revoke invite link"
                          disabled={!link.isActive}
                        >
                          <Power className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </MobileRowList>
              <GhostAddRow onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating..." : "Generate link"}
              </GhostAddRow>
            </>
          )}
        </DataCardContent>
      </DataCard>
      <ConfirmDialog
        open={pendingLink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLink(null)
        }}
        title="Revoke invite link?"
        description="People using it will see an invalid link. This action cannot be undone."
        confirmLabel="Revoke"
        variant="destructive"
        isLoading={revoking}
        loadingLabel="Revoking..."
        onConfirm={handleRevoke}
      />
    </>
  )
}

function SettingsTab({ event }: { event: RosterEvent }) {
  const navigate = useNavigate()
  const api = useApi()
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState(false)

  const handleDeleteEvent = async () => {
    setDeletingEvent(true)
    try {
      await api.deleteEvent(event.id)
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      await queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.removeQueries({ queryKey: ["event", event.id] })
      toast.success("Event deleted")
      setDeleteDialogOpen(false)
      navigate("/dashboard")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete event")
    } finally {
      setDeletingEvent(false)
    }
  }

  const answerCounts = new Map<string, number>()
  for (const slot of event.slots) {
    for (const signup of slot.signups) {
      for (const answer of signup.answers ?? []) {
        answerCounts.set(
          answer.questionId,
          (answerCounts.get(answer.questionId) ?? 0) + 1
        )
      }
    }
  }

  return (
    <>
      <DataCard>
        <DataCardHeader>
          <DataCardTitle
            icon={ListChecks}
            actions={
              event.questions.length > 0 ? (
                <Badge variant="secondary" className="shrink-0">
                  {event.questions.length}{" "}
                  {event.questions.length === 1 ? "question" : "questions"}
                </Badge>
              ) : undefined
            }
          >
            Signup questions
          </DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent variant="rows">
          {event.questions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No signup questions yet.</p>
              <p className="muted mt-1">
                Add questions participants answer when signing up.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => navigate(`/events/${event.id}/edit`)}
              >
                Add questions
              </Button>
            </div>
          ) : (
            <>
              <TableBleed>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Question</th>
                      <th className="py-2 font-medium">Type</th>
                      <th className="w-28 py-2 font-medium">Required</th>
                      <th className="w-28 py-2 text-right font-medium">
                        Answers
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.questions.map((question) => {
                      const answerCount = answerCounts.get(question.id) ?? 0
                      return (
                        <tr
                          key={question.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 text-sm font-medium">
                            {question.label}
                            {question.isDeleted && (
                              <span className="ml-1 font-normal text-muted-foreground opacity-70">
                                (deleted)
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-sm text-muted-foreground">
                            {formatQuestionType(question.type)}
                            {question.type === "Dropdown" &&
                              question.options && (
                              <span className="muted-xs ml-1">
                                · {question.options.length} options
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant={
                                question.required ? "default" : "secondary"
                              }
                            >
                              {question.required ? "Required" : "Optional"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">
                            <Badge variant="secondary">
                              {answerCount}{" "}
                              {answerCount === 1 ? "answer" : "answers"}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableBleed>
              <MobileRowList>
                {event.questions.map((question) => {
                  const answerCount = answerCounts.get(question.id) ?? 0
                  return (
                    <li key={question.id} className="px-4 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <RowPrimary>
                          {question.label}
                          {question.isDeleted && (
                            <span className="ml-1 font-normal text-muted-foreground opacity-70">
                              (deleted)
                            </span>
                          )}
                        </RowPrimary>
                        <Badge
                          variant={question.required ? "default" : "secondary"}
                        >
                          {question.required ? "Required" : "Optional"}
                        </Badge>
                      </div>
                      <RowSecondary className="mt-0.5">
                        {formatQuestionType(question.type)}
                        {question.type === "Dropdown" &&
                          question.options &&
                          ` · ${question.options.length} options`}{" "}
                        · {answerCount}{" "}
                        {answerCount === 1 ? "answer" : "answers"}
                      </RowSecondary>
                    </li>
                  )
                })}
              </MobileRowList>
            </>
          )}
        </DataCardContent>
      </DataCard>
      <DataCard>
        <DataCardHeader>
          <DataCardTitle icon={Wrench}>Manage event</DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/events/${event.id}/edit`)}
              title="Edit event"
              aria-label="Edit event"
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit event
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete event"
              aria-label="Delete event"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete event
            </Button>
          </div>
        </DataCardContent>
      </DataCard>
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
    </>
  )
}

function formatQuestionType(type: string): string {
  return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type
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
  showExpand: boolean
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
  hasAnswers: boolean
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}

function SignupCard({
  signup,
  answers,
  questions,
  hasAnswers,
  expanded,
  onToggle,
  onRemove,
}: SignupCardProps) {
  const questionById = new Map(questions.map((q) => [q.id, q]))
  return (
    <li className="px-4 py-2">
      <div className="flex items-start gap-3">
        <span className="-ml-2 mr-1 grid w-8 shrink-0 place-items-center self-center pointer-coarse:w-11">
          {hasAnswers && (
            <RowIconButton
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
            </RowIconButton>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <RowPrimary>{signup.volunteerName}</RowPrimary>
            <span className="shrink-0">
              <SignupStatusBadge status={signup.status} />
            </span>
          </div>
          <RowSecondary className="mt-0.5 truncate">
            {signup.email}
          </RowSecondary>
          <RowSecondary>
            {new Date(signup.createdAt).toLocaleDateString()}
          </RowSecondary>
        </div>
        <RowIconButton
          className="shrink-0 hover:text-destructive"
          onClick={onRemove}
          title="Remove signup"
          aria-label={`Remove signup for ${signup.volunteerName}`}
          disabled={
            signup.status === "Cancelled" || signup.status === "Removed"
          }
        >
          <Trash2 className="h-4 w-4" />
        </RowIconButton>
      </div>
      {expanded && hasAnswers && (
        <dl className="-mx-4 -mb-2 mt-2 space-y-1 border-t border-border bg-muted/40 px-4 pt-2 pb-2 text-sm">
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
  showExpand,
  expanded,
  onToggle,
  onRemove,
}: SignupRowProps) {
  const questionById = new Map(questions.map((q) => [q.id, q]))
  return (
    <>
      <tr className="border-b last:border-0">
        {showExpand && (
          <td className="py-2 pr-3">
            {hasAnswers ? (
              <RowIconButton
                className="-ml-2"
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
              </RowIconButton>
            ) : null}
          </td>
        )}
        <td className="py-2">{signup.volunteerName}</td>
        <td className="py-2 break-all text-muted-foreground">{signup.email}</td>
        <td className="py-2 text-muted-foreground">
          {new Date(signup.createdAt).toLocaleDateString()}
        </td>
        <td className="py-2">
          <SignupStatusBadge status={signup.status} />
        </td>
        <td className="py-2">
          <RowIconButton
            className="hover:text-destructive"
            onClick={onRemove}
            disabled={
              signup.status === "Cancelled" || signup.status === "Removed"
            }
          >
            <Trash2 className="h-3 w-3" />
          </RowIconButton>
        </td>
      </tr>
      {expanded && hasAnswers && (
        <tr className="border-b bg-muted/40 last:border-0">
          {showExpand && <td />}
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
