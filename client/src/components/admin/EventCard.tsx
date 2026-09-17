import { Link } from "react-router-dom"
import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CapacityBar } from "@/components/ui/capacity-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetaRow } from "@/components/ui/layout"
import { activeSignupCount, formatTime } from "@/lib/utils"
import type { RosterEvent } from "@/lib/types"

interface EventCardProps {
  event: RosterEvent
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <CardTitle className="font-semibold">
          <Link to={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </CardTitle>
        <p className="muted-xs">{event.groupName}</p>
      </CardHeader>
      <CardContent className="field-stack">
        {event.location && (
          <MetaRow title={event.location}>
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </MetaRow>
        )}
        {event.slots.length === 0 && <p className="muted-xs">No slots</p>}
        {event.slots.map((slot) => {
          const count = activeSignupCount(slot.signups)
          return (
            <div key={slot.id} className="row-card-sm text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{slot.label}</div>
                  <div className="text-muted-foreground">
                    {formatTime(slot.startTime)}-{formatTime(slot.endTime)}
                  </div>
                </div>
                <Badge
                  variant={count >= slot.capacity ? "destructive" : "secondary"}
                  size="xs"
                >
                  {count}/{slot.capacity}
                </Badge>
              </div>
              <CapacityBar
                filled={count}
                capacity={slot.capacity}
                className="mt-1.5 h-1.5"
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
