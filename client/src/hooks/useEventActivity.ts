import { useInfiniteQuery } from "@tanstack/react-query"
import { useApi } from "./useApi"

export const ACTIVITY_FIRST_PAGE = 5
export const ACTIVITY_NEXT_PAGE = 10

export function useEventActivity(eventId: string | undefined) {
  const api = useApi()

  return useInfiniteQuery({
    queryKey: ["eventActivity", eventId],
    queryFn: ({ pageParam }) =>
      api.getEventActivity(eventId!, pageParam.skip, pageParam.take),
    initialPageParam: { skip: 0, take: ACTIVITY_FIRST_PAGE },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      const skip = allPages.reduce((n, p) => n + p.items.length, 0)
      return { skip, take: ACTIVITY_NEXT_PAGE }
    },
    enabled: !!eventId,
    staleTime: 30 * 1000,
  })
}
