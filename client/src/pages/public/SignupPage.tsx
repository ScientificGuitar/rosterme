import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth, useSignUp } from "@clerk/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GoogleIcon } from "@/components/GoogleIcon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toClerkMessage } from "@/lib/clerkError"
import { consentMetadata, recordConsent } from "@/lib/consent"

/**
 * Single-screen signup, no Clerk popup: Google goes through OAuth redirect,
 * email + password are collected inline and verified with a code on this
 * same page. Clicking either path records Terms/Privacy acceptance
 * (timestamp + terms version in Clerk `unsafeMetadata`); the Google call
 * also carries `legalAccepted: true`, so Clerk completes the signup right
 * after the Google redirect instead of showing its post-OAuth consent
 * screen.
 */
export function SignupPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()
  const { signUp } = useSignUp()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<
    "google" | "email" | "verify" | "resend" | null
  >(null)

  // The phase is derived from the Clerk resource so an OAuth redirect that
  // still needs email verification resumes at the code step instead of
  // starting over.
  const needsVerification =
    signUp.status === "missing_requirements" &&
    signUp.verifications.emailAddress.status === "unverified" &&
    signUp.verifications.emailAddress.strategy === "email_code"
  const displayEmail = signUp.emailAddress ?? email

  if (isLoaded && isSignedIn) return <Navigate to="/dashboard" replace />

  const finalizeToDashboard = async () => {
    const { error } = await signUp.finalize()
    if (error) {
      setError(toClerkMessage(error, "Signup completed but sign-in failed."))
      setPending(null)
      return
    }
    navigate("/dashboard")
  }

  const handleGoogle = async () => {
    setError(null)
    setPending("google")
    const consent = recordConsent()
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/dashboard",
      redirectCallbackUrl: "/sso-callback",
      legalAccepted: true,
      unsafeMetadata: consentMetadata(consent),
    })
    if (error) {
      setError(toClerkMessage(error, "Google signup failed. Please try again."))
      setPending(null)
    }
    // On success the browser redirects to Google — nothing else to do.
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending("email")
    const consent = recordConsent()
    const { error } = await signUp.create({
      emailAddress: email.trim(),
      password,
      legalAccepted: true,
      unsafeMetadata: consentMetadata(consent),
    })
    if (error) {
      setError(toClerkMessage(error, "Signup failed. Please try again."))
      setPending(null)
      return
    }
    if (signUp.status === "complete") {
      await finalizeToDashboard()
      return
    }
    const { error: sendError } = await signUp.verifications.sendEmailCode()
    if (sendError) {
      setError(toClerkMessage(sendError, "Could not send verification email."))
    }
    setPending(null)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending("verify")
    const { error } = await signUp.verifications.verifyEmailCode({
      code: code.trim(),
    })
    if (error) {
      setError(toClerkMessage(error, "Invalid code. Please try again."))
      setPending(null)
      return
    }
    if (signUp.status === "complete") {
      await finalizeToDashboard()
      return
    }
    setPending(null)
    setError("Additional information is required to finish signup.")
  }

  const handleResend = async () => {
    setError(null)
    setPending("resend")
    const { error } = await signUp.verifications.sendEmailCode()
    if (error) {
      setError(toClerkMessage(error, "Could not resend the code."))
    }
    setPending(null)
  }

  const busy = pending !== null

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!needsVerification ? (
            <>
              <Button
                className="w-full"
                size="lg"
                disabled={busy}
                onClick={handleGoogle}
              >
                <GoogleIcon />
                {pending === "google"
                  ? "Redirecting to Google…"
                  : "Continue with Google"}
              </Button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleEmailSignup} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    disabled={busy}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={busy}
                >
                  {pending === "email" ? "Creating account…" : "Sign up"}
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerify} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                We sent a verification code to{" "}
                <span className="font-medium text-foreground">
                  {displayEmail}
                </span>
                . Enter it below to finish creating your account.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="signup-code">Verification code</Label>
                <Input
                  id="signup-code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={code}
                  disabled={busy}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={busy}
              >
                {pending === "verify" ? "Verifying…" : "Verify email"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={handleResend}
              >
                {pending === "resend" ? "Sending…" : "Resend code"}
              </Button>
            </form>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to the RosterMe{" "}
            <Link
              to="/terms-of-service"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => navigate("/signin")}
            >
              Sign in
            </button>
          </p>
        </CardContent>
      </Card>
      {/* Required for Clerk bot protection on custom signup flows. */}
      <div id="clerk-captcha" />
    </div>
  )
}