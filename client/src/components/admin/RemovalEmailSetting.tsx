import { CircleHelp } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  REMOVAL_EMAIL_LABELS,
  type RemovalEmailPolicy,
} from "@/lib/removalEmailPolicy"

const OPTIONS: {
  value: RemovalEmailPolicy
  label: string
  hint: string
}[] = [
  {
    value: "Always",
    label: REMOVAL_EMAIL_LABELS.Always,
    hint: "Volunteers are emailed automatically.",
  },
  {
    value: "Never",
    label: REMOVAL_EMAIL_LABELS.Never,
    hint: "Removals happen silently.",
  },
  {
    value: "Ask",
    label: REMOVAL_EMAIL_LABELS.Ask,
    hint: "You choose per removal.",
  },
]

const HELP_TITLE = "Notify volunteers on removal"
const HELP_TEXT =
  "Controls whether volunteers get an email when you remove a single signup, delete a time slot that has signups, or delete this event. “Yes” always sends the email, “No” never does, and “Ask every time” prompts you to decide after each removal."

/** The (?) explainer for the removal-email setting, usable in read-only spots. */
export function RemovalEmailHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About: ${HELP_TITLE}`}
          title={HELP_TEXT}
          className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80">
        <p className="text-sm font-medium">{HELP_TITLE}</p>
        <p className="text-sm text-muted-foreground">{HELP_TEXT}</p>
      </PopoverContent>
    </Popover>
  )
}

interface RemovalEmailSettingProps {
  value: RemovalEmailPolicy
  onChange: (value: RemovalEmailPolicy) => void
  disabled?: boolean
}

export function RemovalEmailSetting({
  value,
  onChange,
  disabled = false,
}: RemovalEmailSettingProps) {
  const selected = OPTIONS.find((o) => o.value === value)

  return (
    <div className="field-stack">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="removal-email-policy">{HELP_TITLE}</Label>
        <RemovalEmailHelp />
      </div>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as RemovalEmailPolicy)}
        disabled={disabled}
      >
        <SelectTrigger id="removal-email-policy" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" sideOffset={4}>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && <p className="muted-xs">{selected.hint}</p>}
    </div>
  )
}
