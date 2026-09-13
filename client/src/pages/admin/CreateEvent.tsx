import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { EventDetailsFields } from "@/components/admin/EventDetailsFields"
import { GroupSelect } from "@/components/admin/GroupSelect"
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { QuestionRowCard } from "@/components/admin/QuestionRowCard"
import { useApi } from "@/hooks/useApi"
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
  updateDraftRow,
} from "@/lib/eventDrafts"
import {
  createEmptyQuestion,
  MAX_QUESTIONS,
  validateQuestionDrafts,
  buildQuestionPayload,
  type QuestionDraft,
} from "@/lib/eventQuestions"

export function CreateEvent() {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [groupId, setGroupId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<SlotDraft[]>([])
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({})
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {}
  )
  const nextKey = useRef(0)

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
    if (!groupId) {
      toast.error("Select a group for this event")
      return
    }
    if (date < todayLocal()) {
      toast.error("Event date cannot be in the past")
      return
    }
    const errors = validateSlotsBasics(slots)
    setSlotErrors(errors)
    const questionErrs = validateQuestionDrafts(questions)
    setQuestionErrors(questionErrs)
    if (Object.keys(errors).length > 0) {
      toast.error("Fix the highlighted time slots before saving.")
      return
    }
    if (Object.keys(questionErrs).length > 0) {
      toast.error("Fix the highlighted signup questions before saving.")
      return
    }
    setSubmitting(true)

    try {
      const { id } = await api.createEvent({
        groupId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        date,
        slots: slots.length > 0 ? buildSlotCreatePayload(slots) : null,
        questions:
          questions.length > 0 ? buildQuestionPayload(questions) : null,
      })
      toast.success("Event created")
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      navigate(`/events/${id}`)
    } catch (e) {
      toast.error(formatApiError(e, "Failed to create event"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader>
        <h1 className="text-2xl font-bold">Create Event</h1>
      </CardHeader>
      <Separator />
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="space-y-3">
            <Label>Time Slots</Label>

            {slots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No slots yet. Add time slots that volunteers can sign up for.
              </p>
            )}

            {slots.map((slot) => (
              <SlotRowCard
                key={slot.key}
                slot={slot}
                error={slotErrors[slot.key]}
                onUpdate={(field, value) => updateSlot(slot.key, field, value)}
                onRemove={() => removeSlot(slot.key)}
                removeLabel="Remove slot"
                removeIcon={<X className="h-4 w-4" />}
              />
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addSlot}>
              <Plus className="mr-1 h-4 w-4" /> Add Slot
            </Button>
          </div>

          <div className="space-y-3">
            <Label>Signup Questions</Label>

            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No questions yet. Add optional questions volunteers answer when
                signing up.
              </p>
            )}

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

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQuestion}
              disabled={questions.length >= MAX_QUESTIONS}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Question
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Event"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
