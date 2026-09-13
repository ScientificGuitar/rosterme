import { Users } from "lucide-react"
import { MultiSelectMenu } from "@/components/admin/MultiSelectMenu"
import type { Group } from "@/lib/types"

interface GroupFilterProps {
  groups: Group[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
  /** Optional per-group event counts, shown next to each name. */
  counts?: Record<string, number>
}

export function GroupFilter({
  groups,
  selectedIds,
  onChange,
  loading = false,
  counts,
}: GroupFilterProps) {
  return (
    <MultiSelectMenu
      title="Filter by group"
      shortLabel="Groups"
      allLabel="All groups"
      multiSuffix="groups"
      icon={Users}
      options={groups.map((g) => ({
        value: g.id,
        label: g.name,
        count: counts?.[g.id],
      }))}
      selected={selectedIds}
      onChange={onChange}
      loading={loading}
    />
  )
}
