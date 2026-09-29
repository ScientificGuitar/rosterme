export type RecurrenceFrequency = "Daily" | "Weekly" | "Monthly"

export type EndMode = "count" | "until"

export interface RecurrenceDraft {
  enabled: boolean
  frequency: RecurrenceFrequency
  interval: number
  /** JS weekdays: 0 = Sunday … 6 = Saturday (weekly only). */
  daysOfWeek: number[]
  endMode: EndMode
  count: number
  untilDate: string
}

export const MAX_OCCURRENCES = 60
export const MAX_HORIZON_MONTHS = 12

/** Shown in full; longer series show the first few, an ellipsis, then these. */
export const PREVIEW_HEAD = 5
export const PREVIEW_TAIL = 2

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"]

export function createEmptyRecurrence(startDate: string): RecurrenceDraft {
  const start = parseDate(startDate)
  return {
    enabled: false,
    frequency: "Weekly",
    interval: 1,
    daysOfWeek: start ? [start.getDay()] : [],
    endMode: "count",
    count: 4,
    untilDate: "",
  }
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function mondayOf(d: Date): Date {
  const copy = new Date(d)
  copy.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** Mirrors .NET DateOnly.AddMonths (clamps to the last day of short months). */
function addMonths(d: Date, months: number): Date {
  const day = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + months, 1)
  r.setDate(
    Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())
  )
  return r
}

type StopReason = "count" | "until" | "max" | "horizon"

interface Expansion {
  dates: string[]
  stop: StopReason
}

/**
 * Client-side mirror of the server expander (same 60-occurrence / 12-month
 * caps), so the preview shows exactly what will be created.
 */
function expandCore(
  start: Date,
  draft: RecurrenceDraft,
  maxCollect: number
): Expansion {
  const interval = Math.max(1, Math.floor(draft.interval) || 1)
  const horizon = addMonths(start, MAX_HORIZON_MONTHS)
  const dates: string[] = []
  const wantCount =
    draft.endMode === "count" ? Math.max(0, Math.floor(draft.count) || 0) : null
  const until = draft.endMode === "until" ? parseDate(draft.untilDate) : null

  if (draft.frequency === "Daily") {
    let d = new Date(start)
    for (let guard = 0; guard < 200000; guard++) {
      if (until && d > until) return { dates, stop: "until" }
      if (d > horizon)
        return {
          dates,
          stop:
            wantCount !== null && dates.length >= wantCount
              ? "count"
              : "horizon",
        }
      dates.push(toKey(d))
      if (wantCount !== null && dates.length >= wantCount)
        return { dates, stop: "count" }
      if (dates.length >= maxCollect) return { dates, stop: "max" }
      d = new Date(d)
      d.setDate(d.getDate() + interval)
    }
    return { dates, stop: "max" }
  }

  if (draft.frequency === "Weekly") {
    const wanted = new Set(draft.daysOfWeek)
    if (wanted.size === 0) return { dates, stop: "count" }
    const startMonday = mondayOf(start)
    let d = new Date(start)
    for (let guard = 0; guard < 200000; guard++) {
      if (until && d > until) return { dates, stop: "until" }
      if (d > horizon)
        return {
          dates,
          stop:
            wantCount !== null && dates.length >= wantCount
              ? "count"
              : "horizon",
        }
      const weekOffset = Math.round(
        (mondayOf(d).getTime() - startMonday.getTime()) / (7 * 86400000)
      )
      if (d >= start && wanted.has(d.getDay()) && weekOffset % interval === 0) {
        dates.push(toKey(d))
        if (wantCount !== null && dates.length >= wantCount)
          return { dates, stop: "count" }
        if (dates.length >= maxCollect) return { dates, stop: "max" }
      }
      d = new Date(d)
      d.setDate(d.getDate() + 1)
    }
    return { dates, stop: "max" }
  }

  // Monthly: same day-of-month, clamped to the last day of short months.
  for (let i = 0; i < 200000; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i * interval, 1)
    d.setDate(
      Math.min(
        start.getDate(),
        new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      )
    )
    if (until && d > until) return { dates, stop: "until" }
    if (d > horizon)
      return {
        dates,
        stop:
          wantCount !== null && dates.length >= wantCount ? "count" : "horizon",
      }
    dates.push(toKey(d))
    if (wantCount !== null && dates.length >= wantCount)
      return { dates, stop: "count" }
    if (dates.length >= maxCollect) return { dates, stop: "max" }
  }
  return { dates, stop: "max" }
}

