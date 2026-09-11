import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeInput } from "@/components/ui/time-input"
import { useOrg } from "@/hooks/useOrg"
import { useApi } from "@/hooks/useApi"

interface SlotRow {
  key: number
  label: string
  startTime: string
  endTime: string
  capacity: number
  allowWaitlist: boolean
}

export function CreateEvent() {
  const { org, error: orgError } = useOrg()
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [submitting, setSubmitting] = useState(false)
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
    setSlots((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        label: "",
        startTime: "08:00",
        endTime: "09:00",
        capacity: 1,
        allowWaitlist: true,
      },
    ])
  }

  const removeSlot = (key: number) => {
    setSlots((prev) => prev.filter((s) => s.key !== key))
  }

  const updateSlot = (
    key: number,
    field: keyof SlotRow,
    value: string | number | boolean
  ) => {
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return
    const today = new Date().toLocaleDateString("en-CA")
    if (date < today) {
      toast.error("Event date cannot be in the past")
      return
    }
    setSubmitting(true)

    try {
      await api.createEvent(org.id, {
        title,
        description: description || null,
        location: location.trim() || null,
        date,
        slots:
          slots.length > 0
            ? slots.map((s) => ({
              label: s.label,
              startTime: s.startTime,
              endTime: s.endTime,
              capacity: s.capacity,
              allowWaitlist: s.allowWaitlist,
            }))
            : null,
      })
      toast.success("Event created")
      await queryClient.invalidateQueries({ queryKey: ["roster"] })
      navigate("/dashboard")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create event"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Create Event</h1>
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
            min={new Date().toLocaleDateString("en-CA")}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-3">
          <Label>Time Slots</Label>

          {slots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No slots yet. Add time slots that volunteers can sign up for.
            </p>
          )}

          {slots.map((slot) => (
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
                    onChange={(val) => updateSlot(slot.key, "startTime", val)}
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
                    min={1}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSlot(slot.key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
            </div>
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
