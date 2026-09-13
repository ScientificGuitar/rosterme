import { CircleDot } from "lucide-react"
import { MultiSelectMenu } from "@/components/admin/MultiSelectMenu"
import { STATUS_OPTIONS, type EventStatus } from "@/lib/eventStatus"

interface StatusFilterProps {
  selected: EventStatus[]
  onChange: (selected: EventStatus[]) => void
}

export function StatusFilter({ selected, onChange }: StatusFilterProps) {
  return (
    <MultiSelectMenu
      title="Filter by status"
      shortLabel="Status"
      allLabel="All statuses"
      multiSuffix="statuses"
      icon={CircleDot}
      options={STATUS_OPTIONS}
      selected={selected}
      onChange={onChange}
    />
  )
}
