import { useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Info, Trash2, UserRoundCog, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  AdminHeaderBand,
  AdminHeaderEyebrow,
  AdminHeaderSubtitle,
  AdminHeaderTitle,
  AdminHeaderTitleBlock,
  AdminHeaderTitleRow,
  AdminPageBody,
  AdminPageCenter,
  AdminPageShell,
  CardSearchInput,
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
  DataRow,
  DataRowList,
  GhostAddRow,
  RequiredStar,
  RowIconButton,
  RowPrimary,
  RowSecondary,
} from "@/components/ui/layout"
import { LoadingState } from "@/components/ui/spinner"
import { useGroup } from "@/hooks/useGroup"
import { useApi } from "@/hooks/useApi"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChanges"
import { ApiError, formatApiError } from "@/lib/api"
import type { GroupAdmin, GroupDetail } from "@/lib/types"

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function GroupEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: group, isPending, error } = useGroup(id)
  const navigate = useNavigate()

  if (isPending && !group) {
    return <LoadingState className="min-h-[50svh]" label="Loading group..." />
  }

  if (error || !group) {
    return (
      <div className="loading-state">
        <p className="muted mb-4">
          {error instanceof Error ? error.message : "Group not found"}
        </p>
        <Button variant="outline" onClick={() => navigate("/groups")}>
          Back to Groups
        </Button>
      </div>
    )
  }

  return <GroupEditor group={group} groupId={id!} />
}

