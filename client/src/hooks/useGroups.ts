import { useAuth } from "@clerk/react"
import { useQuery } from "@tanstack/react-query"
import { useApi } from "./useApi"

export function useGroups() {
  const { isSignedIn } = useAuth()
  const api = useApi()

  const { data, isLoading, error } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return {
    groups: data ?? [],
    loading: isSignedIn && isLoading,
    error: isSignedIn ? (error ?? null) : null,
  }
}
