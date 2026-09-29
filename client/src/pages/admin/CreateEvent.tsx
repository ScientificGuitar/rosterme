import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Clock, Info, ListChecks, Settings, X } from "lucide-react"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
import { RemovalEmailSetting } from "@/components/admin/RemovalEmailSetting"
import type { RemovalEmailPolicy } from "@/lib/removalEmailPolicy"
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { StickySaveBar } from "@/components/admin/StickySaveBar"
import { QuestionRowCard } from "@/components/admin/QuestionRowCard"
import { RecurrenceSection } from "@/components/admin/RecurrenceSection"
import { useApi } from "@/hooks/useApi"
import {
  useUnsavedChangesPrompt,
  confirmNavigation,
} from "@/hooks/useUnsavedChanges"
import { formatApiError } from "@/lib/api"
import {
  createEmptySlot,
  todayLocal,
  validateSlotsBasics,
  buildSlotCreatePayload,
  type SlotDraft,
} from "@/lib/eventSlots"
import {
  clearDraftError,
  removeDraftRow,
  reorderDraftRow,
  updateDraftRow,
} from "@/lib/eventDrafts"
import {
  createEmptyQuestion,
  MAX_QUESTIONS,
  validateQuestionDrafts,
  buildQuestionPayload,
  type QuestionDraft,
} from "@/lib/eventQuestions"
import {
  buildRecurrencePayload,
  createEmptyRecurrence,
  formatDateSpan,
  planOccurrences,
  validateRecurrence,
  type RecurrenceDraft,
} from "@/lib/recurrence"

type Tab = "overview" | "slots" | "settings"

