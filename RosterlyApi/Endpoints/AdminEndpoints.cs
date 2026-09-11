using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

using Microsoft.EntityFrameworkCore;

using RosterlyApi.Data;
using RosterlyApi.Entities;
using RosterlyApi.Services;
using RosterlyApi.Validation;
using Microsoft.Extensions.Options;

namespace RosterlyApi.Endpoints;

public static class AdminEndpoints
{
    public static WebApplication MapAdminEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api").RequireAuthorization().AddEndpointFilter<ValidateDtoFilter>();

        admin.MapPost("/organizations", CreateOrganization)
            .Produces<OrganizationResponse>(201)
            .Produces(400)
            .Produces(401);
        admin.MapGet("/organizations/{id}", GetOrganization)
            .Produces<OrganizationResponse>()
            .Produces(401)
            .Produces(404);
        admin.MapDelete("/organizations/{id}", DeleteOrganization)
            .Produces(204)
            .Produces(401)
            .Produces(404);

        admin.MapPost("/organizations/{orgId}/events", CreateEvent)
            .Produces<EventResponse>(201)
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapGet("/organizations/{orgId}/events", ListEvents)
            .Produces<IEnumerable<EventWithSlotsResponse>>()
            .Produces(401)
            .Produces(404);
        admin.MapPut("/events/{id}", UpdateEvent)
            .Produces<EventResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapDelete("/events/{id}", DeleteEvent)
            .Produces(204)
            .Produces(401)
            .Produces(404);

        admin.MapPost("/events/{eventId}/slots", CreateSlot)
            .Produces<TimeSlotResponse>(201)
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapPut("/events/{eventId}/slots/{slotId}", UpdateSlot)
            .Produces<TimeSlotResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapDelete("/events/{eventId}/slots/{slotId}", DeleteSlot)
            .Produces(204)
            .Produces(401)
            .Produces(404);

        admin.MapGet("/organizations/{orgId}/roster", GetRoster)
            .Produces<IEnumerable<RosterEventResponse>>()
            .Produces(401)
            .Produces(404);

        admin.MapDelete("/signups/{id}", DeleteSignup)
            .Produces(204)
            .Produces(401)
            .Produces(404);

        admin.MapGet("/events/{id}", GetEvent)
            .Produces<RosterEventResponse>()
            .Produces(401)
            .Produces(404);

        admin.MapPost("/events/{eventId}/invite-links", CreateInviteLink)
            .Produces<InviteLinkResponse>()
            .Produces(401)
            .Produces(404);
        admin.MapGet("/events/{eventId}/invite-links", ListInviteLinks)
            .Produces<IEnumerable<InviteLinkResponse>>()
            .Produces(401)
            .Produces(404);
        admin.MapPut("/invite-links/{id}/revoke", RevokeInviteLink)
            .Produces(204)
            .Produces(401)
            .Produces(404);

