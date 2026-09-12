import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useOrg } from "@/hooks/useOrg"
import { useApi } from "@/hooks/useApi"
import { WeeklyGrid } from "@/components/admin/WeeklyGrid"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function Dashboard() {
  const { org, loading, error: orgError } = useOrg()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading...</div>
    )
  }

  if (orgError) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-muted-foreground">
          {orgError instanceof Error
            ? orgError.message
            : "Failed to load organization"}
        </p>
      </div>
    )
  }

  if (!org) {
    if (!showCreateOrg) {
      return (
        <div className="mx-auto max-w-md py-12 text-center">
          <h2 className="mb-2 text-xl font-bold">Welcome to RosterMe</h2>
          <p className="mb-6 text-muted-foreground">
            Create an organization to get started with volunteer scheduling.
          </p>
          <Button onClick={() => setShowCreateOrg(true)}>
            Create Organization
          </Button>
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-md py-12">
        <h2 className="mb-4 text-xl font-bold">Create Organization</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setCreating(true)
            try {
              await api.createOrganization(orgName)
              toast.success("Organization created")
              queryClient.invalidateQueries({ queryKey: ["org"] })
            } catch (e) {
              const msg =
                e instanceof Error ? e.message : "Something went wrong"
              setError(msg)
              toast.error(msg)
            } finally {
              setCreating(false)
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              Organization Name
            </label>
            <input
              id="name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
              placeholder="My Church"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateOrg(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    )
  }

  const handleDeleteOrganization = async () => {
    if (!org) return
    setDeleting(true)
    try {
      await api.deleteOrganization(org.id)
      toast.success("Organization deleted")
      queryClient.invalidateQueries({ queryKey: ["org"] })
      navigate("/dashboard")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to delete organization"
      )
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Organization
        </Button>
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete organization?"
          description={
            <>
              This will permanently delete &ldquo;{org.name}&rdquo; and all
              associated events, slots, and signups. This action cannot be
              undone.
            </>
          }
          confirmLabel="Delete"
          variant="destructive"
          isLoading={deleting}
          loadingLabel="Deleting..."
          onConfirm={handleDeleteOrganization}
        />
      </div>
      <WeeklyGrid orgId={org.id} />
    </div>
  )
}
