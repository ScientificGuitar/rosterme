import { useMemo } from "react"
import { Repeat } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MAX_HORIZON_MONTHS,
  MAX_OCCURRENCES,
  PREVIEW_HEAD,
  WEEKDAY_SHORT,
  formatDateSpan,
  formatPreviewDate,
  planOccurrences,
  previewRows,
  validateRecurrence,
  type RecurrenceDraft,
  type RecurrenceFrequency,
} from "@/lib/recurrence"
import { cn } from "@/lib/utils"

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
]

const INTERVAL_UNIT: Record<RecurrenceFrequency, string> = {
  Daily: "day(s)",
  Weekly: "week(s)",
  Monthly: "month(s)",
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

interface RecurrenceSectionProps {
  startDate: string
  draft: RecurrenceDraft
  onChange: (draft: RecurrenceDraft) => void
  disabled?: boolean
}

function weekdayOf(dateStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.getDay()
}

export function RecurrenceSection({
  startDate,
  draft,
  onChange,
  disabled = false,
}: RecurrenceSectionProps) {
  const set = (patch: Partial<RecurrenceDraft>) =>
    onChange({ ...draft, ...patch })

  const handleEnabled = (checked: boolean) => {
    if (
      checked &&
      draft.frequency === "Weekly" &&
      draft.daysOfWeek.length === 0
    ) {
      const wd = weekdayOf(startDate)
      set({ enabled: true, daysOfWeek: wd === null ? [] : [wd] })
    } else {
      set({ enabled: checked })
    }
  }

  const handleFrequency = (frequency: RecurrenceFrequency) => {
    if (frequency === "Weekly" && draft.daysOfWeek.length === 0) {
      const wd = weekdayOf(startDate)
      set({ frequency, daysOfWeek: wd === null ? [] : [wd] })
    } else {
      set({ frequency })
    }
  }

  const toggleDay = (day: number) => {
    const next = draft.daysOfWeek.includes(day)
      ? draft.daysOfWeek.filter((d) => d !== day)
      : [...draft.daysOfWeek, day]
    set({ daysOfWeek: next })
  }

  const error = validateRecurrence(startDate, draft)
  const plan = useMemo(
    () => (draft.enabled && !error ? planOccurrences(startDate, draft) : null),
    [draft, startDate, error]
  )
  const preview = useMemo(() => (plan ? previewRows(plan.dates) : null), [plan])

  return (
    <div className="field-stack">
      <div className="flex items-start gap-2">
        <Checkbox
          id="repeat-event"
          checked={draft.enabled}
          onCheckedChange={(v) => handleEnabled(v === true)}
          disabled={disabled}
        />
        <div>
          <Label htmlFor="repeat-event" className="flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" />
            Repeat this event
          </Label>
          <p className="muted-xs">
            Creates independent events with the same details, slots and
            questions. Each occurrence is managed separately afterwards.
          </p>
        </div>
      </div>

      {draft.enabled && (
        <div className="space-y-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="field-stack">
              <Label htmlFor="repeat-frequency">Repeats</Label>
              <Select
                value={draft.frequency}
                onValueChange={(v) => handleFrequency(v as RecurrenceFrequency)}
                disabled={disabled}
              >
                <SelectTrigger id="repeat-frequency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={4}>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="field-stack">
              <Label htmlFor="repeat-interval">
                Every {INTERVAL_UNIT[draft.frequency]}
              </Label>
              <Input
                id="repeat-interval"
                type="number"
                min={1}
                max={12}
                value={draft.interval}
                onChange={(e) => set({ interval: Number(e.target.value) })}
                disabled={disabled}
              />
            </div>
          </div>

          {draft.frequency === "Weekly" && (
            <div className="field-stack">
              <Label>Repeat on</Label>
              <div className="flex gap-1.5">
                {WEEKDAY_SHORT.map((short, day) => {
                  const active = draft.daysOfWeek.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Repeat on ${WEEKDAY_NAMES[day]}`}
                      onClick={() => toggleDay(day)}
                      disabled={disabled}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {short}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="field-stack">
            <Label>Ends</Label>
            <RadioGroup
              value={draft.endMode}
              onValueChange={(v) => set({ endMode: v as "count" | "until" })}
              disabled={disabled}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="count" id="repeat-end-count" />
                <Label htmlFor="repeat-end-count" className="font-normal">
                  After
                </Label>
                <Input
                  type="number"
                  min={2}
                  max={MAX_OCCURRENCES}
                  value={draft.count}
                  onChange={(e) => set({ count: Number(e.target.value) })}
                  disabled={disabled || draft.endMode !== "count"}
                  className="w-20"
                />
                <span className="muted-xs">occurrences</span>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="until" id="repeat-end-until" />
                <Label htmlFor="repeat-end-until" className="font-normal">
                  On
                </Label>
                <Input
                  type="date"
                  value={draft.untilDate}
                  min={startDate || undefined}
                  onChange={(e) => set({ untilDate: e.target.value })}
                  disabled={disabled || draft.endMode !== "until"}
                  className="w-auto"
                />
              </div>
            </RadioGroup>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : (
            plan &&
            plan.dates.length > 0 && (
              <div>
                <p className="muted-xs mb-1">
                  {plan.dates.length} event
                  {plan.dates.length === 1 ? "" : "s"} ·{" "}
                  {formatDateSpan(plan.dates)}
                </p>
                <ul className="muted-xs list-disc pl-5">
                  {preview!.rows
                    .slice(
                      0,
                      preview!.ellipsis ? PREVIEW_HEAD : preview!.rows.length
                    )
                    .map((iso) => (
                      <li key={`head-${iso}`}>{formatPreviewDate(iso)}</li>
                    ))}
                  {preview!.ellipsis && <li aria-hidden>…</li>}
                  {preview!.ellipsis &&
                    preview!.rows
                      .slice(PREVIEW_HEAD)
                      .map((iso) => (
                        <li key={`tail-${iso}`}>{formatPreviewDate(iso)}</li>
                      ))}
                </ul>
                {plan.truncated && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                    {plan.requestedTotal !== null
                      ? `Only ${plan.dates.length} of ${plan.requestedTotal} requested will be created`
                      : `Only the first ${plan.dates.length} will be created`}{" "}
                    — repeats are limited to {MAX_OCCURRENCES} occurrences
                    within {MAX_HORIZON_MONTHS} months.
                  </p>
                )}
              </div>
            )
          )}
          <p className="muted-xs">
            Limited to {MAX_OCCURRENCES} occurrences within {MAX_HORIZON_MONTHS}{" "}
            months of the first event.
          </p>
        </div>
      )}
    </div>
  )
}