        return app;
    }

    private static string GetUserId(HttpContext http) =>
        http.User.FindFirstValue("sub") ?? throw new UnauthorizedAccessException();

    private static string Norm(string value) => value.Trim();

    private static string? NormNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static async Task<Organization?> GetOwnedOrganization(AppDbContext db, Guid orgId, string userId, CancellationToken ct)
    {
        return await db.Organizations
            .FirstOrDefaultAsync(o => o.Id == orgId && o.ClerkUserId == userId, ct);
    }

    // --- Organization ---

    private static async Task<IResult> CreateOrganization(CreateOrganizationRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = Norm(request.Name),
            ClerkUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        db.Organizations.Add(org);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/organizations/{org.Id}", new OrganizationResponse(org.Id, org.Name, org.CreatedAt));
    }

    private static async Task<IResult> GetOrganization(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);

        var org = await db.Organizations
            .FirstOrDefaultAsync(o => o.Id == id && o.ClerkUserId == userId, ct);

        if (org is null) return Results.NotFound();

        return Results.Ok(new OrganizationResponse(org.Id, org.Name, org.CreatedAt));
    }

    private static async Task<IResult> DeleteOrganization(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var org = await GetOwnedOrganization(db, id, userId, ct);
        if (org is null) return Results.NotFound();

        db.Organizations.Remove(org);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    // --- Events ---

    private static async Task<IResult> CreateEvent(Guid orgId, CreateEventRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var org = await GetOwnedOrganization(db, orgId, userId, ct);
        if (org is null) return Results.NotFound();

        var evt = new Event
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            Title = Norm(request.Title),
            Description = NormNull(request.Description),
            Location = NormNull(request.Location),
            Date = request.Date,
            CreatedAt = DateTime.UtcNow
        };

        db.Events.Add(evt);

        if (request.Slots is not null)
        {
            foreach (var s in request.Slots)
            {
                db.TimeSlots.Add(new TimeSlot
                {
                    Id = Guid.NewGuid(),
                    EventId = evt.Id,
                    Label = Norm(s.Label),
                    StartTime = s.StartTime,
                    EndTime = s.EndTime,
                    Capacity = s.Capacity,
                    AllowWaitlist = s.AllowWaitlist ?? true,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/events/{evt.Id}", new EventResponse(
            evt.Id, evt.OrganizationId, evt.Title, evt.Description, evt.Location, evt.Date, evt.CreatedAt
        ));
    }

    private static async Task<IResult> ListEvents(Guid orgId, DateOnly from, DateOnly to, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);

        var orgExists = await db.Organizations.AnyAsync(o => o.Id == orgId && o.ClerkUserId == userId, ct);
        if (!orgExists) return Results.NotFound();

        var events = await db.Events
            .Where(e => e.OrganizationId == orgId && e.Date >= from && e.Date <= to)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .OrderBy(e => e.Date)
            .ToListAsync(ct);

        return Results.Ok(events.Select(e => new EventWithSlotsResponse(
            e.Id, e.OrganizationId, e.Title, e.Description, e.Location, e.Date, e.CreatedAt,
            e.TimeSlots.OrderBy(s => s.StartTime).Select(s => new TimeSlotResponse(s.Id, s.EventId, s.Label, e.Date.ToDateTime(s.StartTime), e.Date.ToDateTime(s.EndTime), s.Capacity, s.Signups.Count(sg => sg.Status == SignupStatus.Pending || sg.Status == SignupStatus.Confirmed), s.AllowWaitlist))
        )));
    }

    private static async Task<IResult> UpdateEvent(Guid id, UpdateEventRequest request, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Organization)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .FirstOrDefaultAsync(e => e.Id == id && e.Organization.ClerkUserId == userId, ct);

        if (evt is null) return Results.NotFound();

        if (request.Title is not null)
            evt.Title = Norm(request.Title);
        if (request.Description is not null)
            evt.Description = NormNull(request.Description);
        if (request.Location is not null)
            evt.Location = NormNull(request.Location);
        if (request.Date is not null) evt.Date = request.Date.Value;

        var increasedSlotIds = new List<Guid>();

        if (request.Slots is not null)
        {
            var seenIds = new HashSet<Guid>();
            foreach (var s in request.Slots)
            {
                if (s.Id is { } sid && !seenIds.Add(sid))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["Slots"] = ["Duplicate slot id in request."]
                    });
                }
            }

            var existingById = evt.TimeSlots.ToDictionary(s => s.Id);
            // Snapshot before mutating: newly added slots get pulled into the
            // tracked evt.TimeSlots collection via relationship fixup and must
            // not be treated as deletion candidates below.
            var originalSlots = evt.TimeSlots.ToList();
            var requestedIds = new HashSet<Guid>(
                request.Slots.Where(s => s.Id.HasValue).Select(s => s.Id!.Value));

            if (requestedIds.Any(rid => !existingById.ContainsKey(rid)))
            {
                return Results.NotFound();
            }

            for (var i = 0; i < request.Slots.Count; i++)
            {
                var s = request.Slots[i];
                if (s.EndTime <= s.StartTime)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        [$"Slots[{i}].EndTime"] = new[] { "EndTime must be after StartTime." }
                    });
                }

                if (s.Id is { } sid)
                {
                    var slot = existingById[sid];
                    var signupCount = slot.Signups.Count(
                        sg => sg.Status == SignupStatus.Pending || sg.Status == SignupStatus.Confirmed);
                    if (s.Capacity < signupCount)
                    {
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            [$"Slots[{i}].Capacity"] = new[] { $"Capacity cannot be less than the current signup count ({signupCount})." }
                        });
                    }

                    var oldCapacity = slot.Capacity;
                    slot.Label = Norm(s.Label);
                    slot.StartTime = s.StartTime;
                    slot.EndTime = s.EndTime;
                    slot.Capacity = s.Capacity;
                    if (s.AllowWaitlist.HasValue) slot.AllowWaitlist = s.AllowWaitlist.Value;
                    if (slot.Capacity > oldCapacity)
                        increasedSlotIds.Add(slot.Id);
                }
                else
                {
                    db.TimeSlots.Add(new TimeSlot
                    {
                        Id = Guid.NewGuid(),
                        EventId = evt.Id,
                        Label = Norm(s.Label),
                        StartTime = s.StartTime,
                        EndTime = s.EndTime,
                        Capacity = s.Capacity,
                        AllowWaitlist = s.AllowWaitlist ?? true,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            foreach (var slot in originalSlots.Where(s => !requestedIds.Contains(s.Id)))
            {
                db.TimeSlots.Remove(slot);
            }
        }

        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await db.Database.BeginTransactionAsync(ct);

            // Deterministic ordering avoids deadlocks between concurrent multi-slot updates.
            foreach (var slotId in increasedSlotIds.OrderBy(id => id))
                await SlotAdvisoryLock.AcquireAsync(db, slotId, ct);

            await db.SaveChangesAsync(ct);

            foreach (var slotId in increasedSlotIds)
                await WaitlistService.PromoteWaitlistAsync(db, outbox, emailOptions, slotId, ct);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.Ok(new EventResponse(evt.Id, evt.OrganizationId, evt.Title, evt.Description, evt.Location, evt.Date, evt.CreatedAt));
        });
    }

    private static async Task<IResult> DeleteEvent(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Organization)
            .FirstOrDefaultAsync(e => e.Id == id && e.Organization.ClerkUserId == userId, ct);

        if (evt is null) return Results.NotFound();

        db.Events.Remove(evt);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    // --- Time Slots ---

    private static async Task<IResult> CreateSlot(Guid eventId, CreateSlotRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Organization)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.Organization.ClerkUserId == userId, ct);

        if (evt is null) return Results.NotFound();

        var slot = new TimeSlot
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Label = Norm(request.Label),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Capacity = request.Capacity,
            AllowWaitlist = request.AllowWaitlist ?? true,
            CreatedAt = DateTime.UtcNow
        };

        db.TimeSlots.Add(slot);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/events/{eventId}/slots/{slot.Id}", new TimeSlotResponse(slot.Id, slot.EventId, slot.Label, evt.Date.ToDateTime(slot.StartTime), evt.Date.ToDateTime(slot.EndTime), slot.Capacity, 0, slot.AllowWaitlist));
    }

    private static async Task<IResult> UpdateSlot(Guid eventId, Guid slotId, UpdateSlotRequest request, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var slot = await db.TimeSlots
            .Include(s => s.Event).ThenInclude(e => e.Organization)
            .FirstOrDefaultAsync(s => s.Id == slotId && s.EventId == eventId && s.Event.Organization.ClerkUserId == userId, ct);

        if (slot is null) return Results.NotFound();

        var oldCapacity = slot.Capacity;

        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await db.Database.BeginTransactionAsync(ct);

            await SlotAdvisoryLock.AcquireAsync(db, slotId, ct);

            // Re-count under the lock so capacity validation sees the serialized state.
            var signupCount = await db.Signups.CountAsync(
                s => s.TimeSlotId == slotId
                    && (s.Status == SignupStatus.Pending || s.Status == SignupStatus.Confirmed), ct);

            if (request.Capacity is not null && request.Capacity.Value < signupCount)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["Capacity"] = new[] { $"Capacity cannot be less than the current signup count ({signupCount})." }
                });
            }

            if (request.Label is not null) slot.Label = Norm(request.Label);
            if (request.StartTime is not null) slot.StartTime = request.StartTime.Value;
            if (request.EndTime is not null) slot.EndTime = request.EndTime.Value;
            if (request.Capacity is not null) slot.Capacity = request.Capacity.Value;
            if (request.AllowWaitlist is not null) slot.AllowWaitlist = request.AllowWaitlist.Value;

            if (slot.EndTime <= slot.StartTime)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["EndTime"] = new[] { "EndTime must be after StartTime." }
                });
            }

            await db.SaveChangesAsync(ct);

            if (slot.Capacity > oldCapacity)
                await WaitlistService.PromoteWaitlistAsync(db, outbox, emailOptions, slotId, ct);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.Ok(new TimeSlotResponse(slot.Id, slot.EventId, slot.Label, slot.Event.Date.ToDateTime(slot.StartTime), slot.Event.Date.ToDateTime(slot.EndTime), slot.Capacity, signupCount, slot.AllowWaitlist));
        });
    }

    private static async Task<IResult> DeleteSlot(Guid eventId, Guid slotId, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var slot = await db.TimeSlots
            .Include(s => s.Event).ThenInclude(e => e.Organization)
            .FirstOrDefaultAsync(s => s.Id == slotId && s.EventId == eventId && s.Event.Organization.ClerkUserId == userId, ct);

        if (slot is null) return Results.NotFound();

        db.TimeSlots.Remove(slot);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    // --- Roster ---

    private static async Task<IResult> GetRoster(Guid orgId, DateOnly weekStart, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var orgExists = await db.Organizations.AnyAsync(o => o.Id == orgId && o.ClerkUserId == userId, ct);
        if (!orgExists) return Results.NotFound();

        var weekEnd = weekStart.AddDays(6);

        var events = await db.Events
            .Where(e => e.OrganizationId == orgId && e.Date >= weekStart && e.Date <= weekEnd)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .OrderBy(e => e.Date)
            .ToListAsync(ct);

        return Results.Ok(events.Select(e => new RosterEventResponse(
            e.Id, e.Title, e.Description, e.Location, e.Date,
            e.TimeSlots.OrderBy(s => s.StartTime).Select(s => new RosterSlotResponse(
                s.Id, s.Label, e.Date.ToDateTime(s.StartTime), e.Date.ToDateTime(s.EndTime), s.Capacity, s.AllowWaitlist,
                s.Signups.Select(su => new SignupResponse(su.Id, su.TimeSlotId, su.VolunteerName, su.Email, su.Status.ToString(), su.CreatedAt))
            ))
        )));
    }

    // --- Signups ---

    private static async Task<IResult> DeleteSignup(Guid id, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var signup = await db.Signups
            .Include(s => s.TimeSlot).ThenInclude(s => s.Event).ThenInclude(e => e.Organization)
            .FirstOrDefaultAsync(s => s.Id == id && s.TimeSlot.Event.Organization.ClerkUserId == userId, ct);

        if (signup is null) return Results.NotFound();

        // Already inactive: idempotent, no email.
        if (signup.Status is SignupStatus.Cancelled or SignupStatus.Removed)
            return Results.NoContent();

        var slotId = signup.TimeSlotId;

        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await db.Database.BeginTransactionAsync(ct);

            await SlotAdvisoryLock.AcquireAsync(db, slotId, ct);

            // Re-read under the lock: the status may have changed since the ownership fetch above.
            var currentStatus = await db.Signups
                .Where(s => s.Id == id)
                .Select(s => (SignupStatus?)s.Status)
                .FirstOrDefaultAsync(ct);

            if (currentStatus is null or SignupStatus.Cancelled or SignupStatus.Removed)
            {
                await tx.CommitAsync(ct);
                return Results.NoContent();
            }

            var wasWaitlisted = WaitlistService.IsWaitlist(currentStatus.Value);
            var wasOccupying = WaitlistService.IsActive(currentStatus.Value);

            signup.Status = SignupStatus.Removed;

            var slot = signup.TimeSlot;
            var evt = slot.Event;
            var (subject, html, text) = EmailTemplates.BuildSignupRemoved(
                signup.VolunteerName,
                evt.Organization.Name,
                evt.Title,
                slot.Label,
                evt.Date,
                slot.StartTime,
                slot.EndTime,
                evt.Location,
                wasWaitlisted);

            // EnqueueAsync saves changes, persisting the status flip and the outbox row atomically.
            await outbox.EnqueueAsync(signup.Email, subject, html, text, ct: ct);

            if (wasOccupying)
                await WaitlistService.PromoteWaitlistAsync(db, outbox, emailOptions, slotId, ct);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.NoContent();
        });
    }

    // --- Event Detail ---

    private static async Task<IResult> GetEvent(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Organization)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .FirstOrDefaultAsync(e => e.Id == id && e.Organization.ClerkUserId == userId, ct);

        if (evt is null) return Results.NotFound();

        return Results.Ok(new RosterEventResponse(
            evt.Id, evt.Title, evt.Description, evt.Location, evt.Date,
            evt.TimeSlots.OrderBy(s => s.StartTime).Select(s => new RosterSlotResponse(
                s.Id, s.Label, evt.Date.ToDateTime(s.StartTime), evt.Date.ToDateTime(s.EndTime), s.Capacity, s.AllowWaitlist,
                s.Signups.Select(su => new SignupResponse(su.Id, su.TimeSlotId, su.VolunteerName, su.Email, su.Status.ToString(), su.CreatedAt))
            ))
        ));
    }

    // --- Invite Links ---

    private static async Task<IResult> CreateInviteLink(Guid eventId, DateTime? expiresAt, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Organization)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.Organization.ClerkUserId == userId, ct);

        if (evt is null) return Results.NotFound();

        var link = new InviteLink
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Code = GenerateInviteCode(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(7)
        };

        db.InviteLinks.Add(link);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new InviteLinkResponse(link.Id, link.EventId, link.Code, link.IsActive, link.CreatedAt, link.ExpiresAt));
    }

    private static async Task<IResult> ListInviteLinks(Guid eventId, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Organization)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.Organization.ClerkUserId == userId, ct);

        if (evt is null) return Results.NotFound();

        var links = await db.InviteLinks
            .Where(l => l.EventId == eventId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

        return Results.Ok(links.Select(l => new InviteLinkResponse(l.Id, l.EventId, l.Code, l.IsActive, l.CreatedAt, l.ExpiresAt)));
    }

    private static async Task<IResult> RevokeInviteLink(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var link = await db.InviteLinks
            .Include(l => l.Event!).ThenInclude(e => e.Organization)
            .FirstOrDefaultAsync(l => l.Id == id && l.EventId != null, ct);

        if (link is null || link.Event is null || link.Event.Organization.ClerkUserId != userId)
            return Results.NotFound();

        if (!link.IsActive) return Results.NoContent();

        link.IsActive = false;
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static string GenerateInviteCode()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}

