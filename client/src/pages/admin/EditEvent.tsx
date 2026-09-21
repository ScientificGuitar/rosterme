import { useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Clock, Info, ListChecks, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
  DataRowList,
  GhostAddRow,
} from "@/components/ui/layout"
import { EventDetailsFields } from "@/components/admin/EventDetailsFields"
import { GroupSelect } from "@/components/admin/GroupSelect"
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { StickySaveBar } from "@/components/admin/StickySaveBar"
import { QuestionRowCard } from "@/components/admin/QuestionRowCard"
import { useEvent } from "@/hooks/useEvent"
import { useApi } from "@/hooks/useApi"
import { useUnsavedChangesPrompt, confirmNavigation } from "@/hooks/useUnsavedChanges"
import { formatApiError } from "@/lib/api"
import {
  createEmptySlot,
  todayLocal,
  validateSlotRows,
  toSlotRows,
  buildSlotUpdatePayload,
  type SlotRow,
} from "@/lib/eventSlots"
import {
  createEmptyQuestion,
  toQuestionDrafts,
  validateQuestionRows,
  buildQuestionPayload,
  MAX_QUESTIONS,
  type QuestionRow,
} from "@/lib/eventQuestions"
import {
  activeRows,
  clearDraftError,
  markRowDeleted,
  undoRowDeleted,
  updateDraftRow,
} from "@/lib/eventDrafts"
import type { RosterEvent } from "@/lib/types"

