import { TERMS_VERSION } from "@/pages/legal/legal"

export interface StoredConsent {
  acceptedAt: string
  version: string
}

/** Consent payload for this signup attempt; stored server-side via Clerk unsafeMetadata. */
export function recordConsent(): StoredConsent {
  return {
    acceptedAt: new Date().toISOString(),
    version: TERMS_VERSION,
  }
}

/** Metadata attached to the Clerk signup so acceptance is stored server-side. */
export function consentMetadata(consent: StoredConsent) {
  return {
    termsAcceptedAt: consent.acceptedAt,
    termsVersion: consent.version,
  }
}
