import { useQuery } from "@tanstack/react-query"
import { useApi } from "./useApi"

export function useGroup(id: string | undefined) {
  const api = useApi()

  return useQuery({
    queryKey: ["group", id],
    queryFn: () => api.getGroup(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}