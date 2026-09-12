import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useOrg } from "@/hooks/useOrg"
import { CalendarDays, LayoutList } from "lucide-react"
import { useApi } from "@/hooks/useApi"
import { EventList } from "@/components/admin/EventList"
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
  const [view, setView] = useState<"list" | "calendar">("list")

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="View mode"
            className="inline-flex rounded-lg border p-1"
          >
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <LayoutList className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Organization
          </Button>
        </div>
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
      {view === "list" ? (
        <EventList orgId={org.id} />
      ) : (
        <WeeklyGrid orgId={org.id} />
      )}
    </div>
  )
}
