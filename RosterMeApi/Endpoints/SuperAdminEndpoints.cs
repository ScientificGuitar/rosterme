using System.ComponentModel.DataAnnotations;

using Microsoft.EntityFrameworkCore;

using RosterMeApi.Data;
using RosterMeApi.Entities;
using RosterMeApi.Validation;

namespace RosterMeApi.Endpoints;

public static class SuperAdminEndpoints
{
    public static WebApplication MapSuperAdminEndpoints(this WebApplication app)
    {
        var superadmin = app.MapGroup("/api/superadmin")
            .RequireAuthorization("SuperAdmin")
            .AddEndpointFilter<ValidateDtoFilter>();

        superadmin.MapGet("/stats", GetStats)
            .Produces<SuperAdminStatsResponse>()
            .Produces(401)
            .Produces(403);
        superadmin.MapGet("/activity", GetActivity)
            .Produces<SuperAdminActivityResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(403);
        superadmin.MapGet("/recent", GetRecent)
            .Produces<SuperAdminRecentResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(403);
        superadmin.MapGet("/outbox", ListOutbox)
            .Produces<SuperAdminOutboxListResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(403);
        superadmin.MapDelete("/outbox/{id:guid}", DeleteOutboxMessage)
            .Produces(204)
            .Produces(401)
            .Produces(403)
            .Produces(404)
            .Produces(409);

        return app;
    }

    private static async Task<IResult> GetStats(AppDbContext db, CancellationToken ct)
    {
        var groups = await db.Groups.CountAsync(ct);
        var events = await db.Events.CountAsync(ct);
        var slots = await db.TimeSlots.CountAsync(ct);
        var signups = await db.Signups.CountAsync(ct);
        var inviteLinks = await db.InviteLinks.CountAsync(ct);
        var owners = await db.Groups.Select(g => g.GroupOwner).Distinct().CountAsync(ct);
        var emailsPending = await db.EmailMessages.CountAsync(m => !m.Sent, ct);
        var emailsSent = await db.EmailMessages.CountAsync(m => m.Sent, ct);

        var byStatusRaw = await db.Signups
            .GroupBy(s => s.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var byStatus = byStatusRaw.ToDictionary(x => x.Status.ToString(), x => x.Count);

        var capacity = await db.TimeSlots.SumAsync(s => (long)s.Capacity, ct);
        var filled = await db.Signups.CountAsync(
            s => s.Status == SignupStatus.Pending || s.Status == SignupStatus.Confirmed, ct);
        var fillRate = capacity == 0 ? 0 : (double)filled / capacity;

        return Results.Ok(new SuperAdminStatsResponse(
            groups, events, slots, signups, inviteLinks, owners,
            emailsPending, emailsSent, fillRate, byStatus));
    }

    private static async Task<IResult> GetActivity(
        [AsParameters] SuperAdminActivityQuery query,
        AppDbContext db,
        CancellationToken ct)
    {
        var days = query.Days ?? 30;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = today.AddDays(-(days - 1));

        var signups = await db.Signups
            .Where(s => s.CreatedAt >= start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc))
            .Select(s => new { s.CreatedAt })
            .ToListAsync(ct);
        var events = await db.Events.ToListAsync(ct);

        var signupsPerDay = Enumerable.Range(0, days)
            .Select(i => start.AddDays(i))
            .Select(d => new DayCount(
                d.ToString("yyyy-MM-dd"),
                signups.Count(s => DateOnly.FromDateTime(s.CreatedAt.ToUniversalTime()) == d)))
            .ToList();
        var eventsPerDay = Enumerable.Range(0, days)
            .Select(i => start.AddDays(i))
            .Select(d => new DayCount(
                d.ToString("yyyy-MM-dd"),
                events.Count(e => e.Date == d)))
            .ToList();

        return Results.Ok(new SuperAdminActivityResponse(signupsPerDay, eventsPerDay));
    }

