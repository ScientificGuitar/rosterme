import { useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EventDetailsFields } from "@/components/admin/EventDetailsFields"
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { QuestionRowCard } from "@/components/admin/QuestionRowCard"
import { useEvent } from "@/hooks/useEvent"
import { useApi } from "@/hooks/useApi"
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
    return (
      <div className="py-12 text-center text-muted-foreground">Loading...</div>
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

  return <EventForm event={event} eventId={id!} />
}

interface EventFormProps {
  event: RosterEvent
  eventId: string
}

function EventForm({ event, eventId }: EventFormProps) {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState(event.title)
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

  const invalidateEvent = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
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

  const validateSlots = (): boolean => {
    const errors = validateSlotRows(slots)
    setSlotErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error("Fix the highlighted time slots before saving.")
      return false
    }
    const questionErrs = validateQuestionRows(questions)
    setQuestionErrors(questionErrs)
    if (Object.keys(questionErrs).length > 0) {
      toast.error("Fix the highlighted signup questions before saving.")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (date < todayLocal()) {
      toast.error("Event date cannot be in the past")
      return
    }
    if (!validateSlots()) return
    setSubmitting(true)

    try {
      await api.updateEvent(eventId, {
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
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader>
        <h1 className="text-2xl font-bold">Edit Event</h1>
      </CardHeader>
      <Separator />
      <CardContent>
        {isPast && (
          <p className="mb-6 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            This event has already taken place and can no longer be edited.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="space-y-3">
            <Label>Time Slots</Label>

            {activeSlotCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No time slots yet. Add time slots that volunteers can sign up for.
              </p>
            )}

            {slots.map((slot) =>
              slot.deleted ? (
                <div
                  key={slot.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-dashed p-3 opacity-70"
                >
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium line-through">
                      {slot.label || "Untitled slot"}
                    </span>{" "}
                    will be deleted on save.
                    {slot.signupCount > 0 && (
                      <span className="font-medium text-destructive">
                        {" "}
                        {slot.signupCount} signup(s) will be removed.
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
                  capacityMin={slot.signupCount > 0 ? slot.signupCount : 1}
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
                  onUpdate={(field, value) => updateSlot(slot.key, field, value)}
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

            {deletedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {deletedCount} slot(s) marked for deletion — they will be removed
                when you save.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSlot}
              disabled={isPast}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Slot
            </Button>
          </div>

          <div className="space-y-3">
            <Label>Signup Questions</Label>

            {activeQuestionCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No questions yet. Add optional questions volunteers answer when
                signing up.
              </p>
            )}

            {questions.map((question) =>
              question.deleted ? (
                <div
                  key={question.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-dashed p-3 opacity-70"
                >
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium line-through">
                      {question.label || "Untitled question"}
                    </span>{" "}
                    will be deleted on save.
                    {question.hasAnswers && (
                      <span className="font-medium">
                        {" "}
                        Existing answers will be kept and shown in the roster.
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

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQuestion}
              disabled={isPast || activeQuestionCount >= MAX_QUESTIONS}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Question
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || isPast}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/events/${eventId}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