export function EditEvent() {
  const { id } = useParams<{ id: string }>()
  const { data: event, isPending, error } = useEvent(id)
  const navigate = useNavigate()

  if (isPending && !event) {
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

  return <EventForm event={event} eventId={id!} />
}

interface EventFormProps {
  event: RosterEvent
  eventId: string
}

type Tab = "overview" | "slots" | "settings"

function EventForm({ event, eventId }: EventFormProps) {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>("overview")
  const [title, setTitle] = useState(event.title)
  const [groupId, setGroupId] = useState(event.groupId)
  const [description, setDescription] = useState(event.description ?? "")
  const [location, setLocation] = useState(event.location ?? "")
  const [date, setDate] = useState(event.date)
  const [submitting, setSubmitting] = useState(false)
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({})
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {}
  )

  const nextKey = useRef(event.slots.length + event.questions.length)
  const [slots, setSlots] = useState<SlotRow[]>(() => toSlotRows(event))
  const [questions, setQuestions] = useState<QuestionRow[]>(() =>
    toQuestionDrafts(event, event.slots.length)
  )

  // Snapshot of the pristine form to detect unsaved changes. Derived data
  // (keys, signup counts, answer presence) is stripped so only user-visible
  // edits count as dirty. Captured once on mount, like the form state above.
  const [pristine] = useState(() =>
    JSON.stringify({
      title: event.title,
      groupId: event.groupId,
      description: event.description ?? "",
      location: event.location ?? "",
      date: event.date,
      slots: toSlotRows(event).map((s) => ({
        id: s.id ?? null,
        label: s.label,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        allowWaitlist: s.allowWaitlist,
        deleted: s.deleted,
      })),
      questions: toQuestionDrafts(event, event.slots.length).map((q) => ({
        id: q.id ?? null,
        label: q.label,
        type: q.type,
        required: q.required,
        optionsText: q.optionsText,
        deleted: q.deleted,
      })),
    })
  )

  const isDirty =
    pristine !==
    JSON.stringify({
      title,
      groupId,
      description,
      location,
      date,
      slots: slots.map((s) => ({
        id: s.id ?? null,
        label: s.label,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        allowWaitlist: s.allowWaitlist,
        deleted: s.deleted,
      })),
      questions: questions.map((q) => ({
        id: q.id ?? null,
        label: q.label,
        type: q.type,
        required: q.required,
        optionsText: q.optionsText,
        deleted: q.deleted,
      })),
    })
  useUnsavedChangesPrompt(isDirty)

  const handleCancel = () => {
    if (confirmNavigation()) navigate(`/events/${eventId}`)
  }

  const invalidateEvent = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
    ])

  const addSlot = () => {
    const key = nextKey.current++
    setSlots((prev) => [
      ...prev,
      { ...createEmptySlot(key), signupCount: 0, deleted: false },
    ])
  }

  const updateSlot = (
    key: number,
    field: keyof Omit<SlotRow, "key" | "id" | "signupCount" | "deleted">,
    value: string | number | boolean
  ) => {
    setSlots((prev) =>
      updateDraftRow(prev, key, { [field]: value } as Partial<SlotRow>)
    )
    setSlotErrors((prev) => clearDraftError(prev, key))
  }

  const markSlotDeleted = (key: number) => {
    setSlots((prev) => markRowDeleted(prev, key))
  }

  const undoDeleteSlot = (key: number) => {
    setSlots((prev) => undoRowDeleted(prev, key))
  }

  const addQuestion = () => {
    const key = nextKey.current++
    setQuestions((prev) => [
      ...prev,
      { ...createEmptyQuestion(key), hasAnswers: false, deleted: false },
    ])
  }

  const updateQuestion = (
    key: number,
    field: keyof Omit<QuestionRow, "key" | "id" | "hasAnswers" | "deleted">,
    value: string | boolean
  ) => {
    setQuestions((prev) =>
      updateDraftRow(prev, key, { [field]: value } as Partial<QuestionRow>)
    )
    setQuestionErrors((prev) => clearDraftError(prev, key))
  }

  const markQuestionDeleted = (key: number) => {
    setQuestions((prev) => markRowDeleted(prev, key))
  }

  const undoDeleteQuestion = (key: number) => {
    setQuestions((prev) => undoRowDeleted(prev, key))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Event title is required")
      setTab("overview")
      return
    }
    if (date < todayLocal()) {
      toast.error("Event date cannot be in the past")
      setTab("overview")
      return
    }
    const slotErrs = validateSlotRows(slots)
    setSlotErrors(slotErrs)
    const questionErrs = validateQuestionRows(questions)
    setQuestionErrors(questionErrs)
    if (Object.keys(slotErrs).length > 0) {
      toast.error("Fix the highlighted time slots before saving.")
      setTab("slots")
      return
    }
    if (Object.keys(questionErrs).length > 0) {
      toast.error("Fix the highlighted signup questions before saving.")
      setTab("settings")
      return
    }
    setSubmitting(true)

    try {
      await api.updateEvent(eventId, {
        groupId,
        title: title.trim(),
        // Empty string clears the description; the backend normalizes it to null.
        description: description.trim(),
        // Empty string clears the location; the backend normalizes it to null.
        location: location.trim(),
        date,
        slots: buildSlotUpdatePayload(activeRows(slots)),
        questions: buildQuestionPayload(activeRows(questions)),
      })
      await invalidateEvent()
      toast.success("Event updated")
      navigate(`/events/${eventId}`)
    } catch (e) {
      toast.error(formatApiError(e, "Failed to update event"))
    } finally {
      setSubmitting(false)
    }
  }

  const deletedCount = slots.filter((s) => s.deleted).length
  const activeSlotCount = activeRows(slots).length
  const activeQuestionCount = activeRows(questions).length
  const isPast = event.date < todayLocal()

  return (
    <AdminPageShell>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div>
            <AdminHeaderBand withTabs>
              <AdminHeaderTitleRow>
                <AdminHeaderTitleBlock>
                  <AdminHeaderTitle>Edit Event</AdminHeaderTitle>
                  <AdminHeaderSubtitle>
                    Update the details, time slots and signup questions.
                  </AdminHeaderSubtitle>
                </AdminHeaderTitleBlock>
                <div className="hidden shrink-0 items-start gap-2 md:flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || isPast}
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </AdminHeaderTitleRow>
              <AdminTabsList>
                <AdminTabsTrigger value="overview">Overview</AdminTabsTrigger>
                <AdminTabsTrigger value="slots">Slots</AdminTabsTrigger>
                <AdminTabsTrigger value="settings">Settings</AdminTabsTrigger>
              </AdminTabsList>
            </AdminHeaderBand>
            <Separator />
          </div>
          {isPast && (
            <div className="px-4 pt-4 md:px-6 md:pt-6">
              <p className="alert-muted mx-auto w-full max-w-5xl bg-muted px-4">
                This event has already taken place and can no longer be edited.
              </p>
            </div>
          )}
          <TabsContent value="overview">
            <AdminPageBody>
              <AdminPageCenter>
                <DataCard>
                  <DataCardHeader>
                    <DataCardTitle icon={Info}>Event details</DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent className="space-y-4">
                    <GroupSelect
                      value={groupId}
                      onChange={setGroupId}
                      disabled={isPast}
                    />
                    <EventDetailsFields
                      title={title}
                      description={description}
                      location={location}
                      date={date}
                      onTitleChange={setTitle}
                      onDescriptionChange={setDescription}
                      onLocationChange={setLocation}
                      onDateChange={setDate}
                      dateMin={isPast ? undefined : todayLocal()}
                      disabled={isPast}
                    />
                  </DataCardContent>
                </DataCard>
              </AdminPageCenter>
            </AdminPageBody>
          </TabsContent>
          <TabsContent value="slots">
            <AdminPageBody>
              <AdminPageCenter>
                <DataCard>
                  <DataCardHeader>
                    <DataCardTitle
                      icon={Clock}
                      actions={
                        activeSlotCount > 0 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {activeSlotCount}{" "}
                            {activeSlotCount === 1 ? "slot" : "slots"}
                          </Badge>
                        ) : null
                      }
                    >
                      Time slots
                    </DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent variant="rows">
                    {activeSlotCount === 0 && (
                      <p className="muted py-3">
                        No time slots yet. Add time slots that people can
                        sign up for.
                      </p>
                    )}

                    {slots.length > 0 && (
                      <DataRowList>
                        {slots.map((slot) =>
                          slot.deleted ? (
                            <div
                              key={slot.key}
                              className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-left opacity-70 last:border-0"
                            >
                              <p className="muted">
                                <span className="font-medium line-through">
                                  {slot.label || "Untitled slot"}
                                </span>{" "}
                                will be deleted on save.
                                {slot.signupCount > 0 && (
                                  <span className="font-medium text-destructive">
                                    {" "}
                                    {slot.signupCount} signup(s) will be
                                    removed.
                                  </span>
                                )}
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => undoDeleteSlot(slot.key)}
                              >
                                <Undo2 className="mr-1 h-4 w-4" /> Undo
                              </Button>
                            </div>
                          ) : (
                            <SlotRowCard
                              key={slot.key}
                              slot={slot}
                              error={slotErrors[slot.key]}
                              capacityMin={
                                slot.signupCount > 0 ? slot.signupCount : 1
                              }
                              badge={
                                slot.id && (
                                  <Badge
                                    variant={
                                      slot.signupCount >= slot.capacity
                                        ? "destructive"
                                        : "secondary"
                                    }
                                  >
                                    {slot.signupCount}/{slot.capacity}
                                  </Badge>
                                )
                              }
                              hint={
                                slot.id && slot.signupCount > 0
                                  ? `${slot.signupCount} active signup(s) on this slot.`
                                  : undefined
                              }
                              onUpdate={(field, value) =>
                                updateSlot(slot.key, field, value)
                              }
                              onRemove={() => markSlotDeleted(slot.key)}
                              removeLabel={
                                slot.signupCount > 0
                                  ? `Mark for deletion (${slot.signupCount} signup(s) will be removed on save)`
                                  : "Remove slot"
                              }
                              removeIcon={<Trash2 className="h-4 w-4" />}
                              disabled={isPast}
                            />
                          )
                        )}
                      </DataRowList>
                    )}

                    {deletedCount > 0 && (
                      <p className="muted py-3">
                        {deletedCount} slot(s) marked for deletion — they will
                        be removed when you save.
                      </p>
                    )}

                    <GhostAddRow onClick={addSlot} disabled={isPast}>
                      Add slot
                    </GhostAddRow>
                  </DataCardContent>
                </DataCard>
              </AdminPageCenter>
            </AdminPageBody>
          </TabsContent>
          <TabsContent value="settings">
            <AdminPageBody>
              <AdminPageCenter>
                <DataCard>
                  <DataCardHeader>
                    <DataCardTitle
                      icon={ListChecks}
                      actions={
                        activeQuestionCount > 0 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {activeQuestionCount}/{MAX_QUESTIONS}
                          </Badge>
                        ) : null
                      }
                    >
                      Signup questions
                    </DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent variant="rows">
                    {activeQuestionCount === 0 && (
                      <p className="muted py-3">
                        No questions yet. Add optional questions participants
                        answer when signing up.
                      </p>
                    )}

                    {questions.length > 0 && (
                      <DataRowList>
                        {questions.map((question) =>
                          question.deleted ? (
                            <div
                              key={question.key}
                              className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-left opacity-70 last:border-0"
                            >
                              <p className="muted">
                                <span className="font-medium line-through">
                                  {question.label || "Untitled question"}
                                </span>{" "}
                                will be deleted on save.
                                {question.hasAnswers && (
                                  <span className="font-medium">
                                    {" "}
                                    Existing answers will be kept and shown in
                                    the roster.
                                  </span>
                                )}
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => undoDeleteQuestion(question.key)}
                              >
                                <Undo2 className="mr-1 h-4 w-4" /> Undo
                              </Button>
                            </div>
                          ) : (
                            <QuestionRowCard
                              key={question.key}
                              question={question}
                              error={questionErrors[question.key]}
                              disableTypeChange={question.hasAnswers}
                              onUpdate={(field, value) =>
                                updateQuestion(question.key, field, value)
                              }
                              onRemove={() => markQuestionDeleted(question.key)}
                              removeLabel="Remove question"
                              removeIcon={<Trash2 className="h-4 w-4" />}
                              disabled={isPast}
                            />
                          )
                        )}
                      </DataRowList>
                    )}

                    <GhostAddRow
                      onClick={addQuestion}
                      disabled={isPast || activeQuestionCount >= MAX_QUESTIONS}
                    >
                      Add question
                    </GhostAddRow>
                  </DataCardContent>
                </DataCard>
              </AdminPageCenter>
            </AdminPageBody>
          </TabsContent>
        </Tabs>
        <StickySaveBar
          onCancel={handleCancel}
          submitLabel="Save Changes"
          submittingLabel="Saving..."
          submitting={submitting}
          disabled={isPast}
        />
      </form>
    </AdminPageShell>
  )
}
