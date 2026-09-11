import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { EventDetailsFields } from "@/components/admin/EventDetailsFields"
import { SlotRowCard } from "@/components/admin/SlotRowCard"
import { useOrg } from "@/hooks/useOrg"
import { useApi } from "@/hooks/useApi"
import {
  createEmptySlot,
  formatApiError,
  todayLocal,
  validateSlotsBasics,
  type SlotDraft,
} from "@/lib/eventSlots"

export function CreateEvent() {
  const { org, error: orgError } = useOrg()
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<SlotDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({})
  const nextKey = useRef(0)

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

  if (!org) return null

  const addSlot = () => {
    setSlots((prev) => [...prev, createEmptySlot(nextKey.current++)])
  }

  const removeSlot = (key: number) => {
    setSlots((prev) => prev.filter((s) => s.key !== key))
    setSlotErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const updateSlot = (
    key: number,
    field: keyof Omit<SlotDraft, "key">,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return
    if (date < todayLocal()) {
      toast.error("Event date cannot be in the past")
      return
    }
    const errors = validateSlotsBasics(slots)
    setSlotErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error("Fix the highlighted time slots before saving.")
      return
    }
    setSubmitting(true)

    try {
      const { id } = await api.createEvent(org.id, {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        date,
        slots:
          slots.length > 0
            ? slots.map((s) => ({
              label: s.label.trim(),
              startTime: s.startTime,
              endTime: s.endTime,
              capacity: s.capacity,
              allowWaitlist: s.allowWaitlist,
            }))
            : null,
      })
      toast.success("Event created")
      await queryClient.invalidateQueries({ queryKey: ["roster"] })
      navigate(`/events/${id}`)
    } catch (e) {
      toast.error(formatApiError(e, "Failed to create event"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Create Event</h1>
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
    </div>
  )
}
