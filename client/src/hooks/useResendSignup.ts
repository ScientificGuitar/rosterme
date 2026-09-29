import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useApi } from "./useApi"

export function useResendSignup() {
  const api = useApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (signupId: string) => api.resendSignup(signupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventActivity"] })
    },
  })
}
