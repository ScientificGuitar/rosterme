/** Helpers for invite-link QR codes. The QR payload is the same public
 * invite URL volunteers open in a browser (`/invite/:code`). */

export function buildInviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`
}

export function buildQrFilename(name: string, code: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "invite"
  return `${slug}-${code}-qr`
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
