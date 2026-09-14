import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGroups } from "@/hooks/useGroups"
import { useApi } from "@/hooks/useApi"
import { formatApiError } from "@/lib/api"
import type { Group } from "@/lib/types"

interface GroupSelectProps {
  value: string
  onChange: (groupId: string) => void
  disabled?: boolean
}

export function GroupSelect({ value, onChange, disabled = false }: GroupSelectProps) {
  const { groups, loading } = useGroups()
  const api = useApi()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    // The dialog is portalled in the DOM, but React events bubble through the
    // React tree — without this, submitting here also triggers the outer
    // event create/edit form's onSubmit (red "Select a group" toast, or even
    // an unintended event create/update + navigation that drops the selection).
    e.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const group = await api.createGroup(trimmed)
      toast.success("Group created")
      // Optimistically add to the cached list so the Select can display the
      // new value immediately, even before the refetch completes.
      queryClient.setQueryData<Group[]>(["groups"], (old) =>
        old ? [...old, group] : [group]
      )
      onChange(group.id)
      setName("")
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["groups"] })
    } catch (err) {
      toast.error(formatApiError(err, "Failed to create group"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="group">Group</Label>
      <div className="flex gap-2">
        <Select
          value={value}
          onValueChange={(id) => {
            // The dropdown has no "clear" affordance, so "" never represents
            // user intent. Ignore it: Radix renders a hidden native <select>
            // for form integration when the trigger sits inside a <form> (our
            // event create/edit forms). When the value changes programmatically
            // (see handleCreate below), it syncs that native control and
            // re-dispatches a change event — but the new <option> from the
            // optimistic cache update isn't registered yet, so the browser
            // normalizes the value to "" and Radix forwards a spurious
            // onValueChange("") that would wipe the just-made selection.
            if (!id) return
            onChange(id)
          }}
          disabled={disabled || loading}
        >
          <SelectTrigger id="group" className="w-full">
            <SelectValue
              placeholder={loading ? "Loading groups..." : "Select a group"}
            />
          </SelectTrigger>
          <SelectContent position="popper" align="start" sideOffset={4}>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setDialogOpen(true)}
          title="Create new group"
          aria-label="Create new group"
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {groups.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          No groups yet. Click + to create one first.
        </p>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Groups organize your events — e.g. volunteers, kitchen team, or
              Sunday service.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-group-name">Group Name</Label>
              <Input
                id="new-group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  setDialogOpen(false)
                  setName("")
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