// --- Request DTOs ---

public record CreateOrganizationRequest(
    [property: Required, NotWhitespace, StringLength(200)] string Name);

public record CreateEventRequest(
    [property: Required, NotWhitespace, StringLength(300)] string Title,
    [property: NotWhitespace, StringLength(2000)] string? Description,
    [property: NotWhitespace, StringLength(500)] string? Location,
    DateOnly Date,
    [property: MaxLength(50)] List<CreateSlotRequest>? Slots) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
        {
            yield return new ValidationResult(
                "Date is required.",
                [nameof(Date)]);
        }
        else if (Date < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            yield return new ValidationResult(
                "Date cannot be in the past.",
                [nameof(Date)]);
        }
    }
}

public record UpdateEventRequest(
    [property: NotWhitespace, StringLength(300)] string? Title,
    [property: StringLength(2000)] string? Description,
    [property: StringLength(500)] string? Location,
    DateOnly? Date,
    [property: MaxLength(50)] List<EventSlotUpsert>? Slots) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date is { } d && d == default)
        {
            yield return new ValidationResult(
                "Date is required when supplied.",
                [nameof(Date)]);
        }
        else if (Date is { } past && past < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            yield return new ValidationResult(
                "Date cannot be in the past.",
                [nameof(Date)]);
        }
    }
}

