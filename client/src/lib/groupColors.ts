export interface GroupColor {
  /** Class string for a small event chip/block (border + bg + text). */
  chip: string
  /** Class string for a solid dot / swatch. */
  dot: string
}

/**
 * Fixed palette written out in full so Tailwind sees every class string
 * (no dynamic class construction). Each color ships light + dark variants.
 */
const GROUP_PALETTE: GroupColor[] = [
  {
    chip: "border border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  {
    chip: "border border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  {
    chip: "border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  {
    chip: "border border-rose-200 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  {
    chip: "border border-teal-200 bg-teal-100 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
    dot: "bg-teal-500",
  },
  {
    chip: "border border-cyan-200 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
  {
    chip: "border border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
    dot: "bg-orange-500",
  },
  {
    chip: "border border-fuchsia-200 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
    dot: "bg-fuchsia-500",
  },
  {
    chip: "border border-lime-200 bg-lime-100 text-lime-900 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-200",
    dot: "bg-lime-500",
  },
  {
    chip: "border border-indigo-200 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  {
    chip: "border border-pink-200 bg-pink-100 text-pink-900 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200",
    dot: "bg-pink-500",
  },
  {
    chip: "border border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    dot: "bg-sky-500",
  },
]

const PALETTE_SIZE = GROUP_PALETTE.length

/**
 * Deterministic color for a group, derived from a stable FNV-1a hash of the
 * group id so the same group always gets the same color across sessions,
 * pages, and devices.
 */
export function groupColor(groupId: string): GroupColor {
  let hash = 2166136261
  for (let i = 0; i < groupId.length; i++) {
    hash ^= groupId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return GROUP_PALETTE[(hash >>> 0) % PALETTE_SIZE]
}
