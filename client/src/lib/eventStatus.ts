export type EventStatus = "active" | "inactive"

export const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

export const STATUS_LABELS: Record<EventStatus, string> = {
  active: "Active",
  inactive: "Inactive",
}
