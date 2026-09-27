import { useRef } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Copy, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildInviteUrl, buildQrFilename, downloadBlob } from "@/lib/inviteQr"
import type { InviteLink } from "@/lib/types"

const QR_EXPORT_SIZE = 1024

interface InviteQrDialogProps {
  link: InviteLink | null
  eventTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteQrDialog({
  link,
  eventTitle,
  open,
  onOpenChange,
}: InviteQrDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const url = link ? buildInviteUrl(link.code) : ""
  const baseFilename = link
    ? buildQrFilename(link.name, link.code)
    : "invite-qr"
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleDownloadPng = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready yet")
      return
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Failed to export QR code")
        return
      }
      downloadBlob(`${baseFilename}.png`, blob)
      toast.success("QR code downloaded")
    }, "image/png")
  }

  const handleDownloadSvg = () => {
    const svg = svgRef.current
    if (!svg) {
      toast.error("QR code is not ready yet")
      return
    }
    const markup = new XMLSerializer().serializeToString(svg)
    downloadBlob(
      `${baseFilename}.svg`,
      new Blob([markup], { type: "image/svg+xml;charset=utf-8" })
    )
    toast.success("QR code downloaded")
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `${eventTitle} — ${link?.name ?? "Invite"}`,
        text: `Sign up for ${eventTitle}`,
        url,
      })
    } catch (e) {
      // AbortError means the user dismissed the share sheet — not an error.
      if (e instanceof DOMException && e.name === "AbortError") return
      toast.error("Failed to share")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{link?.name ?? "Invite QR code"}</DialogTitle>
          <DialogDescription>
            {eventTitle} — scan to open the signup page.
          </DialogDescription>
        </DialogHeader>
        {link && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-foreground/10">
              <QRCodeSVG
                ref={svgRef}
                value={url}
                size={220}
                level="M"
                marginSize={4}
                title={`QR code for ${link.name}`}
              />
            </div>
            <p
              title={url}
              className="w-full truncate text-center font-mono text-xs text-muted-foreground"
            >
              {url}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1 h-3 w-3" />
                Copy link
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPng}>
                <Download className="mr-1 h-3 w-3" />
                PNG
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadSvg}>
                <Download className="mr-1 h-3 w-3" />
                SVG
              </Button>
              {canShare && (
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="mr-1 h-3 w-3" />
                  Share
                </Button>
              )}
            </div>
            {/* High-resolution raster source for PNG export. */}
            <QRCodeCanvas
              ref={canvasRef}
              value={url}
              size={QR_EXPORT_SIZE}
              level="M"
              marginSize={4}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
