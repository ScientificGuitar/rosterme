import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, Clock, Mail, MapPin, CalendarX2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
import { createPublicApi } from "@/lib/api"
import { useSeo } from "@/lib/seo"
import { formatTimeOnly } from "@/lib/utils"
import { Alert } from "@/components/ui/layout"

const api = createPublicApi()

export function SignupManagePage() {
  useSeo({ title: "Manage Your Signup | RosterMe", noindex: true })
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [cancelled, setCancelled] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmFailed, setConfirmFailed] = useState(false)
  const confirmStarted = useRef(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["signup-manage", token],
    queryFn: () => api.getSignupDetails(token!),
    enabled: !!token,
    retry: false,
  })

  // Frictionless confirm: GET is a pure read, so POST confirm explicitly
  // from JS on mount when the signup is still pending. Plain GET
  // prefetchers/scanners don't execute JS, so they can no longer confirm.
  useEffect(() => {
    if (!token || !data || confirmStarted.current || confirmFailed) return
    if (data.status !== "Pending" && data.status !== "WaitlistPending") return
    confirmStarted.current = true
    api
      .confirmSignup(token)
      .then((confirmed) => {
        queryClient.setQueryData(["signup-manage", token], confirmed)
      })
      .catch((err) => {
        setConfirmFailed(true)
        toast.error(
          err instanceof Error ? err.message : "Failed to confirm signup"
        )
      })
  }, [data, token, queryClient, confirmFailed])

  const handleRetryConfirm = () => {
    confirmStarted.current = false
    setConfirmFailed(false)
  }

  if (isLoading) {
    return <div className="public-narrow loading-state py-16">Loading...</div>
  }

  if (error || !data) {
    return (
      <div className="public-narrow loading-state py-16">
        <h1 className="page-title mb-2">Invalid link</h1>
        <p className="muted">This signup link is invalid or has expired.</p>
        <p className="muted mt-2">
          Links stop working when a newer one is issued &mdash; for example, if
          you re-sent your confirmation, received a reminder email (sent about
          24 hours before your shift), or were promoted from the waitlist (which
          sends a new &ldquo;You&rsquo;re in!&rdquo; email). Please open the
          newest email from us and use the link inside it.
        </p>
      </div>
    )
  }

  const isCancelled = cancelled || data.status === "Cancelled"
  const isRemoved = !cancelled && data.status === "Removed"
  const isPending =
    !cancelled &&
    (data.status === "Pending" || data.status === "WaitlistPending")
  const isWaitlisted = !cancelled && data.status === "Waitlisted"
  const waitlistPosition =
    typeof data.waitlistPosition === "number" ? data.waitlistPosition : null

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await api.cancelSignup(token!)
      setCancelled(true)
      setConfirmOpen(false)
      toast.success(
        isWaitlisted
          ? "You've left the waitlist."
          : "Your signup has been cancelled."
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel signup"
      )
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="public-narrow stack-md py-8">
      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-xl">Your signup</CardTitle>
        </CardHeader>
        <CardContent className="stack-md p-6 pt-2">
          <div className="field-stack">
            <p className="muted">{data.groupName}</p>
            <p className="text-lg font-semibold">{data.eventTitle}</p>
          </div>

          <Separator />

          <div className="field-stack text-sm">
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDate(data.eventDate)}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatTimeOnly(data.startTime)}&ndash;{formatTimeOnly(data.endTime)}
            </p>
            {data.eventLocation && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {data.eventLocation}
              </p>
            )}
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {data.email}
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="muted">Status</span>
            <Badge
              variant={
                isCancelled
                  ? "destructive"
                  : isRemoved
                    ? "secondary"
                    : isPending || isWaitlisted
                      ? "pending"
                      : "default"
              }
            >
              {isCancelled
                ? "Cancelled"
                : isRemoved
                  ? "Removed"
                  : isPending
                    ? "Confirming…"
                    : isWaitlisted
                      ? "Waitlisted"
                      : "Confirmed"}
            </Badge>
          </div>

          {isPending && (
            <Alert tone="warning">
              {confirmFailed ? (
                <>
                  We couldn&apos;t confirm your signup.{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm font-semibold text-amber-800 underline dark:text-amber-300"
                    onClick={handleRetryConfirm}
                  >
                    Try again
                  </Button>
                </>
              ) : (
                "Confirming your signup…"
              )}
            </Alert>
          )}

          {isWaitlisted && !isCancelled && !isRemoved && (
            <Alert tone="warning">
              You&apos;re{" "}
              {waitlistPosition !== null ? (
                <>
                  <strong>#{waitlistPosition}</strong> in line
                </>
              ) : (
                "in line"
              )}
              . We&apos;ll email you automatically if a spot opens up.
            </Alert>
          )}

          {isRemoved ? (
            <Alert tone="muted">
              <CalendarX2 className="h-4 w-4" />
              This signup was removed by the organizer. Your spot has been
              released.
            </Alert>
          ) : isCancelled ? (
            <Alert tone="error">
              <CalendarX2 className="h-4 w-4" />
              You&rsquo;ve cancelled this signup. Your spot has been released.
            </Alert>
          ) : (
            <>
              <Button
                variant="destructive"
                className="w-full"
                disabled={cancelling}
                onClick={() => setConfirmOpen(true)}
              >
                {isWaitlisted ? "Leave waitlist" : "Cancel signup"}
              </Button>
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={isWaitlisted ? "Leave waitlist?" : "Cancel signup?"}
                description={
                  isWaitlisted
                    ? "This will remove you from the waitlist. This action cannot be undone."
                    : "This will release your spot for this shift. This action cannot be undone."
                }
                confirmLabel={
                  isWaitlisted ? "Yes, leave waitlist" : "Yes, cancel signup"
                }
                cancelLabel="Keep my spot"
                variant="destructive"
                isLoading={cancelling}
                loadingLabel="Cancelling..."
                onConfirm={handleCancel}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}
