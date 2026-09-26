export type RemovalEmailPolicy = "Ask" | "Always" | "Never"

export const REMOVAL_EMAIL_LABELS: Record<RemovalEmailPolicy, string> = {
  Always: "Yes, always email",
  Never: "No, never email",
  Ask: "Ask every time",
}
