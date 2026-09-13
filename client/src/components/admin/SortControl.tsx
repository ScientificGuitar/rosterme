import { ArrowDownUp } from "lucide-react"
import {
  FilterMenu,
  type FilterMenuOption,
} from "@/components/admin/FilterMenu"

export type EventSortBy = "date" | "title" | "status"

const OPTIONS: FilterMenuOption<EventSortBy>[] = [
  { value: "date", label: "Start date" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
]

interface SortControlProps {
  value: EventSortBy
  onChange: (value: EventSortBy) => void
}

export function SortControl({ value, onChange }: SortControlProps) {
  return (
    <FilterMenu
      title="Sort by"
      icon={ArrowDownUp}
      options={OPTIONS}
      value={value}
      onChange={onChange}
      highlighted={value !== "date"}
    />
  )
}
