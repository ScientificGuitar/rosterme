namespace RosterMeApi.Entities;

/// <summary>
/// A single entry in an event's recent-activity feed. The <see cref="Message"/>
/// is a verb phrase rendered server-side at action time (e.g. "signed up for
/// “Morning”"), so the feed is an immutable history and the frontend just
/// displays it. <see cref="ActorName"/> is who performed the action: an admin
/// display name, a volunteer name for self-service signup actions, or null for
/// system actions (e.g. waitlist promotion).
/// </summary>
public class EventActivity
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public ActivityKind Kind { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ActorClerkUserId { get; set; }
    public string? ActorName { get; set; }
    public string? VolunteerName { get; set; }
    public Guid? SignupId { get; set; }
    public DateTime OccurredAt { get; set; }

    public Event Event { get; set; } = null!;
    public Signup? Signup { get; set; }
}
