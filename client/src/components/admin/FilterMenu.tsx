import { useState } from "react"
import { Check, ChevronDown, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface FilterMenuOption<T extends string> {
  value: T
  label: string
}

interface FilterMenuProps<T extends string> {
  title: string
  icon: LucideIcon
  options: FilterMenuOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Highlight the trigger when the value differs from the default. */
  highlighted?: boolean
  contentClassName?: string
}

/**
 * Single-select dropdown in the same popover-button style as GroupFilter.
 * Closes on selection.
 */
export function FilterMenu<T extends string>({
  title,
  icon: Icon,
  options,
  value,
  onChange,
  highlighted = false,
  contentClassName,
}: FilterMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={title}
          title={title}
          className={cn(
            "justify-between gap-1.5 font-normal",
            highlighted && "border-primary/50 bg-primary/5"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selected?.label}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn("w-48 gap-0 p-0", contentClassName)}
      >
        <p className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
          {title}
        </p>
        <div className="p-1.5" role="listbox" aria-label={title}>
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex-1 text-left">{option.label}</span>
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0 text-primary",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
