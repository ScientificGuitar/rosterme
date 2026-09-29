import { useAuth } from "@clerk/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useApi } from "./useApi"

/**
 * Ownership-scoped report aggregates. The filter arrays are part of the
 * query key (sorted, so reorderings don't refetch) — changing the group
 * or event selection refetches and the charts update live. The previous
 * payload is kept while refetching so charts don't flash empty.
 */
export function useReports(groupIds: string[], eventIds: string[], days = 30) {
  const { isSignedIn } = useAuth()
  const api = useApi()
  const sortedGroups = [...groupIds].sort()
  const sortedEvents = [...eventIds].sort()

  return useQuery({
    queryKey: ["reports", sortedGroups, sortedEvents, days],
    queryFn: () =>
      api.getReports({
        groupIds: sortedGroups,
        eventIds: sortedEvents,
        days,
      }),
    enabled: isSignedIn,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: false,
  })
}