    private static async Task<IResult> GetRecent(
        [AsParameters] SuperAdminRecentQuery query,
        AppDbContext db,
        CancellationToken ct)
    {
        var take = query.Take ?? 10;

        var groups = await db.Groups
            .OrderByDescending(g => g.CreatedAt)
            .Take(take)
            .Select(g => new SuperAdminGroupRow(g.Id, g.Name, g.GroupOwner, g.CreatedAt))
            .ToListAsync(ct);
        var events = await db.Events
            .OrderByDescending(e => e.CreatedAt)
            .Take(take)
            .Select(e => new SuperAdminEventRow(e.Id, e.GroupId, e.Title, e.Date, e.CreatedAt))
            .ToListAsync(ct);
        var signups = await db.Signups
            .OrderByDescending(s => s.CreatedAt)
            .Take(take)
            .Select(s => new SuperAdminSignupRow(
                s.Id, s.TimeSlotId, s.VolunteerName, s.Email, s.Status.ToString(), s.CreatedAt))
            .ToListAsync(ct);

        return Results.Ok(new SuperAdminRecentResponse(groups, events, signups));
    }

    private static async Task<IResult> ListOutbox(
        [AsParameters] SuperAdminOutboxQuery query,
        AppDbContext db,
        CancellationToken ct)
    {
        var take = query.Take ?? 50;
        var skip = query.Skip ?? 0;

        var q = db.EmailMessages.AsQueryable();
        if (query.Sent.HasValue)
            q = q.Where(m => m.Sent == query.Sent.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(m => m.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(m => new SuperAdminOutboxRow(m.Id, m.To, m.Subject, m.Sent, m.CreatedAt, m.SentAt))
            .ToListAsync(ct);

        return Results.Ok(new SuperAdminOutboxListResponse(total, skip, take, items));
    }

    private static async Task<IResult> DeleteOutboxMessage(Guid id, AppDbContext db, CancellationToken ct)
    {
        var message = await db.EmailMessages.FindAsync([id], ct);
        if (message is null)
            return Results.NotFound(new { error = "Email message not found." });

        if (message.Sent)
            return Results.Conflict(new
            {
                error = "Sent email messages cannot be deleted; history is preserved.",
                code = "already_sent"
            });

        db.EmailMessages.Remove(message);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
}

public sealed class SuperAdminActivityQuery
{
    [Range(1, 90)]
    public int? Days { get; set; }
}

public sealed class SuperAdminRecentQuery
{
    [Range(1, 50)]
    public int? Take { get; set; }
}

public sealed class SuperAdminOutboxQuery
{
    public bool? Sent { get; set; }

    [Range(0, int.MaxValue)]
    public int? Skip { get; set; }

    [Range(1, 100)]
    public int? Take { get; set; }
}

public sealed record SuperAdminStatsResponse(
    int Groups,
    int Events,
    int Slots,
    int Signups,
    int InviteLinks,
    int Owners,
    int EmailsPending,
    int EmailsSent,
    double CapacityFillRate,
    Dictionary<string, int> SignupsByStatus);

public sealed record DayCount(string Date, int Count);

public sealed record SuperAdminActivityResponse(
    List<DayCount> SignupsPerDay,
    List<DayCount> EventsPerDay);

public sealed record SuperAdminGroupRow(Guid Id, string Name, string GroupOwner, DateTime CreatedAt);

public sealed record SuperAdminEventRow(Guid Id, Guid GroupId, string Title, DateOnly Date, DateTime CreatedAt);

public sealed record SuperAdminSignupRow(
    Guid Id, Guid TimeSlotId, string VolunteerName, string Email, string Status, DateTime CreatedAt);

public sealed record SuperAdminRecentResponse(
    List<SuperAdminGroupRow> Groups,
    List<SuperAdminEventRow> Events,
    List<SuperAdminSignupRow> Signups);

public sealed record SuperAdminOutboxRow(
    Guid Id, string To, string Subject, bool Sent, DateTime CreatedAt, DateTime? SentAt);

public sealed record SuperAdminOutboxListResponse(
    int Total, int Skip, int Take, List<SuperAdminOutboxRow> Items);
