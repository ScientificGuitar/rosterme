import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Clock, Info, ListChecks, X } from "lucide-react"
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
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { StickySaveBar } from "@/components/admin/StickySaveBar"
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
                    onClick={() => navigate("/dashboard")}
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
          onCancel={() => navigate("/dashboard")}
          submitLabel="Create Event"
          submittingLabel="Creating..."
          submitting={submitting}
        />
      </form>
    </AdminPageShell>
  )
}
