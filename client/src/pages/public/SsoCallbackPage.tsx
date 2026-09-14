import { HandleSSOCallback } from "@clerk/react"
import { useNavigate } from "react-router-dom"

/** Landing spot for the Google OAuth redirect; completes the signup. */
export function SsoCallbackPage() {
  const navigate = useNavigate()

  return (
    <HandleSSOCallback
      navigateToApp={({ decorateUrl }) => {
        const destination = decorateUrl("/dashboard")
        if (destination.startsWith("http")) {
          window.location.href = destination
          return
        }
        navigate(destination)
      }}
      navigateToSignIn={() => navigate("/signin")}
      navigateToSignUp={() => navigate("/signup")}
    />
  )
}
