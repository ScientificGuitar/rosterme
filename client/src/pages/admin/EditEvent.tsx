import { useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { TimeInput } from "@/components/ui/time-input"
import { useEvent } from "@/hooks/useEvent"
import { useApi } from "@/hooks/useApi"
import { ApiError } from "@/lib/api"
import { activeSignupCount, toTimeInputValue } from "@/lib/utils"
import type { RosterEvent } from "@/lib/types"

interface SlotRow {
  key: number
  id?: string
  label: string
  startTime: string
  endTime: string
  capacity: number
  allowWaitlist: boolean
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
    setSlots((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        label: "",
        startTime: "08:00",
        endTime: "09:00",
        capacity: 1,
        allowWaitlist: true,
        signupCount: 0,
        deleted: false,
      },
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
      if (!slot.label.trim()) {
        errors[slot.key] = "Label is required."
      } else if (slot.endTime <= slot.startTime) {
        errors[slot.key] = "End time must be after start time."
      } else if (slot.capacity < 1) {
        errors[slot.key] = "Capacity must be at least 1."
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
    if (!validateSlots()) return
    setSubmitting(true)

    try {
      await api.updateEvent(eventId, {
        title,
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
      if (e instanceof ApiError && e.fields) {
        const messages = Object.entries(e.fields).flatMap(([field, msgs]) =>
          msgs.map((m) => `${field}: ${m}`)
        )
        toast.error(messages.join("\n") || e.message)
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to update event")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const deletedCount = slots.filter((s) => s.deleted).length

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Edit Event</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Event Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Sunday Service"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Weekly Sunday service"
            maxLength={2000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="123 Main St, Springfield"
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

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
              <div
                key={slot.key}
                className="space-y-2 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={slot.label}
                      onChange={(e) =>
                        updateSlot(slot.key, "label", e.target.value)
                      }
                      placeholder="Morning"
                      required
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <TimeInput
                      value={slot.startTime}
                      onChange={(val) =>
                        updateSlot(slot.key, "startTime", val)
                      }
                      size="sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <TimeInput
                      value={slot.endTime}
                      onChange={(val) => updateSlot(slot.key, "endTime", val)}
                      size="sm"
                    />
                  </div>
                  <div className="w-16 space-y-1">
                    <Label className="text-xs">Cap</Label>
                    <Input
                      type="number"
                      min={slot.signupCount > 0 ? slot.signupCount : 1}
                      value={slot.capacity}
                      onChange={(e) =>
                        updateSlot(
                          slot.key,
                          "capacity",
                          parseInt(e.target.value) || 1
                        )
                      }
                      required
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {slot.id && (
                      <Badge
                        variant={
                          slot.signupCount >= slot.capacity
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {slot.signupCount}/{slot.capacity}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => markSlotDeleted(slot.key)}
                      title={
                        slot.signupCount > 0
                          ? `Mark for deletion (${slot.signupCount} signup(s) will be removed on save)`
                          : "Remove slot"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {slotErrors[slot.key] && (
                  <p className="text-sm text-destructive">
                    {slotErrors[slot.key]}
                  </p>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={slot.allowWaitlist}
                    onChange={(e) =>
                      updateSlot(slot.key, "allowWaitlist", e.target.checked)
                    }
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  Allow waitlist when full
                </label>
                {slot.id && slot.signupCount > 0 && !slotErrors[slot.key] && (
                  <p className="text-xs text-muted-foreground">
                    {slot.signupCount} active signup(s) on this slot.
                  </p>
                )}
              </div>
            )
          )}

          {deletedCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {deletedCount} slot(s) marked for deletion — they will be removed
              when you save.
            </p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={addSlot}>
            <Plus className="mr-1 h-4 w-4" /> Add Slot
          </Button>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
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
