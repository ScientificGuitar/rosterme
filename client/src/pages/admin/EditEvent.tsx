import { useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EventDetailsFields } from "@/components/admin/EventDetailsFields"
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { useEvent } from "@/hooks/useEvent"
import { useApi } from "@/hooks/useApi"
import { activeSignupCount, toTimeInputValue } from "@/lib/utils"
import {
  createEmptySlot,
  formatApiError,
  todayLocal,
  validateSlotBasics,
  type SlotDraft,
} from "@/lib/eventSlots"
import type { RosterEvent } from "@/lib/types"

interface SlotRow extends SlotDraft {
  id?: string
  signupCount: number
  deleted: boolean
}

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

  const nextKey = useRef(event.slots.length)
  const [slots, setSlots] = useState<SlotRow[]>(() =>
    event.slots.map((slot, i) => ({
      key: i,
      id: slot.id,
      label: slot.label,
      startTime: toTimeInputValue(slot.startTime),
      endTime: toTimeInputValue(slot.endTime),
      capacity: slot.capacity,
      allowWaitlist: slot.allowWaitlist ?? true,
      signupCount: activeSignupCount(slot.signups),
      deleted: false,
    }))
  )

  const invalidateEvent = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
      queryClient.invalidateQueries({ queryKey: ["roster"] }),
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
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s))
    )
    setSlotErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const markSlotDeleted = (key: number) => {
    setSlots((prev) =>
      prev
        .map((s) => (s.key === key ? { ...s, deleted: true } : s))
        // Rows that were never persisted can be dropped outright.
        .filter((s) => !(s.key === key && !s.id))
    )
  }

  const undoDeleteSlot = (key: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, deleted: false } : s))
    )
  }

  const validateSlots = (): boolean => {
    const errors: Record<number, string> = {}
    for (const slot of slots) {
      if (slot.deleted) continue
      const basic = validateSlotBasics(slot)
      if (basic) {
        errors[slot.key] = basic
      } else if (slot.capacity < slot.signupCount) {
        errors[slot.key] =
          `Capacity cannot be below the current signup count (${slot.signupCount}).`
      }
    }
    setSlotErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error("Fix the highlighted time slots before saving.")
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
        slots: slots
          .filter((s) => !s.deleted)
          .map((s) => ({
            id: s.id ?? null,
            label: s.label.trim(),
            startTime: s.startTime,
            endTime: s.endTime,
            capacity: s.capacity,
            allowWaitlist: s.allowWaitlist,
          })),
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
  const isPast = event.date < todayLocal()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Edit Event</h1>
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

          {slots.filter((s) => !s.deleted).length === 0 && (
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
    </div>
  )
}
