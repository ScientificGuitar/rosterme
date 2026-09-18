import { Button } from "@/components/ui/button"

/**
 * Mobile-only sticky bottom save bar for long event forms.
 *
 * The header Save button scrolls away on long slots/questions forms;
 * this bar stays pinned to the viewport bottom below `md` so saving is
 * always one tap away. Desktop keeps the header actions only.
 */
export function StickySaveBar({
  onCancel,
  submitLabel,
  submittingLabel,
  submitting,
  disabled = false,
}: {
  onCancel: () => void
  submitLabel: string
  submittingLabel: string
  submitting: boolean
  disabled?: boolean
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="flex gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={disabled || submitting}
        >
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  )
}
