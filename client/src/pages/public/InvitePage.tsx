import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, MapPin, Users, MailCheck } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createPublicApi, ApiError } from "@/lib/api"
import type { PublicSlot } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CapacityBar } from "@/components/ui/capacity-bar"

const api = createPublicApi()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InvitePage() {
  const { code } = useParams<{ code: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ["invite", code],
    queryFn: () => api.getInvitePage(code!),
    enabled: !!code,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="mb-2 text-2xl font-bold">Invalid invite link</h1>
        <p className="text-muted-foreground">
          This invite link is invalid, has been revoked, or no longer points to
          an active event.
        </p>
      </div>
    )
  }

  const { organizationName, event } = data

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {organizationName}
        </p>
        <h1 className="text-3xl font-bold">{event.title}</h1>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(event.date)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location}
            </span>
          )}
        </div>
        {event.description && (
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
            {event.description}
          </p>
        )}
      </header>

      {event.isPast ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">This event has already passed</p>
            <p className="text-sm text-muted-foreground">
              Signups are closed. Contact {organizationName} if you have any
              questions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5" />
            Volunteer slots
          </h2>
          {event.slots.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              No slots have been created for this event yet.
            </p>
          ) : (
            <SignupForm slots={event.slots} code={code!} />
          )}
        </section>
      )}
    </div>
  )
}

function SignupForm({ slots, code }: { slots: PublicSlot[]; code: string }) {
  const queryClient = useQueryClient()
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [sentWaitlistPosition, setSentWaitlistPosition] = useState<number | null>(
    null
  )
  const [emailError, setEmailError] = useState<string | null>(null)
  const [duplicatePending, setDuplicatePending] = useState(false)
  const [duplicateWaitlistPending, setDuplicateWaitlistPending] = useState(false)
  const [resending, setResending] = useState(false)

  const canSubmit = !!selectedSlotId && !!name.trim() && !!email.trim()
  const selectedSlot = slots.find((s) => s.id === selectedSlotId)
  const selectedIsWaitlist = !!selectedSlot?.isFull

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!selectedSlotId) {
      toast.error("Please select a slot to sign up for")
      return
    }
    if (!trimmedName) {
      toast.error("Please enter your name")
      return
    }
    if (!trimmedEmail) {
      setEmailError("Please enter your email")
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }

    setSubmitting(true)
    try {
      const result = await api.createSignup(code, {
        slotId: selectedSlotId,
        volunteerName: trimmedName,
        email: trimmedEmail,
      })
      setSentEmail(trimmedEmail)
      setSentWaitlistPosition(
        typeof result.waitlistPosition === "number"
          ? result.waitlistPosition
          : null
      )
      await queryClient.invalidateQueries({ queryKey: ["invite", code] })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "duplicate_pending") {
          setDuplicatePending(true)
          return
        }
        if (err.code === "duplicate_waitlist_pending") {
          setDuplicateWaitlistPending(true)
          return
        }
        if (err.code === "duplicate_confirmed") {
          toast.error("You're already confirmed for this slot.")
          return
        }
        if (err.code === "duplicate_waitlisted") {
          toast.error("You're already on the waitlist for this slot.")
          return
        }
        if (err.code === "waitlist_disabled") {
          toast.error("That slot is full and isn't accepting a waitlist.")
          await queryClient.invalidateQueries({ queryKey: ["invite", code] })
          return
        }
        if (err.code === "event_in_past") {
          toast.error("This event has already passed.")
          await queryClient.invalidateQueries({ queryKey: ["invite", code] })
          return
        }
      }
      toast.error(err instanceof Error ? err.message : "Sign up failed")
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    const trimmedEmail = email.trim()
    setResending(true)
    try {
      await api.resendSignup(code, {
        slotId: selectedSlotId,
        email: trimmedEmail,
      })
      setDuplicatePending(false)
      setDuplicateWaitlistPending(false)
      setSentEmail(trimmedEmail)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend email")
    } finally {
      setResending(false)
    }
  }

  const resetForAnother = () => {
    setSentEmail(null)
    setSentWaitlistPosition(null)
    setSelectedSlotId("")
  }

  if (sentEmail) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          {sentWaitlistPosition !== null ? (
            <p className="text-sm text-green-700 dark:text-green-300">
              You&apos;re on the waitlist! We sent a confirmation link to{" "}
              <strong>{sentEmail}</strong>. Click it to secure position{" "}
              <strong>#{sentWaitlistPosition}</strong>. We&apos;ll email you
              automatically if a spot opens up.
            </p>
          ) : (
            <p className="text-sm text-green-700 dark:text-green-300">
              Check your email! We sent a confirmation link to{" "}
              <strong>{sentEmail}</strong>. Click it to confirm your signup.
            </p>
          )}
          <Button variant="outline" size="sm" onClick={resetForAnother}>
            Sign up for another slot
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Select a slot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2">
        <RadioGroup
          value={selectedSlotId}
          onValueChange={(value) => {
            setSelectedSlotId(value)
            setDuplicatePending(false)
            setDuplicateWaitlistPending(false)
          }}
          className="gap-2"
        >
          {slots.map((slot) => {
            const fullWithoutWaitlist = slot.isFull && !slot.allowWaitlist
            return (
              <Label
                key={slot.id}
                htmlFor={`slot-${slot.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  fullWithoutWaitlist &&
                    "cursor-not-allowed opacity-60 hover:bg-transparent",
                  selectedSlotId === slot.id && "border-primary bg-primary/5"
                )}
              >
                <RadioGroupItem
                  id={`slot-${slot.id}`}
                  value={slot.id}
                  disabled={fullWithoutWaitlist}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {slot.label}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatTime(slot.startTime)}&ndash;
                        {formatTime(slot.endTime)}
                      </span>
                    </span>
                    <Badge
                      variant={slot.isFull ? "destructive" : "secondary"}
                    >
                      {`${slot.signupCount}/${slot.capacity}`}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <CapacityBar
                      filled={slot.signupCount}
                      capacity={slot.capacity}
                    />
                  </div>
                  {slot.isFull && slot.allowWaitlist && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Full — joining the waitlist
                      {slot.waitlistCount > 0 &&
                        ` (${slot.waitlistCount} waiting)`}
                      .
                    </p>
                  )}
                  {slot.isFull && !slot.allowWaitlist && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Full — no waitlist for this slot.
                    </p>
                  )}
                </div>
              </Label>
            )
          })}
        </RadioGroup>

        {duplicatePending || duplicateWaitlistPending ? (
          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {duplicateWaitlistPending
                ? "You already have a pending waitlist signup for this slot. Check your email to confirm it and secure your place in line."
                : "You already have a pending signup for this slot. Check your email to confirm it."}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleResend} disabled={resending}>
                {resending ? "Sending..." : "Resend confirmation email"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDuplicatePending(false)
                  setDuplicateWaitlistPending(false)
                }}
              >
                Choose another slot
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={200}
              disabled={submitting}
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError(null)
              }}
              placeholder="Your email"
              maxLength={320}
              disabled={submitting}
              aria-invalid={!!emailError}
            />
            {emailError && (
              <p className="text-sm text-destructive" role="alert">
                {emailError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || submitting}
            >
              {submitting
                ? selectedIsWaitlist
                  ? "Joining waitlist..."
                  : "Signing up..."
                : selectedIsWaitlist
                  ? "Join Waitlist"
                  : "Sign up"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our{" "}
              <Link
                to="/terms-of-service"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy-policy"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function formatTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
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
