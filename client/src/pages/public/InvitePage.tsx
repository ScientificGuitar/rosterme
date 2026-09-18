import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, MapPin, Users, MailCheck, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createPublicApi, ApiError } from "@/lib/api"
import { useSeo } from "@/lib/seo"
import type { PublicSlot, PublicQuestion } from "@/lib/types"
import { isValidPhone } from "@/lib/eventQuestions"
import { cn, formatTimeOnly } from "@/lib/utils"
import { CapacityBar } from "@/components/ui/capacity-bar"
import {
  Alert,
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
  EmptyState,
  RequiredStar,
} from "@/components/ui/layout"

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

  useSeo({
    title: data?.event?.title
      ? `${data.event.title} - Signup | RosterMe`
      : "Signup | RosterMe",
    noindex: true,
  })

  if (isLoading) {
    return <div className="public-wide loading-state">Loading...</div>
  }

  if (error || !data) {
    return (
      <div className="public-narrow loading-state py-16">
        <h1 className="page-title mb-2">Invalid invite link</h1>
        <p className="muted">
          This invite link is invalid, has been revoked, or no longer points to
          an active event.
        </p>
      </div>
    )
  }

  const { groupName, event } = data

  return (
    <div className="public-wide form-stack">
      <header className="field-stack-sm text-center">
        <p className="text-sm font-medium text-muted-foreground">{groupName}</p>
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
          <p className="muted mx-auto mt-2 max-w-prose">{event.description}</p>
        )}
      </header>

      {event.isPast ? (
        <DataCard>
          <DataCardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">This event has already passed</p>
            <p className="muted">
              Signups are closed. Contact {groupName} if you have any questions.
            </p>
          </DataCardContent>
        </DataCard>
      ) : event.slots.length === 0 ? (
        <EmptyState className="py-8">
          No slots have been created for this event yet.
        </EmptyState>
      ) : (
        <SignupForm
          slots={event.slots}
          questions={event.questions}
          code={code!}
        />
      )}
    </div>
  )
}

