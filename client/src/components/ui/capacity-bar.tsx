import { cn } from "@/lib/utils"

interface CapacityBarProps {
  filled: number
  capacity: number
  className?: string
}

/**
 * Encapsulated progress fill — the only place in the app that sets a
 * dynamic width. Dynamic percentages can't be expressed with static
 * Tailwind classes, so the `style` prop lives here once instead of
 * leaking `style={{ width }}` across pages.
 */
export function CapacityBar({ filled, capacity, className }: CapacityBarProps) {
  const percent = capacity > 0 ? Math.min(100, (filled / capacity) * 100) : 0
  const isFull = capacity > 0 && filled >= capacity

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-[3px] bg-muted",
        className
      )}
      role="progressbar"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={capacity}
    >
      <CapacityFill percent={percent} isFull={isFull} />
    </div>
  )
}

export function CapacityFill({
  percent,
  isFull,
  className,
}: {
  percent: number
  isFull?: boolean
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div
      data-slot="capacity-fill"
      data-full={isFull ? "true" : undefined}
      className={cn(
        "h-full rounded-[3px] transition-all",
        isFull ? "bg-red-500" : "bg-primary",
        className
      )}
      style={{ width: `${clamped}%` }}
    />
  )
}