export interface RecurrencePlan {
  /** What the server will actually create (limits applied). */
  dates: string[]
  /** What the rule asked for, or null when it runs past the limits. */
  requestedTotal: number | null
  /** True when limits cut the series short. */
  truncated: boolean
}

export function planOccurrences(
  startDate: string,
  draft: RecurrenceDraft
): RecurrencePlan | null {
  const start = parseDate(startDate)
  if (!start) return null
  // One sentinel past the cap tells "more wanted" apart from "exactly 60".
  const { dates, stop } = expandCore(start, draft, MAX_OCCURRENCES + 1)
  const created = dates.slice(0, MAX_OCCURRENCES)
  const requestedTotal =
    draft.endMode === "count"
      ? Math.max(0, Math.floor(draft.count) || 0)
      : stop === "until"
        ? dates.length
        : null
  return {
    dates: created,
    requestedTotal,
    truncated:
      stop === "max" ||
      stop === "horizon" ||
      (requestedTotal !== null && created.length < requestedTotal),
  }
}

/** First few + last few preview rows; `ellipsis: true` when rows were cut. */
export function previewRows(dates: string[]): {
  rows: string[]
  ellipsis: boolean
} {
  if (dates.length <= PREVIEW_HEAD + PREVIEW_TAIL + 1)
    return { rows: dates, ellipsis: false }
  return {
    rows: [
      ...dates.slice(0, PREVIEW_HEAD),
      ...dates.slice(dates.length - PREVIEW_TAIL),
    ],
    ellipsis: true,
  }
}

export function formatPreviewDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function formatDateSpan(dates: string[]): string {
  if (dates.length === 0) return ""
  const first = new Date(`${dates[0]}T00:00:00`)
  const last = new Date(`${dates[dates.length - 1]}T00:00:00`)
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  }
  if (first.getFullYear() !== last.getFullYear())
    return `${first.toLocaleDateString(undefined, { ...opts, year: "numeric" })} – ${last.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`
  const sameYear: Intl.DateTimeFormatOptions =
    first.getFullYear() === new Date().getFullYear()
      ? opts
      : { ...opts, year: "numeric" }
  if (dates.length === 1) return first.toLocaleDateString(undefined, sameYear)
  return `${first.toLocaleDateString(undefined, sameYear)} – ${last.toLocaleDateString(undefined, sameYear)}`
}

export function validateRecurrence(
  startDate: string,
  draft: RecurrenceDraft
): string | null {
  if (!draft.enabled) return null
  if (!parseDate(startDate)) return "Pick an event date first."
  if (!(draft.interval >= 1 && draft.interval <= 12))
    return "Repeat interval must be between 1 and 12."
  if (draft.frequency === "Weekly") {
    if (draft.daysOfWeek.length === 0)
      return "Select at least one weekday to repeat on."
    const start = parseDate(startDate)!
    if (!draft.daysOfWeek.includes(start.getDay()))
      return "The event date's weekday must be one of the repeat days."
  }
  if (draft.endMode === "count") {
    if (!(draft.count >= 2 && draft.count <= MAX_OCCURRENCES))
      return `Number of occurrences must be between 2 and ${MAX_OCCURRENCES}.`
  } else {
    const until = parseDate(draft.untilDate)
    const start = parseDate(startDate)!
    if (!until) return "Pick an end date for the repetition."
    if (until < start) return "Repeat end date cannot be before the event date."
  }
  return null
}

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  daysOfWeek: string[] | null
  count: number | null
  untilDate: string | null
}

export function buildRecurrencePayload(
  draft: RecurrenceDraft
): RecurrencePayload | null {
  if (!draft.enabled) return null
  const base = {
    frequency: draft.frequency,
    interval: Math.max(1, Math.floor(draft.interval) || 1),
  }
  const end =
    draft.endMode === "count"
      ? { count: draft.count, untilDate: null as string | null }
      : { count: null as number | null, untilDate: draft.untilDate }
  if (draft.frequency === "Weekly") {
    const days = [...new Set(draft.daysOfWeek)]
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d])
    return { ...base, daysOfWeek: days, ...end }
  }
  return { ...base, daysOfWeek: null, ...end }
}
