interface ClerkApiError {
  message: string
  longMessage?: string
  errors?: { longMessage?: string; message?: string }[]
}

/** Pull a human-readable message out of a Clerk `{ error }` result. */
export function toClerkMessage(
  error: ClerkApiError | null,
  fallback: string
): string {
  const first = error?.errors?.[0]
  return (
    first?.longMessage ||
    first?.message ||
    error?.longMessage ||
    error?.message ||
    fallback
  )
}
