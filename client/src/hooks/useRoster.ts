import { useQuery } from "@tanstack/react-query"
import { useApi } from "./useApi"

export function useRoster(weekStart: string) {
  const api = useApi()

  return useQuery({
    queryKey: ["events", "roster", weekStart],
    queryFn: () => api.getRoster(weekStart),
    staleTime: 5 * 60 * 1000,
  })
}
