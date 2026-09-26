import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SignupInfo } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function activeSignupCount(signups: SignupInfo[]): number {
  return signups.filter(
    (s) => s.status === "Pending" || s.status === "Confirmed"
  ).length
}

export function waitlistCount(signups: SignupInfo[]): number {
  return signups.filter((s) => s.status === "Waitlisted").length
}

/** Signups that would be emailed on removal (excludes Cancelled/Removed). */
export function notifiableSignupCount(signups: SignupInfo[]): number {
  return signups.filter((s) => isNotifiableStatus(s.status)).length
}

export function isNotifiableStatus(status: string): boolean {
  return (
    status === "Pending" ||
    status === "Confirmed" ||
    status === "Waitlisted" ||
    status === "WaitlistPending"
  )
}

const SIGNUP_STATUS_RANK: Record<string, number> = {
  Confirmed: 0,
  Pending: 1,
  Waitlisted: 2,
  WaitlistPending: 3,
  Cancelled: 4,
  Removed: 5,
}

export function compareSignupsByStatus(a: SignupInfo, b: SignupInfo): number {
  const rankA = SIGNUP_STATUS_RANK[a.status] ?? 99
  const rankB = SIGNUP_STATUS_RANK[b.status] ?? 99
  if (rankA !== rankB) return rankA - rankB
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Formats a backend TimeOnly string ("HH:MM:SS") as "HH:MM". */
export function formatTimeOnly(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

function toHHmm(value: string): string {
  // Admin roster slots arrive as ISO date-times; public slots and drafts
  // are TimeOnly strings. Normalize both to "HH:mm" for comparison.
  if (value.includes("T")) return toTimeInputValue(value)
  return value.slice(0, 5)
}

/**
 * True when the end wall-time is earlier than the start, meaning the slot
 * rolls over to the next day (e.g. 22:00-02:00).
 */
export function isOvernightSlot(startTime: string, endTime: string): boolean {
  return toHHmm(endTime) < toHHmm(startTime)
}

/** " (+1 day)" suffix for overnight slots, else "". */
export function overnightSuffix(startTime: string, endTime: string): string {
  return isOvernightSlot(startTime, endTime) ? " (+1 day)" : ""
}

export function toTimeInputValue(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
