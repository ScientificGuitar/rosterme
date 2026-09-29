import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  ArrowUp,
  CalendarPlus,
  ChevronDown,
  Link2,
  Link2Off,
  Mail,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react"
import { LoadingState, Spinner } from "@/components/ui/spinner"
import { useEventActivity } from "@/hooks/useEventActivity"

const KIND_ICON: Record<string, LucideIcon> = {
  SignupCreated: UserPlus,
  SignupConfirmed: UserCheck,
  SignupCancelled: UserX,
  SignupRemoved: UserX,
  WaitlistPromoted: ArrowUp,
  EventCreated: CalendarPlus,
  EventUpdated: Pencil,
  SlotCreated: Plus,
  SlotUpdated: Pencil,
  SlotDeleted: Trash2,
  InviteCreated: Link2,
  InviteRenamed: Link2,
  InviteRevoked: Link2Off,
  ConfirmationResent: Mail,
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function RecentActivity({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const activity = useEventActivity(eventId)

  // The feed isn't part of the event payload, so refresh it whenever the
  // event itself is refetched (slot/signup/edit mutations invalidate it).
  const eventDataUpdatedAt =
    queryClient.getQueryState(["event", eventId])?.dataUpdatedAt ?? 0
  useEffect(() => {
    if (eventDataUpdatedAt > 0) {
      void queryClient.invalidateQueries({
        queryKey: ["eventActivity", eventId],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDataUpdatedAt])

  if (activity.isLoading) {
    return (
      <LoadingState
        className="py-3"
        spinnerClassName="h-4 w-4"
        label="Loading activity..."
      />
    )
  }

  if (activity.error) {
    return <p className="muted py-3">Couldn&apos;t load recent activity.</p>
  }

  const pages = activity.data?.pages ?? []
  const items = pages.flatMap((p) => p.items)

  if (items.length === 0) {
    return <p className="muted py-3">No activity yet.</p>
  }

  return (
    <div className="-mx-4 divide-y divide-border">
      {items.map((item) => {
        const Icon = KIND_ICON[item.kind] ?? Activity
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 px-4 py-2.5"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">
                  {item.actorName ?? "Someone"}
                </span>{" "}
                <span className="text-foreground/90">{item.message}</span>
              </p>
              <p
                className="muted-xs mt-0.5"
                title={formatAbsolute(item.occurredAt)}
              >
                {formatRelative(item.occurredAt)}
              </p>
            </div>
          </div>
        )
      })}
      {activity.hasNextPage && (
        <button
          type="button"
          onClick={() => activity.fetchNextPage()}
          disabled={activity.isFetchingNextPage}
          className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {activity.isFetchingNextPage ? (
            <>
              <Spinner className="h-4 w-4" /> Loading…
            </>
          ) : (
            <>
              Load more <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