export function CreateEvent() {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>("overview")
  const [groupId, setGroupId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<SlotDraft[]>([])
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [recurrence, setRecurrence] = useState<RecurrenceDraft>(() =>
    createEmptyRecurrence("")
  )
  const [removalEmailPolicy, setRemovalEmailPolicy] =
    useState<RemovalEmailPolicy>("Ask")
  const [submitting, setSubmitting] = useState(false)
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({})
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {}
  )
  const nextKey = useRef(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleSlotDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setSlots((prev) =>
      reorderDraftRow(prev, Number(active.id), Number(over.id))
    )
  }

  const handleQuestionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setQuestions((prev) =>
      reorderDraftRow(prev, Number(active.id), Number(over.id))
    )
  }

  const isDirty =
    groupId !== "" ||
    title.trim() !== "" ||
    description.trim() !== "" ||
    location.trim() !== "" ||
    date !== "" ||
    removalEmailPolicy !== "Ask" ||
    slots.length > 0 ||
    questions.length > 0 ||
    recurrence.enabled
  useUnsavedChangesPrompt(isDirty)

  const handleCancel = () => {
    if (confirmNavigation()) navigate("/dashboard")
  }

  const addSlot = () => {
    setSlots((prev) => [...prev, createEmptySlot(nextKey.current++)])
  }

  const removeSlot = (key: number) => {
    setSlots((prev) => removeDraftRow(prev, key))
    setSlotErrors((prev) => clearDraftError(prev, key))
  }

  const updateSlot = (
    key: number,
    field: keyof Omit<SlotDraft, "key">,
    value: string | number | boolean
  ) => {
    setSlots((prev) =>
      updateDraftRow(prev, key, { [field]: value } as Partial<SlotDraft>)
    )
    setSlotErrors((prev) => clearDraftError(prev, key))
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion(nextKey.current++)])
  }

  const removeQuestion = (key: number) => {
    setQuestions((prev) => removeDraftRow(prev, key))
    setQuestionErrors((prev) => clearDraftError(prev, key))
  }

  const updateQuestion = (
    key: number,
    field: keyof Omit<QuestionDraft, "key">,
    value: string | boolean
  ) => {
    setQuestions((prev) =>
      updateDraftRow(prev, key, { [field]: value } as Partial<QuestionDraft>)
    )
    setQuestionErrors((prev) => clearDraftError(prev, key))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Event title is required")
      setTab("overview")
      return
    }
    if (!groupId) {
      toast.error("Select a group for this event")
      setTab("overview")
      return
    }
    if (date < todayLocal()) {
      toast.error("Event date cannot be in the past")
      setTab("overview")
      return
    }
    const errors = validateSlotsBasics(slots)
    setSlotErrors(errors)
    const questionErrs = validateQuestionDrafts(questions)
    setQuestionErrors(questionErrs)
    const recurrenceErr = validateRecurrence(date, recurrence)
    if (recurrenceErr) {
      toast.error(recurrenceErr)
      setTab("overview")
      return
    }
    if (Object.keys(errors).length > 0) {
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
      if (recurrence.enabled) {
        const payload = buildRecurrencePayload(recurrence)
        if (!payload) {
          toast.error("Fix the repeat settings before saving.")
          setTab("overview")
          return
        }
        const created = await api.createRecurringEvents({
          groupId,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          date,
          removalEmailPolicy,
          recurrence: payload,
          slots: slots.length > 0 ? buildSlotCreatePayload(slots) : null,
          questions:
            questions.length > 0 ? buildQuestionPayload(questions) : null,
        })
        const plan = planOccurrences(date, recurrence)
        const span = formatDateSpan(created.map((e) => e.date))
        if (
          plan &&
          (plan.truncated ||
            created.length < (plan.requestedTotal ?? created.length))
        ) {
          const want =
            plan.requestedTotal !== null
              ? ` of ${plan.requestedTotal} requested`
              : ""
          toast.warning(
            `Created ${created.length}${want} (${span}) — repeats are limited to 60 occurrences within 12 months.`
          )
        } else {
          toast.success(
            `${created.length} event${created.length === 1 ? "" : "s"} created (${span})`
          )
        }
        await queryClient.invalidateQueries({ queryKey: ["events"] })
        await queryClient.invalidateQueries({ queryKey: ["groups"] })
        navigate("/dashboard")
        return
      }
      const { id } = await api.createEvent({
        groupId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        date,
        removalEmailPolicy,
        slots: slots.length > 0 ? buildSlotCreatePayload(slots) : null,
        questions:
          questions.length > 0 ? buildQuestionPayload(questions) : null,
      })
      toast.success("Event created")
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      await queryClient.invalidateQueries({ queryKey: ["groups"] })
      navigate(`/events/${id}`)
    } catch (e) {
      toast.error(formatApiError(e, "Failed to create event"))
    } finally {
      setSubmitting(false)
    }
  }

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
                  <AdminHeaderTitle>Create Event</AdminHeaderTitle>
                  <AdminHeaderSubtitle>
                    Set up the details, time slots and signup questions.
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
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Event"}
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
          <TabsContent value="overview">
            <AdminPageBody>
              <AdminPageCenter>
                <DataCard>
                  <DataCardHeader>
                    <DataCardTitle icon={Info}>Event details</DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent className="space-y-4">
                    <GroupSelect value={groupId} onChange={setGroupId} />
                    <EventDetailsFields
                      title={title}
                      description={description}
                      location={location}
                      date={date}
                      onTitleChange={setTitle}
                      onDescriptionChange={setDescription}
                      onLocationChange={setLocation}
                      onDateChange={setDate}
                      dateMin={todayLocal()}
                    />
                    <RecurrenceSection
                      startDate={date}
                      draft={recurrence}
                      onChange={setRecurrence}
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
                        slots.length > 0 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {slots.length}{" "}
                            {slots.length === 1 ? "slot" : "slots"}
                          </Badge>
                        ) : null
                      }
                    >
                      Time slots
                    </DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent variant="rows">
                    {slots.length === 0 ? (
                      <p className="muted py-3">
                        No slots yet. Add time slots that people can sign up
                        for.
                      </p>
                    ) : (
                      <DataRowList>
                        <DndContext
                          sensors={sensors}
                          onDragEnd={handleSlotDragEnd}
                        >
                          <SortableContext
                            items={slots.map((s) => s.key)}
                            strategy={verticalListSortingStrategy}
                          >
                            {slots.map((slot) => (
                              <SlotRowCard
                                key={slot.key}
                                slot={slot}
                                error={slotErrors[slot.key]}
                                onUpdate={(field, value) =>
                                  updateSlot(slot.key, field, value)
                                }
                                onRemove={() => removeSlot(slot.key)}
                                removeLabel="Remove slot"
                                removeIcon={<X className="h-4 w-4" />}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </DataRowList>
                    )}
                    <GhostAddRow onClick={addSlot}>Add slot</GhostAddRow>
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
                    <DataCardTitle icon={Settings}>General</DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent className="space-y-4">
                    <RemovalEmailSetting
                      value={removalEmailPolicy}
                      onChange={setRemovalEmailPolicy}
                    />
                  </DataCardContent>
                </DataCard>
                <DataCard>
                  <DataCardHeader>
                    <DataCardTitle
                      icon={ListChecks}
                      actions={
                        questions.length > 0 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {questions.length}/{MAX_QUESTIONS}
                          </Badge>
                        ) : null
                      }
                    >
                      Signup questions
                    </DataCardTitle>
                  </DataCardHeader>
                  <DataCardDivider />
                  <DataCardContent variant="rows">
                    {questions.length === 0 ? (
                      <p className="muted py-3">
                        No questions yet. Add optional questions participants
                        answer when signing up.
                      </p>
                    ) : (
                      <DataRowList>
                        <DndContext
                          sensors={sensors}
                          onDragEnd={handleQuestionDragEnd}
                        >
                          <SortableContext
                            items={questions.map((q) => q.key)}
                            strategy={verticalListSortingStrategy}
                          >
                            {questions.map((question) => (
                              <QuestionRowCard
                                key={question.key}
                                question={question}
                                error={questionErrors[question.key]}
                                onUpdate={(field, value) =>
                                  updateQuestion(question.key, field, value)
                                }
                                onRemove={() => removeQuestion(question.key)}
                                removeLabel="Remove question"
                                removeIcon={<X className="h-4 w-4" />}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </DataRowList>
                    )}
                    <GhostAddRow
                      onClick={addQuestion}
                      disabled={questions.length >= MAX_QUESTIONS}
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
          submitLabel="Create Event"
          submittingLabel="Creating..."
          submitting={submitting}
        />
      </form>
    </AdminPageShell>
  )
}
