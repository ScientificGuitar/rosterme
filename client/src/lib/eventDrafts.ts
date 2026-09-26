/** Generic helpers for keyed draft-row lists (slots, questions) in Create/Edit forms. */

import { arrayMove } from "@dnd-kit/sortable"

export interface DraftRow {
  key: number
}

export interface SoftDeletableRow extends DraftRow {
  id?: string
  deleted: boolean
}

/** Remove one key from a `Record<number, string>` error map. Returns prev when untouched. */
export function clearDraftError(
  prev: Record<number, string>,
  key: number
): Record<number, string> {
  if (!(key in prev)) return prev
  const next = { ...prev }
  delete next[key]
  return next
}

/** Update a single row by key with a partial patch. */
export function updateDraftRow<T extends DraftRow>(
  rows: T[],
  key: number,
  patch: Partial<T>
): T[] {
  return rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
}

/** Remove a single row by key (Create form: rows are never persisted). */
export function removeDraftRow<T extends DraftRow>(
  rows: T[],
  key: number
): T[] {
  return rows.filter((r) => r.key !== key)
}

/**
 * Soft-delete a row by key. Rows that were never persisted (no `id`)
 * are dropped outright since there is nothing to delete on save.
 */
export function markRowDeleted<T extends SoftDeletableRow>(
  rows: T[],
  key: number
): T[] {
  return rows
    .map((r) => (r.key === key ? { ...r, deleted: true } : r))
    .filter((r) => !(r.key === key && !r.id))
}

/** Undo a soft-delete by key. */
export function undoRowDeleted<T extends SoftDeletableRow>(
  rows: T[],
  key: number
): T[] {
  return rows.map((r) => (r.key === key ? { ...r, deleted: false } : r))
}

/** Rows that are still active (not marked for deletion). */
export function activeRows<T extends { deleted: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted)
}

/**
 * Reorder a contiguous draft list by moving the row with `activeKey` into the
 * position currently occupied by `overKey` (dnd-kit drag-end convention).
 */
export function reorderDraftRow<T extends DraftRow>(
  rows: T[],
  activeKey: number,
  overKey: number
): T[] {
  const oldIndex = rows.findIndex((r) => r.key === activeKey)
  const newIndex = rows.findIndex((r) => r.key === overKey)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return rows
  return arrayMove(rows, oldIndex, newIndex)
}

/**
 * Reorder a soft-deletable list by moving an active row. Deleted rows keep
 * their anchor positions; only the relative order of active rows changes.
 * Used by the Edit form where deleted rows render inline as placeholders.
 */
export function reorderActiveRows<T extends SoftDeletableRow>(
  rows: T[],
  activeKey: number,
  overKey: number
): T[] {
  const active = rows.filter((r) => !r.deleted)
  const oldIndex = active.findIndex((r) => r.key === activeKey)
  const newIndex = active.findIndex((r) => r.key === overKey)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return rows
  const movedActive = arrayMove(active, oldIndex, newIndex)
  let activeCursor = 0
  return rows.map((r) => (r.deleted ? r : movedActive[activeCursor++]))
}