function SignupForm({
  slots,
  questions,
  code,
}: {
  slots: PublicSlot[]
  questions: PublicQuestion[]
  code: string
}) {
  const queryClient = useQueryClient()
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>(
    {}
  )
  const [submitting, setSubmitting] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [sentWaitlistPosition, setSentWaitlistPosition] = useState<
    number | null
  >(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [duplicatePending, setDuplicatePending] = useState(false)
  const [duplicateWaitlistPending, setDuplicateWaitlistPending] =
    useState(false)
  const [resending, setResending] = useState(false)

  const canSubmit = !!selectedSlotId && !!name.trim() && !!email.trim()
  const selectedSlot = slots.find((s) => s.id === selectedSlotId)
  const selectedIsWaitlist = !!selectedSlot?.isFull
  const hasBookableSlot = slots.some((s) => !s.isFull || s.allowWaitlist)

  /**
   * Maps backend ValidationProblem answer errors back onto the question fields.
   * Server keys are indexed into the answers array we submitted, so rebuild
   * that exact array to translate indexes back to question ids. Returns true
   * if at least one error was mapped to a field.
   */
  const mapAnswerErrors = (err: ApiError): boolean => {
    if (!err.fields) return false
    const payload = buildAnswersPayload(questions, answers)
    const next: Record<string, string> = {}
    let mapped = false
    for (const [key, messages] of Object.entries(err.fields)) {
      const indexed = key.match(/^Answers\[(\d+)\]\.(?:Value|QuestionId)$/)
      if (indexed) {
        const questionId = payload[Number(indexed[1])]?.questionId
        if (questionId && messages[0]) {
          next[questionId] = messages[0]
          mapped = true
        }
        continue
      }
      if (key === "Answers") {
        for (const message of messages) {
          // Required errors are keyed without an index but name the question label.
          const byLabel = message.match(/^The question "(.+)" is required\.$/)
          const question = byLabel
            ? questions.find((q) => q.label === byLabel[1])
            : undefined
          if (question) {
            next[question.id] = "This question is required."
            mapped = true
          }
        }
      }
    }
    if (mapped) {
      setQuestionErrors((prev) => ({ ...prev, ...next }))
      toast.error("Please fix the highlighted questions before signing up.")
    }
    return mapped
  }

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

    const questionErrs = validateAnswers(questions, answers)
    setQuestionErrors(questionErrs)
    if (Object.keys(questionErrs).length > 0) {
      toast.error("Please fix the highlighted questions before signing up.")
      return
    }

    setSubmitting(true)
    try {
      const result = await api.createSignup(code, {
        slotId: selectedSlotId,
        volunteerName: trimmedName,
        email: trimmedEmail,
        answers: buildAnswersPayload(questions, answers),
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
        if (mapAnswerErrors(err)) return
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
    setAnswers({})
    setQuestionErrors({})
  }

  if (sentEmail) {
    return (
      <DataCard>
        <DataCardContent className="flex flex-col items-center gap-3 py-8 text-center">
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
        </DataCardContent>
      </DataCard>
    )
  }

  return (
    <div className="space-y-4">
      <DataCard>
        <DataCardHeader>
          <DataCardTitle
            icon={Users}
            actions={
              <Badge variant="secondary" className="shrink-0">
                {slots.length} {slots.length === 1 ? "slot" : "slots"}
              </Badge>
            }
          >
            Select a slot
          </DataCardTitle>
        </DataCardHeader>
        <DataCardDivider />
        <DataCardContent>
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-words">
                          {slot.label}
                        </p>
                        <p className="muted-xs mt-0.5">
                          {formatTimeOnly(slot.startTime)}&ndash;
                          {formatTimeOnly(slot.endTime)}
                        </p>
                      </div>
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
                      <p className="muted-xs mt-1">
                        Full — joining the waitlist
                        {slot.waitlistCount > 0 &&
                          ` (${slot.waitlistCount} waiting)`}
                        .
                      </p>
                    )}
                    {slot.isFull && !slot.allowWaitlist && (
                      <p className="muted-xs mt-1">
                        Full — no waitlist for this slot.
                      </p>
                    )}
                  </div>
                </Label>
              )
            })}
          </RadioGroup>
        </DataCardContent>
      </DataCard>

      {!hasBookableSlot ? (
        <DataCard>
          <DataCardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">This event is fully booked</p>
            <p className="muted">
              All slots are full and aren&apos;t accepting a waitlist.
              Contact the event organiser if you have any questions.
            </p>
          </DataCardContent>
        </DataCard>
      ) : duplicatePending || duplicateWaitlistPending ? (
        <Alert tone="warning" className="section-stack p-4">
          <p>
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
        </Alert>
      ) : (
        <DataCard>
          <DataCardHeader>
            <DataCardTitle icon={UserRound}>Your details</DataCardTitle>
          </DataCardHeader>
          <DataCardDivider />
          <DataCardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="field-stack">
                <Label htmlFor="signup-name">
                  <span>
                    Name
                    <RequiredStar />
                  </span>
                </Label>
                <Input
                  id="signup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  maxLength={200}
                  disabled={submitting}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="signup-email">
                  <span>
                    Email
                    <RequiredStar />
                  </span>
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  placeholder="jane@example.com"
                  maxLength={320}
                  disabled={submitting}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p className="field-error" role="alert">
                    {emailError}
                  </p>
                )}
              </div>
              {questions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Signup questions</p>
                  {questions.map((question) => (
                    <QuestionField
                      key={question.id}
                      question={question}
                      value={answers[question.id] ?? ""}
                      error={questionErrors[question.id]}
                      disabled={submitting}
                      onChange={(value) => {
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: value,
                        }))
                        setQuestionErrors((prev) => {
                          if (!(question.id in prev)) return prev
                          const next = { ...prev }
                          delete next[question.id]
                          return next
                        })
                      }}
                    />
                  ))}
                </div>
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
              <p className="muted-xs text-center">
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
          </DataCardContent>
        </DataCard>
      )}
    </div>
  )
}

function QuestionField({
  question,
  value,
  error,
  disabled,
  onChange,
}: {
  question: PublicQuestion
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const inputId = `question-${question.id}`
  return (
    <div className="field-stack-sm">
      <Label htmlFor={inputId} className="text-sm">
        <span>
          {question.label}
          {question.required && <RequiredStar />}
        </span>
      </Label>
      {question.type === "Dropdown" ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive"
          )}
          disabled={disabled}
        >
          <option value="">Select an option…</option>
          {(question.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={inputId}
          type={question.type === "Phone" ? "tel" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={500}
          placeholder={
            question.type === "Phone" ? "+1 555 123 4567" : undefined
          }
          disabled={disabled}
          aria-invalid={!!error}
        />
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function validateAnswers(
  questions: PublicQuestion[],
  answers: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const question of questions) {
    const value = (answers[question.id] ?? "").trim()
    if (question.required && !value) {
      errors[question.id] = "This question is required."
      continue
    }
    if (!value) continue
    if (question.type === "Phone" && !isValidPhone(value)) {
      errors[question.id] = "Please enter a valid phone number."
    }
  }
  return errors
}

function buildAnswersPayload(
  questions: PublicQuestion[],
  answers: Record<string, string>
) {
  return questions
    .map((question) => ({
      questionId: question.id,
      value: (answers[question.id] ?? "").trim(),
    }))
    .filter((a) => a.value !== "")
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
