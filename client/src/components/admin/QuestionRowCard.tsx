import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QUESTION_TYPES, MAX_OPTIONS } from "@/lib/eventQuestions"
import type { QuestionDraft } from "@/lib/eventQuestions"
import type { QuestionType } from "@/lib/types"
import { cn } from "@/lib/utils"

type QuestionField = keyof Omit<QuestionDraft, "key" | "id">

interface QuestionRowCardProps {
  question: QuestionDraft
  error?: string
  removeLabel: string
  removeIcon: ReactNode
  disabled?: boolean
  /** Set when the question already has answers: the type can no longer change. */
  disableTypeChange?: boolean
  onUpdate: (field: QuestionField, value: string | boolean) => void
  onRemove: () => void
}

export function QuestionRowCard({
  question,
  error,
  removeLabel,
  removeIcon,
  disabled = false,
  disableTypeChange = false,
  onUpdate,
  onRemove,
}: QuestionRowCardProps) {
  return (
    <div className="row-card">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={question.label}
            onChange={(e) => onUpdate("label", e.target.value)}
            placeholder="Driver's license number"
            maxLength={200}
            required
            className="h-8 text-sm"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <select
            value={question.type}
            onChange={(e) => onUpdate("type", e.target.value as QuestionType)}
            title={
              disableTypeChange
                ? "Answers exist — the type can no longer change"
                : undefined
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || disableTypeChange}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label
            className={cn(
              "flex items-center gap-2 pb-2 text-xs text-muted-foreground",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            )}
          >
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => onUpdate("required", e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
              disabled={disabled}
            />
            Required
          </label>
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
      {question.type === "Dropdown" && (
        <div className="space-y-1">
          <Label className="text-xs">
            Options (one per line, max {MAX_OPTIONS})
          </Label>
          <textarea
            value={question.optionsText}
            onChange={(e) => onUpdate("optionsText", e.target.value)}
            placeholder={"S\nM\nL\nXL"}
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
          />
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
