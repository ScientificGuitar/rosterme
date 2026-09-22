import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export const SPINNER_DELAY_MS = 200

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("animate-spin text-muted-foreground", className)}
    />
  )
}

/**
 * Debounced loading indicator. Renders nothing for `delay` ms so fast
 * loads don't flash a spinner, then shows a centered spinner (with a
 * screen-reader-only label instead of visible "Loading..." text).
 */
export function LoadingState({
  label = "Loading...",
  delay = SPINNER_DELAY_MS,
  className,
  spinnerClassName,
}: {
  label?: string
  delay?: number
  className?: string
  spinnerClassName?: string
}) {
  const [show, setShow] = useState(delay <= 0)

  useEffect(() => {
    if (delay <= 0) return
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "loading-state flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <Loader2
        aria-hidden="true"
        className={cn("h-6 w-6 animate-spin text-muted-foreground", spinnerClassName)}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
