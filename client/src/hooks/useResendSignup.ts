import { useMutation } from "@tanstack/react-query"
import { useApi } from "./useApi"

export function useResendSignup() {
  const api = useApi()

  return useMutation({
    mutationFn: (signupId: string) => api.resendSignup(signupId),
  })
}
