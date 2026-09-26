export type EventStatus = "upcoming" | "past"

export const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
]

export const STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  past: "Past",
}
