import { useUser } from "@clerk/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "./useApi"

export function useIsSuperAdmin() {
  const { user, isLoaded } = useUser()
  const role = (user?.publicMetadata as { role?: string } | undefined)?.role
  return { isSuperAdmin: role === "superAdmin", isLoaded }
}

export function useSuperAdminStats() {
  const { isSuperAdmin } = useIsSuperAdmin()
  const api = useApi()
  return useQuery({
    queryKey: ["superadmin", "stats"],
    queryFn: () => api.getSuperAdminStats(),
    enabled: isSuperAdmin,
    retry: false,
  })
}

export function useSuperAdminActivity(days = 30) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const api = useApi()
  return useQuery({
    queryKey: ["superadmin", "activity", days],
    queryFn: () => api.getSuperAdminActivity(days),
    enabled: isSuperAdmin,
    retry: false,
  })
}

export function useSuperAdminRecent(take = 10) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const api = useApi()
  return useQuery({
    queryKey: ["superadmin", "recent", take],
    queryFn: () => api.getSuperAdminRecent(take),
    enabled: isSuperAdmin,
    retry: false,
  })
}

export type OutboxSentFilter = "all" | "pending" | "sent"

export function useOutbox(filter: OutboxSentFilter, skip = 0, take = 50) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const api = useApi()
  const sent =
    filter === "all" ? undefined : filter === "sent" ? true : false
  return useQuery({
    queryKey: ["superadmin", "outbox", filter, skip, take],
    queryFn: () => api.listOutbox({ sent, skip, take }),
    enabled: isSuperAdmin,
    retry: false,
  })
}

export function useDeleteOutboxMessage() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteOutboxMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "outbox"] })
      queryClient.invalidateQueries({ queryKey: ["superadmin", "stats"] })
    },
  })
}
