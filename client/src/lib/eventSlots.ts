import { ApiError } from "@/lib/api"

/** Shared shape for a slot row in Create/Edit forms. Edit extends this. */
export interface SlotDraft {
  key: number
  label: string
  startTime: string
  endTime: string
  capacity: number
  allowWaitlist: boolean
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

/** Stateless checks shared by Create and Edit. Edit adds signup-aware rules on top. */
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

/** Flatten ApiError fields the same way everywhere (backend RFC 9457). */
export function formatApiError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.fields) {
    const messages = Object.entries(e.fields).flatMap(([field, msgs]) =>
      msgs.map((m) => `${field}: ${m}`)
    )
    if (messages.length > 0) return messages.join("\n")
    return e.message || fallback
  }
  return e instanceof Error ? e.message : fallback
}

export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA")
}
