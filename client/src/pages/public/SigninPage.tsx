import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth, useSignIn } from "@clerk/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GoogleIcon } from "@/components/GoogleIcon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toClerkMessage } from "@/lib/clerkError"

type MfaStrategy = "totp" | "backup_code" | "email_code" | "phone_code"

const MFA_LABELS: Record<MfaStrategy, string> = {
  totp: "Authenticator app",
  backup_code: "Backup code",
  email_code: "Email code",
  phone_code: "SMS code",
}

function isMfaStrategy(s: string): s is MfaStrategy {
  return s in MFA_LABELS
}

/**
 * Custom sign-in mirroring `/signup`: Google via OAuth redirect, email +
 * password inline, second-factor step on the same page when required. No
 * Clerk popup.
 */
export function SigninPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()
  const { signIn } = useSignIn()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy>("totp")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<
    "google" | "password" | "verify" | "send" | null
  >(null)

  // The phase is derived from the Clerk resource so an OAuth redirect that
  // still needs a second factor resumes at this step instead of starting over.
  const mfaStrategies = signIn.supportedSecondFactors
    .map((f) => f.strategy)
    .filter(isMfaStrategy)
  const needsMfa = signIn.status === "needs_second_factor"
  const effectiveMfaStrategy: MfaStrategy =
    mfaStrategies.length > 0 && mfaStrategies.includes(mfaStrategy)
      ? mfaStrategy
      : (mfaStrategies[0] ?? "totp")
  const needsCodeDelivery =
    effectiveMfaStrategy === "email_code" ||
    effectiveMfaStrategy === "phone_code"

  if (isLoaded && isSignedIn) return <Navigate to="/dashboard" replace />

  const finalizeToDashboard = async () => {
    const { error } = await signIn.finalize()
    if (error) {
      setError(toClerkMessage(error, "Sign-in completed but failed."))
      setPending(null)
      return
    }
    navigate("/dashboard")
  }

  const handleGoogle = async () => {
    setError(null)
    setPending("google")
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/dashboard",
      redirectCallbackUrl: "/sso-callback",
    })
    if (error) {
      setError(toClerkMessage(error, "Google sign-in failed."))
      setPending(null)
    }
    // On success the browser redirects to Google — nothing else to do.
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending("password")
    const { error } = await signIn.password({
      identifier: email.trim(),
      password,
    })
    if (error) {
      setError(toClerkMessage(error, "Sign-in failed. Please try again."))
      setPending(null)
      return
    }
    if (signIn.status === "complete") {
      await finalizeToDashboard()
      return
    }
    if (signIn.status === "needs_second_factor") {
      const strategies = signIn.supportedSecondFactors
        .map((f) => f.strategy)
        .filter(isMfaStrategy)
      if (strategies.length === 0) {
        setPending(null)
        return
      }
      setMfaStrategy(strategies[0])
      setCode("")
      setCodeSent(false)
      setPending(null)
      return
    }
    setPending(null)
    setError("Sign-in could not be completed.")
  }

  const handleSendMfaCode = async () => {
    setError(null)
    setPending("send")
    const { error } =
      effectiveMfaStrategy === "email_code"
        ? await signIn.mfa.sendEmailCode()
        : await signIn.mfa.sendPhoneCode()
    if (error) {
      setError(toClerkMessage(error, "Could not send the code."))
    } else {
      setCodeSent(true)
    }
    setPending(null)
  }

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending("verify")
    const trimmed = code.trim()
    const { error } =
      effectiveMfaStrategy === "totp"
        ? await signIn.mfa.verifyTOTP({ code: trimmed })
        : effectiveMfaStrategy === "backup_code"
          ? await signIn.mfa.verifyBackupCode({ code: trimmed })
          : effectiveMfaStrategy === "email_code"
            ? await signIn.mfa.verifyEmailCode({ code: trimmed })
            : await signIn.mfa.verifyPhoneCode({ code: trimmed })
    if (error) {
      setError(toClerkMessage(error, "Invalid code. Please try again."))
      setPending(null)
      return
    }
    if (signIn.status === "complete") {
      await finalizeToDashboard()
      return
    }
    setPending(null)
    setError("Sign-in could not be completed.")
  }

  const busy = pending !== null

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!needsMfa ? (
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

              <form onSubmit={handlePassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email address</Label>
                  <Input
                    id="signin-email"
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
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Your password"
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
                  {pending === "password" ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </>
          ) : mfaStrategies.length === 0 ? (
            <p className="text-sm text-destructive">
              Additional verification is required for this account.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your account needs an extra verification step.
              </p>
              {mfaStrategies.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {mfaStrategies.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={effectiveMfaStrategy === s ? "default" : "outline"}
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setMfaStrategy(s)
                        setCode("")
                        setCodeSent(false)
                        setError(null)
                      }}
                    >
                      {MFA_LABELS[s]}
                    </Button>
                  ))}
                </div>
              )}
              {needsCodeDelivery && !codeSent ? (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={busy}
                  onClick={handleSendMfaCode}
                >
                  {pending === "send"
                    ? "Sending…"
                    : `Send code via ${MFA_LABELS[effectiveMfaStrategy]}`}
                </Button>
              ) : (
                <form onSubmit={handleVerifyMfa} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-mfa-code">
                      {MFA_LABELS[effectiveMfaStrategy]} code
                    </Label>
                    <Input
                      id="signin-mfa-code"
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter code"
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
                    {pending === "verify" ? "Verifying…" : "Verify"}
                  </Button>
                  {needsCodeDelivery && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      disabled={busy}
                      onClick={handleSendMfaCode}
                    >
                      {pending === "send" ? "Sending…" : "Resend code"}
                    </Button>
                  )}
                </form>
              )}
            </div>
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
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => navigate("/signup")}
            >
              Sign up
            </button>
          </p>
        </CardContent>
      </Card>
      {/* Required for Clerk bot protection on custom flows. */}
      <div id="clerk-captcha" />
    </div>
  )
}