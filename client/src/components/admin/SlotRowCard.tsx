import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeInput } from "@/components/ui/time-input"
import { DataRow, RequiredStar } from "@/components/ui/layout"
import { cn } from "@/lib/utils"
import type { SlotDraft } from "@/lib/eventSlots"

type SlotField = keyof Omit<SlotDraft, "key">

interface SlotRowCardProps {
  slot: SlotDraft
  error?: string
  capacityMin?: number
  badge?: ReactNode
  hint?: string
  removeLabel: string
  removeIcon: ReactNode
  disabled?: boolean
  onUpdate: (field: SlotField, value: string | number | boolean) => void
  onRemove: () => void
}

export function SlotRowCard({
  slot,
  error,
  capacityMin = 1,
  badge,
  hint,
  removeLabel,
  removeIcon,
  disabled = false,
  onUpdate,
  onRemove,
}: SlotRowCardProps) {
  return (
    <DataRow className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label>
            <span>
              Label
              <RequiredStar />
            </span>
          </Label>
          <Input
            value={slot.label}
            onChange={(e) => onUpdate("label", e.target.value)}
            placeholder="Morning"
            required
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label>
            <span>
              Start
              <RequiredStar />
            </span>
          </Label>
          <TimeInput
            value={slot.startTime}
            onChange={(val) => onUpdate("startTime", val)}
            size="sm"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label>
            <span>
              End
              <RequiredStar />
            </span>
          </Label>
          <TimeInput
            value={slot.endTime}
            onChange={(val) => onUpdate("endTime", val)}
            size="sm"
            disabled={disabled}
          />
        </div>
        <div className="w-24 space-y-1">
          <Label>
            <span>
              Capacity
              <RequiredStar />
            </span>
          </Label>
          <Input
            type="number"
            min={capacityMin}
            value={slot.capacity}
            onChange={(e) =>
              onUpdate("capacity", parseInt(e.target.value) || 1)
            }
            required
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-1">
          {badge}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title={removeLabel}
            aria-label={removeLabel}
            disabled={disabled}
          >
            {removeIcon}
          </Button>
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <label
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        )}
      >
        <input
          type="checkbox"
          checked={slot.allowWaitlist}
          onChange={(e) => onUpdate("allowWaitlist", e.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
          disabled={disabled}
        />
        Allow waitlist when full
      </label>
      {hint && !error && <p className="muted-xs">{hint}</p>}
    </DataRow>
  )
}
