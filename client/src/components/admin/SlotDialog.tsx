import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeInput } from "@/components/ui/time-input"
import { RequiredStar } from "@/components/ui/layout"
import { useApi } from "@/hooks/useApi"
import { formatApiError } from "@/lib/api"
import { buildSlotCreatePayload, validateSlotBasics } from "@/lib/eventSlots"
import { toTimeInputValue } from "@/lib/utils"

export interface SlotDialogSlot {
  id: string
  label: string
  /** ISO date-time; converted for the time inputs. */
  startTime: string
  endTime: string
  capacity: number
  allowWaitlist: boolean
  signupCount: number
}

interface SlotDialogProps {
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omitted for create mode; present for edit mode. */
  slot?: SlotDialogSlot
  onSaved?: (slotId: string) => void
}

export function SlotDialog({
  eventId,
  open,
  onOpenChange,
  slot,
  onSaved,
}: SlotDialogProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const isEdit = !!slot
  const capacityMin = slot ? Math.max(1, slot.signupCount) : 1
  const [label, setLabel] = useState(slot?.label ?? "")
  const [startTime, setStartTime] = useState(
    slot ? toTimeInputValue(slot.startTime) : "08:00"
  )
  const [endTime, setEndTime] = useState(
    slot ? toTimeInputValue(slot.endTime) : "09:00"
  )
  const [capacity, setCapacity] = useState(slot?.capacity ?? 1)
  const [allowWaitlist, setAllowWaitlist] = useState(
    slot?.allowWaitlist ?? true
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setLabel(slot?.label ?? "")
    setStartTime(slot ? toTimeInputValue(slot.startTime) : "08:00")
    setEndTime(slot ? toTimeInputValue(slot.endTime) : "09:00")
    setCapacity(slot?.capacity ?? 1)
    setAllowWaitlist(slot?.allowWaitlist ?? true)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateSlotBasics({
      key: 0,
      label,
      startTime,
      endTime,
      capacity,
      allowWaitlist,
    })
    if (validationError) {
      setError(validationError)
      return
    }
    if (slot && capacity < slot.signupCount) {
      setError(
        `Capacity cannot be less than the current signup count (${slot.signupCount}).`
      )
      return
    }
    setSaving(true)
    try {
      let savedId: string
      if (slot) {
        await api.updateSlot(eventId, slot.id, {
          label: label.trim(),
          startTime,
          endTime,
          capacity,
          allowWaitlist,
        })
        toast.success("Time slot updated")
        savedId = slot.id
      } else {
        const [payload] = buildSlotCreatePayload([
          {
            key: 0,
            label,
            startTime,
            endTime,
            capacity,
            allowWaitlist,
          },
        ])
        const created = await api.createSlot(eventId, payload)
        toast.success("Time slot added")
        savedId = created.id
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ])
      handleOpenChange(false)
      onSaved?.(savedId)
    } catch (err) {
      setError(
        formatApiError(
          err,
          isEdit ? "Failed to update time slot" : "Failed to add time slot"
        )
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit time slot" : "New time slot"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the time slot details."
              : "Add a time slot people can sign up for."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="stack-md">
          <div className="field-stack">
            <Label htmlFor="slot-label">
              <span>
                Label
                <RequiredStar />
              </span>
            </Label>
            <Input
              id="slot-label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                setError(null)
              }}
              required
              maxLength={200}
              placeholder="Morning"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="field-stack flex-1">
              <Label>
                <span>
                  Start
                  <RequiredStar />
                </span>
              </Label>
              <TimeInput
                value={startTime}
                onChange={(val) => {
                  setStartTime(val)
                  setError(null)
                }}
                size="sm"
              />
            </div>
            <div className="field-stack flex-1">
              <Label>
                <span>
                  End
                  <RequiredStar />
                </span>
              </Label>
              <TimeInput
                value={endTime}
                onChange={(val) => {
                  setEndTime(val)
                  setError(null)
                }}
                size="sm"
              />
            </div>
            <div className="field-stack w-24">
              <Label>
                <span>
                  Capacity
                  <RequiredStar />
                </span>
              </Label>
              <Input
                type="number"
                min={capacityMin}
                value={capacity}
                onChange={(e) => {
                  setCapacity(parseInt(e.target.value) || 1)
                  setError(null)
                }}
                required
              />
            </div>
          </div>
          {slot && slot.signupCount > 0 && (
            <p className="muted-xs">
              {slot.signupCount} active signup(s) on this slot.
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allowWaitlist}
              onChange={(e) => setAllowWaitlist(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Allow waitlist when full
          </label>
          {error && <p className="field-error">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !label.trim()}>
              {saving
                ? isEdit
                  ? "Saving..."
                  : "Adding..."
                : isEdit
                  ? "Save changes"
                  : "Add slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
