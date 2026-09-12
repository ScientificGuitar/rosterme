/** Generic helpers for keyed draft-row lists (slots, questions) in Create/Edit forms. */

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
