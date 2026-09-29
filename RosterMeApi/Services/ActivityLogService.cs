using System.Security.Claims;

using RosterMeApi.Data;
using RosterMeApi.Entities;

namespace RosterMeApi.Services;

/// <summary>
/// Who performed an activity: an admin (<see cref="ClerkUserId"/> set), a
/// volunteer acting via a public link (<see cref="DisplayName"/> only), or the
/// system (both null).
/// </summary>
public sealed record ActivityActor(string? ClerkUserId, string? DisplayName)
{
    /// <summary>Resolves the admin behind an authenticated request from JWT claims.</summary>
    public static ActivityActor From(HttpContext http)
    {
        var userId = http.User.FindFirstValue("sub");
        var name = http.User.FindFirstValue("name")?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            var first = http.User.FindFirstValue("first_name")?.Trim();
            var last = http.User.FindFirstValue("last_name")?.Trim();
            name = string.Join(" ", new[] { first, last }.Where(s => !string.IsNullOrEmpty(s))).Trim();
        }
        if (string.IsNullOrEmpty(name))
            name = http.User.FindFirstValue("email")?.Trim();
        return new ActivityActor(userId, string.IsNullOrEmpty(name) ? null : name);
    }

    /// <summary>A volunteer acting through a public invite/management link.</summary>
    public static ActivityActor Volunteer(string name) =>
        new(null, string.IsNullOrWhiteSpace(name) ? null : name.Trim());

    public static readonly ActivityActor System = new(null, null);
}

/// <summary>
/// Append-only per-event activity feed. Adding a new activity is one line at
/// the action site:
/// <code>activity.Log(eventId, ActivityKind.SomeAction, "did something", ActivityActor.From(http));</code>
/// Rows are added to the DbContext without saving so they commit atomically
/// with the action (and its email outbox row) in the caller's transaction.
/// </summary>
public class ActivityLogService
{
    private readonly AppDbContext _db;

    public ActivityLogService(AppDbContext db)
    {
        _db = db;
    }

    public void Log(
        Guid eventId,
        ActivityKind kind,
        string message,
        ActivityActor? actor = null,
        string? volunteerName = null,
        Guid? signupId = null)
    {
        actor ??= ActivityActor.System;
        _db.EventActivities.Add(new EventActivity
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Kind = kind,
            Message = message.Trim(),
            ActorClerkUserId = actor.ClerkUserId,
            ActorName = actor.DisplayName,
            VolunteerName = string.IsNullOrWhiteSpace(volunteerName) ? null : volunteerName.Trim(),
            SignupId = signupId,
            OccurredAt = DateTime.UtcNow
        });
    }
}
