import { formatTime } from "@/lib/utils"
import type { RosterEvent, SignupAnswer } from "@/lib/types"

export const CSV_DELIMITER = ","

export function escapeCsvField(
  value: string | null | undefined,
  delimiter = CSV_DELIMITER
): string {
  const text = value ?? ""
  const needsQuotes =
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  const escaped = text.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

const SIGNUP_CSV_HEADERS = [
  "Event",
  "Date",
  "Location",
  "Slot",
  "Start",
  "End",
  "Name",
  "Email",
  "Status",
  "Signed Up At",
]

/**
 * One column per question: all active questions plus deleted ones that still
 * have answers, so no collected data is silently dropped from the export.
 * Headers are made unique (label, label (2), …) since CSV has no ids.
 */
export function csvQuestionColumns(event: RosterEvent): {
  id: string
  label: string
}[] {
  const answeredIds = new Set<string>()
  for (const slot of event.slots) {
    for (const s of slot.signups) {
      for (const a of (s.answers ?? []) as SignupAnswer[]) {
        answeredIds.add(a.questionId)
      }
    }
  }
  const seen = new Map<string, number>()
  return event.questions
    .filter((q) => !q.isDeleted || answeredIds.has(q.id))
    .map((q) => {
      const base = q.label || "Question"
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      return { id: q.id, label: count === 1 ? base : `${base} (${count})` }
    })
}

function formatAnswerForCsv(value: string): string {
  if (value === "true") return "Yes"
  if (value === "false") return "No"
  return value
}

export function buildEventSignupsCsv(
  event: RosterEvent,
  delimiter = CSV_DELIMITER
): string {
  const escape = (v: string | null | undefined) => escapeCsvField(v, delimiter)
  const questionColumns = csvQuestionColumns(event)

  const lines = [
    [...SIGNUP_CSV_HEADERS, ...questionColumns.map((q) => q.label)]
      .map(escape)
      .join(delimiter),
  ]

  for (const slot of event.slots) {
    for (const s of slot.signups) {
      const answersById = new Map(
        ((s.answers ?? []) as SignupAnswer[]).map((a) => [a.questionId, a.value])
      )
      lines.push(
        [
          event.title,
          event.date,
          event.location ?? "",
          slot.label,
          formatTime(slot.startTime),
          formatTime(slot.endTime),
          s.volunteerName,
          s.email,
          s.status,
          new Date(s.createdAt).toLocaleString(),
          ...questionColumns.map((q) => {
            const value = answersById.get(q.id)
            return value === undefined ? "" : formatAnswerForCsv(value)
          }),
        ]
          .map(escape)
          .join(delimiter)
      )
    }
  }

  return lines.join("\n")
}

export function buildSignupsFilename(title: string, date: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  return `${slug}-${date}-signups.csv`
}

export function downloadCsv(filename: string, csvContent: string): void {
  // UTF-8 BOM so Excel detects encoding (umlauts etc.) correctly.
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
