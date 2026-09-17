import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useGroups } from "@/hooks/useGroups"
import { useApi } from "@/hooks/useApi"
import { ApiError, formatApiError } from "@/lib/api"
import type { Group } from "@/lib/types"

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function GroupsPage() {
  const { groups, loading, error } = useGroups()
  const api = useApi()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [editName, setEditName] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [blockedGroup, setBlockedGroup] = useState<Group | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? groups.filter((g) => g.name.toLowerCase().includes(q))
      : groups
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [groups, search])

  const invalidateGroups = () =>
    queryClient.invalidateQueries({ queryKey: ["groups"] })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = createName.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      await api.createGroup(trimmed)
      toast.success("Group created")
      await invalidateGroups()
      setCreateName("")
      setCreateOpen(false)
    } catch (err) {
      toast.error(formatApiError(err, "Failed to create group"))
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (group: Group) => {
    setEditing(group)
    setEditName(group.name)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const trimmed = editName.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await api.updateGroup(editing.id, trimmed)
      toast.success("Group updated")
      await invalidateGroups()
      setEditing(null)
    } catch (err) {
      toast.error(formatApiError(err, "Failed to update group"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    const group = deleting
    setDeleteBusy(true)
    try {
      await api.deleteGroup(group.id)
      toast.success("Group deleted")
      await invalidateGroups()
      setDeleting(null)
    } catch (err) {
      if (err instanceof ApiError && err.code === "group_has_events") {
        // Counts changed since the list was fetched: explain instead of a raw error.
        setDeleting(null)
        setBlockedGroup(group)
        await invalidateGroups()
      } else {
        toast.error(formatApiError(err, "Failed to delete group"))
      }
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <Card className="shell-admin">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Groups</h1>
            <p className="muted">
              Organize your events — rename groups or remove empty ones.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Group
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            aria-label="Search groups"
            className="pl-8"
          />
        </div>

        {loading && (
          <p className="loading-state muted py-8">Loading groups...</p>
        )}
        {!loading && error && (
          <p className="loading-state py-8 text-destructive">
            {formatApiError(error, "Failed to load groups")}
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="loading-state py-8">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {search.trim()
                ? "No groups match your search."
                : "No groups yet."}
            </p>
            {!search.trim() && (
              <p className="muted mt-1">
                Create your first group to organize events.
              </p>
            )}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {visible.map((group) => {
              const hasEvents = group.eventCount > 0
              return (
                <li
                  key={group.id}
                  className="flex flex-wrap items-center gap-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{group.name}</p>
                    <p className="muted-xs">
                      Created {formatCreatedAt(group.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={hasEvents ? "default" : "secondary"}
                    title={
                      hasEvents
                        ? "This group has events and cannot be deleted"
                        : "No events in this group"
                    }
                  >
                    {group.eventCount}{" "}
                    {group.eventCount === 1 ? "event" : "events"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openEdit(group)}
                    title="Rename group"
                    aria-label={`Rename ${group.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      hasEvents ? setBlockedGroup(group) : setDeleting(group)
                    }
                    title={
                      hasEvents
                        ? "Why can't this group be deleted?"
                        : `Delete ${group.name}`
                    }
                    aria-label={`Delete ${group.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
            <DialogDescription>
              Groups organize your events — e.g. volunteers, kitchen team, or
              Sunday service.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="stack-md">
            <div className="field-stack">
              <Label htmlFor="group-create-name">Group Name</Label>
              <Input
                id="group-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                maxLength={200}
                placeholder="Volunteers"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false)
                  setCreateName("")
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !createName.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Group</DialogTitle>
            <DialogDescription>
              Events in this group are not affected.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="stack-md">
            <div className="field-stack">
              <Label htmlFor="group-edit-name">Group Name</Label>
              <Input
                id="group-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  !editName.trim() ||
                  editName.trim() === editing?.name
                }
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="This permanently removes the group. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteBusy}
        loadingLabel="Deleting..."
        onConfirm={handleDelete}
      />

      <Dialog
        open={blockedGroup !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedGroup(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Can&apos;t delete &quot;{blockedGroup?.name ?? ""}&quot;
            </DialogTitle>
            <DialogDescription>
              This group is still linked to {blockedGroup?.eventCount ?? 0}{" "}
              {(blockedGroup?.eventCount ?? 0) === 1 ? "event" : "events"}. Move
              or delete its events first, then try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBlockedGroup(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
