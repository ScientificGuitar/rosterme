import type { RosterEvent } from "@/lib/types"
import { activeSignupCount, toTimeInputValue } from "@/lib/utils"
import { activeRows } from "@/lib/eventDrafts"

export interface SlotDraft {
  key: number
  label: string
  startTime: string
  endTime: string
  capacity: number
  allowWaitlist: boolean
}

export interface SlotRow extends SlotDraft {
  id?: string
  signupCount: number
  deleted: boolean
}

export function createEmptySlot(key: number): SlotDraft {
  return {
    key,
    label: "",
    startTime: "08:00",
    endTime: "09:00",
    capacity: 1,
    allowWaitlist: true,
  }
}

export function validateSlotBasics(slot: SlotDraft): string | null {
  if (!slot.label.trim()) return "Label is required."
  if (slot.endTime <= slot.startTime)
    return "End time must be after start time."
  if (slot.capacity < 1) return "Capacity must be at least 1."
  return null
}

export function validateSlotsBasics(
  slots: SlotDraft[]
): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const slot of slots) {
    const err = validateSlotBasics(slot)
    if (err) errors[slot.key] = err
  }
  return errors
}

export function validateSlotWithSignups(
  slot: SlotDraft & { signupCount: number }
): string | null {
  const basic = validateSlotBasics(slot)
  if (basic) return basic
  if (slot.capacity < slot.signupCount) {
    return `Capacity cannot be below the current signup count (${slot.signupCount}).`
  }
  return null
}

export function validateSlotRows(slots: SlotRow[]): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const slot of activeRows(slots)) {
    const err = validateSlotWithSignups(slot)
    if (err) errors[slot.key] = err
  }
  return errors
}

export function toSlotRows(event: RosterEvent, keyOffset = 0): SlotRow[] {
  return event.slots.map((slot, i) => ({
    key: keyOffset + i,
    id: slot.id,
    label: slot.label,
    startTime: toTimeInputValue(slot.startTime),
    endTime: toTimeInputValue(slot.endTime),
    capacity: slot.capacity,
    allowWaitlist: slot.allowWaitlist ?? true,
    signupCount: activeSignupCount(slot.signups),
    deleted: false,
  }))
}

/** Payload for POST /organizations/:id/events (CreateSlotRequest, no ids). */
export function buildSlotCreatePayload(slots: SlotDraft[]) {
  return slots.map((s) => ({
    label: s.label.trim(),
    startTime: s.startTime,
    endTime: s.endTime,
    capacity: s.capacity,
    allowWaitlist: s.allowWaitlist,
  }))
}

/** Payload for PUT /events/:id (EventSlotUpsert, ids preserved). */
export function buildSlotUpdatePayload(slots: (SlotDraft & { id?: string })[]) {
  return slots.map((s) => ({
    id: s.id ?? null,
    label: s.label.trim(),
    startTime: s.startTime,
    endTime: s.endTime,
    capacity: s.capacity,
    allowWaitlist: s.allowWaitlist,
  }))
}

export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA")
}