function GroupEditor({ group, groupId }: { group: GroupDetail; groupId: string }) {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState(group.name)
  const [savingName, setSavingName] = useState(false)
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [removing, setRemoving] = useState<GroupAdmin | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState(false)

  // Navigating away with an unsaved rename draft asks first.
  const isNameDirty = name.trim() !== group.name
  useUnsavedChangesPrompt(isNameDirty)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
    ])

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) return
    setSavingName(true)
    try {
      await api.updateGroup(groupId, trimmed)
      toast.success("Group renamed")
      await invalidate()
    } catch (err) {
      toast.error(formatApiError(err, "Failed to rename group"))
    } finally {
      setSavingName(false)
    }
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = addEmail.trim()
    if (!email) return
    setAddingAdmin(true)
    try {
      await api.addGroupAdmin(groupId, email)
      toast.success("Member added")
      setAddEmail("")
      setAddOpen(false)
      await invalidate()
    } catch (err) {
      if (err instanceof ApiError && err.code === "admin_exists") {
        toast.error("That person is already a member of this group.")
      } else if (err instanceof ApiError && err.code === "is_owner") {
        toast.error("The group owner is already a member.")
      } else {
        toast.error(formatApiError(err, "Failed to add member"))
      }
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async () => {
    if (!removing) return
    const admin = removing
    setRemoveBusy(true)
    try {
      await api.removeGroupAdmin(groupId, admin.id)
      toast.success("Member removed")
      setRemoving(null)
      await invalidate()
    } catch (err) {
      toast.error(formatApiError(err, "Failed to remove member"))
    } finally {
      setRemoveBusy(false)
    }
  }

  const handleDeleteGroup = async () => {
    setDeleteBusy(true)
    try {
      await api.deleteGroup(groupId)
      toast.success("Group deleted")
      setDeleteOpen(false)
      queryClient.removeQueries({ queryKey: ["group", groupId] })
      await queryClient.invalidateQueries({ queryKey: ["groups"] })
      navigate("/groups")
    } catch (err) {
      if (err instanceof ApiError && err.code === "group_has_events") {
        setDeleteOpen(false)
        setDeleteBlocked(true)
        await invalidate()
      } else {
        toast.error(formatApiError(err, "Failed to delete group"))
      }
    } finally {
      setDeleteBusy(false)
    }
  }

  const owner = group.admins.find((a) => a.role === "Owner")

  const visibleAdmins = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return group.admins
    return group.admins.filter(
      (a) =>
        (a.name ?? "").toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q)
    )
  }, [group.admins, search])

  return (
    <AdminPageShell>
      <AdminHeaderBand>
        <AdminHeaderTitleRow>
          <AdminHeaderTitleBlock>
            <AdminHeaderEyebrow>
              Group · Created {formatCreatedAt(group.createdAt)}
            </AdminHeaderEyebrow>
            <AdminHeaderTitle>{group.name}</AdminHeaderTitle>
            <AdminHeaderSubtitle>
              {group.eventCount} {group.eventCount === 1 ? "event" : "events"} ·{" "}
              {group.admins.length}{" "}
              {group.admins.length === 1 ? "admin" : "admins"}
            </AdminHeaderSubtitle>
          </AdminHeaderTitleBlock>
        </AdminHeaderTitleRow>
      </AdminHeaderBand>

      <AdminPageBody>
        <AdminPageCenter>
          <DataCard>
            <DataCardHeader>
              <DataCardTitle icon={Info}>Group details</DataCardTitle>
            </DataCardHeader>
            <DataCardDivider />
            <DataCardContent>
              <form onSubmit={handleSaveName} className="field-stack">
                <Label htmlFor="group-name">
                  <span>
                    Group Name <RequiredStar />
                  </span>
                </Label>
                <div className="flex items-start gap-2">
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={200}
                    className="max-w-sm"
                  />
                  <Button
                    type="submit"
                    disabled={
                      savingName || !name.trim() || name.trim() === group.name
                    }
                  >
                    {savingName ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DataCardContent>
          </DataCard>

          <DataCard>
            <DataCardHeader className="flex-wrap gap-y-2">
              <DataCardTitle
                icon={Users}
                actions={
                  <CardSearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search..."
                    placeholderDesktop="Search members..."
                    ariaLabel="Search members"
                    clearLabel="Clear member search"
                  />
                }
              >
                Group admins
              </DataCardTitle>
            </DataCardHeader>
            <DataCardDivider />
            <DataCardContent variant="rows">
              {group.admins.length === 0 && (
                <p className="muted py-3">
                  No admins yet. Add the people who can see and manage this
                  group&apos;s events.
                </p>
              )}
              {group.admins.length > 0 && visibleAdmins.length === 0 && (
                <p className="muted py-3">No members match your search.</p>
              )}
              {visibleAdmins.length > 0 && (
                <DataRowList>
                  {visibleAdmins.map((admin) => (
                    <DataRow
                      key={admin.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <RowPrimary>
                          {admin.name || admin.email || "Group member"}
                        </RowPrimary>
                        <RowSecondary>
                          {admin.email
                            ? admin.name
                              ? admin.email
                              : `${admin.email} · not linked to an account yet`
                            : "No email on file"}
                        </RowSecondary>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {owner && admin.id === owner.id ? (
                          <Badge title="The group owner cannot be removed">
                            Owner
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="secondary">Admin</Badge>
                            <RowIconButton
                              onClick={() => setRemoving(admin)}
                              title={`Remove ${admin.email ?? "member"}`}
                              aria-label={`Remove ${admin.email ?? "member"}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </RowIconButton>
                          </>
                        )}
                      </div>
                    </DataRow>
                  ))}
                </DataRowList>
              )}
              <GhostAddRow onClick={() => setAddOpen(true)}>
                Add member
              </GhostAddRow>
            </DataCardContent>
          </DataCard>

          <DataCard className="border-destructive/40">
            <DataCardHeader>
              <DataCardTitle icon={UserRoundCog}>Danger zone</DataCardTitle>
            </DataCardHeader>
            <DataCardDivider />
            <DataCardContent>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={deleteBusy}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete group
              </Button>
            </DataCardContent>
          </DataCard>
        </AdminPageCenter>
      </AdminPageBody>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title={`Remove ${removing?.name ?? removing?.email ?? "member"}?`}
        description="They will no longer see or manage this group's events."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={removeBusy}
        loadingLabel="Removing..."
        onConfirm={handleRemoveAdmin}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${group.name}"?`}
        description="This permanently removes the group. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteBusy}
        loadingLabel="Deleting..."
        onConfirm={handleDeleteGroup}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Enter the person&apos;s email. They will be able to see and
              manage this group&apos;s events.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAdmin} className="stack-md">
            <div className="field-stack">
              <Label htmlFor="add-member-email">
                <span>
                  Email <RequiredStar />
                </span>
              </Label>
              <Input
                id="add-member-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                required
                maxLength={320}
                placeholder="member@email.com"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingAdmin || !addEmail.trim()}
              >
                {addingAdmin ? "Adding..." : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteBlocked} onOpenChange={setDeleteBlocked}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can&apos;t delete &quot;{group.name}&quot;</DialogTitle>
            <DialogDescription>
              This group is still linked to {group.eventCount}{" "}
              {group.eventCount === 1 ? "event" : "events"}. Move or delete its
              events first, then try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteBlocked(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}