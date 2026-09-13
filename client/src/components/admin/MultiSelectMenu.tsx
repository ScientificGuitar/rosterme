import { useId } from "react"
import { Check, ChevronDown, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface MultiSelectMenuProps<T extends string> {
  title: string
  /** Trigger text while loading or when there are no options. */
  shortLabel: string
  /** Trigger text when nothing is selected (means "no filtering"). */
  allLabel: string
  /** Suffix for the multi-selection trigger label, e.g. "groups" → "2 groups". */
  multiSuffix: string
  icon: LucideIcon
  options: MultiSelectOption<T>[]
  selected: T[]
  onChange: (selected: T[]) => void
  loading?: boolean
}

/**
 * Multi-select dropdown with checkboxes: the same control used for the
 * group filter and the status filter. An empty selection means "all".
 */
export function MultiSelectMenu<T extends string>({
  title,
  shortLabel,
  allLabel,
  multiSuffix,
  icon: Icon,
  options,
  selected,
  onChange,
  loading = false,
}: MultiSelectMenuProps<T>) {
  const idPrefix = useId()
  const selectedSet = new Set(selected)

  const toggle = (value: T) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const label =
    loading || options.length === 0
      ? shortLabel
      : selected.length === 0
        ? allLabel
        : selected.length === 1
          ? (options.find((o) => o.value === selected[0])?.label ??
            `1 ${multiSuffix}`)
          : `${selected.length} ${multiSuffix}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={title}
          title={title}
          disabled={loading || options.length === 0}
          className={cn(
            "max-w-55 justify-between gap-1.5 font-normal",
            selected.length > 0 && "border-primary/50 bg-primary/5"
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{loading ? "Loading…" : label}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {selected.length > 1 && (
              <Badge variant="default" className="h-5 px-1.5 text-[11px]">
                {selected.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {options.map((option) => {
            const checked = selectedSet.has(option.value)
            const id = `${idPrefix}-${option.value}`
            return (
              <Label
                key={option.value}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm font-normal hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => toggle(option.value)}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                )}
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0 text-primary",
                    checked ? "opacity-100" : "opacity-0"
                  )}
                />
              </Label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
