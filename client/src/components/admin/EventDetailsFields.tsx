import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EventDetailsFieldsProps {
  title: string
  description: string
  location: string
  date: string
  onTitleChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onLocationChange: (v: string) => void
  onDateChange: (v: string) => void
  dateMin?: string
  disabled?: boolean
}

export function EventDetailsFields({
  title,
  description,
  location,
  date,
  onTitleChange,
  onDescriptionChange,
  onLocationChange,
  onDateChange,
  dateMin,
  disabled = false,
}: EventDetailsFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Event Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          placeholder="Sunday Service"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Weekly Sunday service"
          maxLength={2000}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          placeholder="123 Main St, Springfield"
          maxLength={500}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          min={dateMin}
          onChange={(e) => onDateChange(e.target.value)}
          required
          disabled={disabled}
        />
      </div>
    </>
  )
}