public record CreateSlotRequest(
    [property: Required, NotWhitespace, StringLength(200)] string Label,
    TimeOnly StartTime,
    TimeOnly EndTime,
    [property: Range(1, 10_000)] int Capacity,
    bool? AllowWaitlist) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (EndTime <= StartTime)
        {
            yield return new ValidationResult(
                "EndTime must be after StartTime.",
                [nameof(EndTime), nameof(StartTime)]);
        }
    }
}

public record UpdateSlotRequest(
    [property: NotWhitespace, StringLength(200)] string? Label,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    [property: Range(1, 10_000)] int? Capacity,
    bool? AllowWaitlist);

public record EventSlotUpsert(
    Guid? Id,
    [property: Required, NotWhitespace, StringLength(200)] string Label,
    TimeOnly StartTime,
    TimeOnly EndTime,
    [property: Range(1, 10_000)] int Capacity,
    bool? AllowWaitlist) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (EndTime <= StartTime)
        {
            yield return new ValidationResult(
                "EndTime must be after StartTime.",
                [nameof(EndTime), nameof(StartTime)]);
        }
    }
}

// --- Response DTOs ---

public record OrganizationResponse(Guid Id, string Name, DateTime CreatedAt);

public record InviteLinkResponse(Guid Id, Guid? EventId, string Code, bool IsActive, DateTime CreatedAt, DateTime? ExpiresAt);

public record EventResponse(Guid Id, Guid OrganizationId, string Title, string? Description, string? Location, DateOnly Date, DateTime CreatedAt);

public record EventWithSlotsResponse(Guid Id, Guid OrganizationId, string Title, string? Description, string? Location, DateOnly Date, DateTime CreatedAt, IEnumerable<TimeSlotResponse> Slots);

public record TimeSlotResponse(Guid Id, Guid EventId, string Label, DateTime StartTime, DateTime EndTime, int Capacity, int SignupCount, bool AllowWaitlist);

public record RosterEventResponse(Guid Id, string Title, string? Description, string? Location, DateOnly Date, IEnumerable<RosterSlotResponse> Slots);

public record RosterSlotResponse(Guid Id, string Label, DateTime StartTime, DateTime EndTime, int Capacity, bool AllowWaitlist, IEnumerable<SignupResponse> Signups);

public record SignupResponse(Guid Id, Guid TimeSlotId, string VolunteerName, string Email, string Status, DateTime CreatedAt);
