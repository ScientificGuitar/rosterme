using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

using Microsoft.EntityFrameworkCore;

using RosterMeApi.Data;
using RosterMeApi.Entities;
using RosterMeApi.Services;
using RosterMeApi.Validation;
using Microsoft.Extensions.Options;

namespace RosterMeApi.Endpoints;

public static class AdminEndpoints
{
    public static WebApplication MapAdminEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api").RequireAuthorization().AddEndpointFilter<ValidateDtoFilter>();

        admin.MapPost("/groups", CreateGroup)
            .Produces<GroupResponse>(201)
            .Produces(400)
            .Produces(401);
        admin.MapGet("/groups", ListGroups)
            .Produces<IEnumerable<GroupResponse>>()
            .Produces(401);
        admin.MapGet("/groups/{id}", GetGroup)
            .Produces<GroupResponse>()
            .Produces(401)
            .Produces(404);
        admin.MapPut("/groups/{id}", UpdateGroup)
            .Produces<GroupResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapDelete("/groups/{id}", DeleteGroup)
            .Produces(204)
            .Produces(401)
            .Produces(404)
            .Produces(409);
        admin.MapPost("/groups/{groupId}/admins", AddGroupAdmin)
            .Produces<GroupAdminResponse>(201)
            .Produces(400)
            .Produces(401)
            .Produces(404)
            .Produces(409);
        admin.MapDelete("/groups/{groupId}/admins/{adminId}", RemoveGroupAdmin)
            .Produces(204)
            .Produces(400)
            .Produces(401)
            .Produces(404);

        admin.MapPost("/events", CreateEvent)
            .Produces<EventResponse>(201)
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapGet("/events", ListEvents)
            .Produces<IEnumerable<EventWithSlotsResponse>>()
            .Produces(401);
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

        admin.MapGet("/roster", GetRoster)
            .Produces<IEnumerable<RosterEventResponse>>()
            .Produces(401);

        admin.MapDelete("/signups/{id}", DeleteSignup)
            .Produces(204)
            .Produces(401)
            .Produces(404);

        admin.MapPost("/signups/{id}/resend", ResendSignupConfirmation)
            .Produces(204)
            .Produces(401)
            .Produces(404)
            .Produces(409);

        admin.MapGet("/events/{id}", GetEvent)
            .Produces<RosterEventResponse>()
            .Produces(401)
            .Produces(404);

        admin.MapPost("/events/{eventId}/invite-links", CreateInviteLink)
            .Produces<InviteLinkResponse>()
            .Produces(400)
            .Produces(401)
            .Produces(404);
        admin.MapGet("/events/{eventId}/invite-links", ListInviteLinks)
            .Produces<IEnumerable<InviteLinkResponse>>()
            .Produces(401)
            .Produces(404);
        admin.MapPut("/invite-links/{id}", UpdateInviteLink)
            .Produces<InviteLinkResponse>()
            .Produces(400)
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

    private static string? SerializeOptions(List<string>? options) =>
        options is null ? null : string.Join("\n", options.Select(o => o.Trim()));

    private static List<string> ParseOptions(string? options) =>
        string.IsNullOrEmpty(options)
            ? []
            : options.Split('\n').Select(o => o.Trim()).Where(o => o.Length > 0).ToList();

    private static bool? ResolveRemovalNotify(RemovalEmailPolicy policy, bool? notifyParam) =>
        policy switch
        {
            RemovalEmailPolicy.Always => true,
            RemovalEmailPolicy.Never => false,
            _ => notifyParam
        };

    private static bool IsNotifiable(SignupStatus status) =>
        status is SignupStatus.Pending or SignupStatus.Confirmed
            or SignupStatus.WaitlistPending or SignupStatus.Waitlisted;

    private static IResult MissingNotifyChoice() =>
        Results.BadRequest(new
        {
            error = "Specify whether to notify volunteers of this removal.",
            code = "missing_notify_choice"
        });

    private sealed record RemovedSlotNotification(
        string VolunteerName, string Email, bool WasWaitlisted,
        string SlotLabel, TimeOnly StartTime, TimeOnly EndTime);

    private static async Task<Group?> GetOwnedGroup(AppDbContext db, Guid groupId, string userId, CancellationToken ct)
    {
        return await db.Groups
            .FirstOrDefaultAsync(g => g.Id == groupId &&
                g.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);
    }

    // --- Groups ---

    private static string? GetFullNameClaim(HttpContext http)
    {
        var name = http.User.FindFirstValue("name");
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();
        var first = http.User.FindFirstValue("first_name")?.Trim();
        var last = http.User.FindFirstValue("last_name")?.Trim();
        if (string.IsNullOrEmpty(first) && string.IsNullOrEmpty(last)) return null;
        return string.Join(" ", new[] { first, last }.Where(s => !string.IsNullOrEmpty(s)));
    }

    private static string? NormalizeEmail(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

    /// <summary>
    /// Fills in name/email for the current user's admin rows from Clerk JWT
    /// claims, and links email-invited rows (added before the person had a
    /// RosterMe account) to their Clerk user id when the emails match.
    /// </summary>
    private static async Task SyncGroupAdminIdentityAsync(AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var email = NormalizeEmail(http.User.FindFirstValue("email"));
        var name = GetFullNameClaim(http);

        var admins = await db.GroupAdmins
            .Where(a => a.ClerkUserId == userId
                || (email != null && a.ClerkUserId == null && a.Email == email))
            .ToListAsync(ct);

        var changed = false;
        foreach (var admin in admins)
        {
            if (admin.ClerkUserId is null && email is not null && admin.Email == email)
            {
                admin.ClerkUserId = userId;
                changed = true;
            }
            if (string.IsNullOrEmpty(admin.Name) && name is not null)
            {
                admin.Name = name;
                changed = true;
            }
            if (string.IsNullOrEmpty(admin.Email) && email is not null)
            {
                admin.Email = email;
                changed = true;
            }
        }

        if (changed) await db.SaveChangesAsync(ct);
    }

    private static async Task<IResult> CreateGroup(CreateGroupRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);

        var group = new Group
        {
            Id = Guid.NewGuid(),
            Name = Norm(request.Name),
            CreatedAt = DateTime.UtcNow
        };
        group.Admins.Add(new GroupAdmin
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            ClerkUserId = userId,
            Name = GetFullNameClaim(http),
            Email = NormalizeEmail(http.User.FindFirstValue("email")),
            Role = GroupAdminRole.Owner,
            CreatedAt = DateTime.UtcNow
        });

        db.Groups.Add(group);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/groups/{group.Id}", new GroupResponse(group.Id, group.Name, group.CreatedAt, 0, 1));
    }

    private static async Task<IResult> ListGroups(AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        await SyncGroupAdminIdentityAsync(db, http, ct);

        var groups = await db.Groups
            .Where(g => g.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner))
            .OrderBy(g => g.Name)
            .Select(g => new GroupResponse(
                g.Id,
                g.Name,
                g.CreatedAt,
                db.Events.Count(e => e.GroupId == g.Id),
                g.Admins.Count))
            .ToListAsync(ct);

        return Results.Ok(groups);
    }

    private static async Task<IResult> GetGroup(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        await SyncGroupAdminIdentityAsync(db, http, ct);

        var group = await db.Groups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == id &&
                g.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (group is null) return Results.NotFound();

        var eventCount = await db.Events.CountAsync(e => e.GroupId == id, ct);
        var currentUserRole = group.Admins.First(a => a.ClerkUserId == userId).Role.ToString();

        return Results.Ok(new GroupDetailResponse(
            group.Id,
            group.Name,
            group.CreatedAt,
            eventCount,
            group.Admins
                .OrderBy(a => a.Role == GroupAdminRole.Owner ? 0 : 1)
                .ThenBy(a => a.Name ?? a.Email ?? "")
                .Select(a => new GroupAdminResponse(a.Id, a.ClerkUserId, a.Name, a.Email, a.Role.ToString()))
                .ToList(),
            currentUserRole));
    }

    private static async Task<IResult> UpdateGroup(Guid id, UpdateGroupRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var group = await GetOwnedGroup(db, id, userId, ct);
        if (group is null) return Results.NotFound();

        group.Name = Norm(request.Name);
        await db.SaveChangesAsync(ct);

        var eventCount = await db.Events.CountAsync(e => e.GroupId == id, ct);
        var adminCount = await db.GroupAdmins.CountAsync(a => a.GroupId == id, ct);
        return Results.Ok(new GroupResponse(group.Id, group.Name, group.CreatedAt, eventCount, adminCount));
    }

    private static async Task<IResult> DeleteGroup(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var group = await GetOwnedGroup(db, id, userId, ct);
        if (group is null) return Results.NotFound();

        if (await db.Events.AnyAsync(e => e.GroupId == id, ct))
        {
            return Results.Conflict(new
            {
                error = "This group still has events. Move or delete its events first.",
                code = "group_has_events"
            });
        }

        db.Groups.Remove(group);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static async Task<IResult> AddGroupAdmin(Guid groupId, AddGroupAdminRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var group = await GetOwnedGroup(db, groupId, userId, ct);
        if (group is null) return Results.NotFound();

        var email = NormalizeEmail(request.Email);
        if (email is null)
        {
            return Results.BadRequest(new { error = "A valid email is required.", code = "invalid_email" });
        }

        // Check the owner first so adding the owner's own email yields a
        // specific error instead of the generic "already a member".
        var ownerEmail = await db.GroupAdmins
            .Where(a => a.GroupId == groupId && a.Role == GroupAdminRole.Owner)
            .Select(a => a.Email)
            .FirstOrDefaultAsync(ct);
        if (ownerEmail is not null && string.Equals(ownerEmail, email, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Conflict(new
            {
                error = "The group owner is already a member.",
                code = "is_owner"
            });
        }

        if (await db.GroupAdmins.AnyAsync(a => a.GroupId == groupId && a.Email == email, ct))
        {
            return Results.Conflict(new
            {
                error = "This person is already a member of the group.",
                code = "admin_exists"
            });
        }

        var admin = new GroupAdmin
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            Email = email,
            Role = GroupAdminRole.Admin,
            CreatedAt = DateTime.UtcNow
        };
        db.GroupAdmins.Add(admin);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/groups/{groupId}/admins/{admin.Id}",
            new GroupAdminResponse(admin.Id, admin.ClerkUserId, admin.Name, admin.Email, admin.Role.ToString()));
    }

    private static async Task<IResult> RemoveGroupAdmin(Guid groupId, Guid adminId, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var group = await GetOwnedGroup(db, groupId, userId, ct);
        if (group is null) return Results.NotFound();

        var admin = await db.GroupAdmins.FirstOrDefaultAsync(a => a.Id == adminId && a.GroupId == groupId, ct);
        if (admin is null) return Results.NotFound();

        if (admin.Role == GroupAdminRole.Owner)
        {
            return Results.BadRequest(new
            {
                error = "The group owner cannot be removed from the group.",
                code = "owner_not_removable"
            });
        }

        db.GroupAdmins.Remove(admin);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    // --- Events ---

    private static async Task<IResult> CreateEvent(CreateEventRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var group = await GetOwnedGroup(db, request.GroupId, userId, ct);
        if (group is null) return Results.NotFound();

        var evt = new Event
        {
            Id = Guid.NewGuid(),
            GroupId = request.GroupId,
            Title = Norm(request.Title),
            Description = NormNull(request.Description),
            Location = NormNull(request.Location),
            Date = request.Date,
            RemovalEmailPolicy = request.RemovalEmailPolicy ?? RemovalEmailPolicy.Ask,
            CreatedAt = DateTime.UtcNow
        };

        db.Events.Add(evt);

        if (request.Questions is not null)
        {
            for (var i = 0; i < request.Questions.Count; i++)
            {
                var q = request.Questions[i];
                db.SignupQuestions.Add(new SignupQuestion
                {
                    Id = Guid.NewGuid(),
                    EventId = evt.Id,
                    Label = Norm(q.Label),
                    Type = q.Type!.Value,
                    Required = q.Required,
                    Options = q.Type == QuestionType.Dropdown ? SerializeOptions(q.Options) : null,
                    SortOrder = i,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        if (request.Slots is not null)
        {
            for (var i = 0; i < request.Slots.Count; i++)
            {
                var s = request.Slots[i];
                db.TimeSlots.Add(new TimeSlot
                {
                    Id = Guid.NewGuid(),
                    EventId = evt.Id,
                    Label = Norm(s.Label),
                    StartTime = s.StartTime,
                    EndTime = s.EndTime,
                    Capacity = s.Capacity,
                    AllowWaitlist = s.AllowWaitlist ?? true,
                    SortOrder = i,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/events/{evt.Id}", new EventResponse(
            evt.Id, evt.GroupId, evt.Title, evt.Description, evt.Location, evt.Date, evt.RemovalEmailPolicy, evt.CreatedAt
        ));
    }

    private static async Task<IResult> ListEvents(DateOnly from, DateOnly to, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);

        var events = await db.Events
            .Where(e => e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner) && e.Date >= from && e.Date <= to)
            .Include(e => e.Group)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .OrderBy(e => e.Date)
            .ToListAsync(ct);

        return Results.Ok(events.Select(e => new EventWithSlotsResponse(
            e.Id, e.GroupId, e.Group.Name, e.Title, e.Description, e.Location, e.Date, e.RemovalEmailPolicy, e.CreatedAt,
            e.TimeSlots.OrderBy(s => s.SortOrder).ThenBy(s => s.StartTime).Select(s => new TimeSlotResponse(s.Id, s.EventId, s.Label, SlotTimes.ResolveStart(e.Date, s.StartTime), SlotTimes.ResolveEnd(e.Date, s.StartTime, s.EndTime), s.Capacity, s.Signups.Count(sg => sg.Status == SignupStatus.Pending || sg.Status == SignupStatus.Confirmed), s.AllowWaitlist))
        )));
    }

    private static async Task<IResult> UpdateEvent(Guid id, UpdateEventRequest request, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Group)
            .Include(e => e.Questions).ThenInclude(q => q.Answers)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .FirstOrDefaultAsync(e => e.Id == id && e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (evt is null) return Results.NotFound();

        if (request.Title is not null)
            evt.Title = Norm(request.Title);
        if (request.Description is not null)
            evt.Description = NormNull(request.Description);
        if (request.Location is not null)
            evt.Location = NormNull(request.Location);
        if (request.Date is not null) evt.Date = request.Date.Value;
        if (request.GroupId is { } newGroupId && newGroupId != evt.GroupId)
        {
            var newGroup = await GetOwnedGroup(db, newGroupId, userId, ct);
            if (newGroup is null) return Results.NotFound();
            evt.GroupId = newGroupId;
        }
        if (request.RemovalEmailPolicy.HasValue)
            evt.RemovalEmailPolicy = request.RemovalEmailPolicy.Value;

        var increasedSlotIds = new List<Guid>();
        var removedSlotNotifications = new List<RemovedSlotNotification>();
        bool notifyRemovedSlots = false;

        if (request.Questions is not null)
        {
            var seenQuestionIds = new HashSet<Guid>();
            foreach (var q in request.Questions)
            {
                if (q.Id is { } qid && !seenQuestionIds.Add(qid))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["Questions"] = ["Duplicate question id in request."]
                    });
                }
            }

            var existingQuestionsById = evt.Questions.ToDictionary(q => q.Id);
            // Snapshot before mutating: newly added questions get pulled into the
            // tracked evt.Questions collection via relationship fixup and must
            // not be treated as deletion candidates below.
            var originalQuestions = evt.Questions.ToList();
            var requestedQuestionIds = new HashSet<Guid>(
                request.Questions.Where(q => q.Id.HasValue).Select(q => q.Id!.Value));

            if (requestedQuestionIds.Any(rid => !existingQuestionsById.ContainsKey(rid)))
            {
                return Results.NotFound();
            }

            for (var i = 0; i < request.Questions.Count; i++)
            {
                var q = request.Questions[i];
                var options = q.Type == QuestionType.Dropdown ? SerializeOptions(q.Options) : null;

                if (q.Id is { } qid)
                {
                    var question = existingQuestionsById[qid];
                    if (question.IsDeleted)
                    {
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["Questions"] = ["A deleted question cannot be updated."]
                        });
                    }

                    if (question.Answers.Count > 0 && question.Type != q.Type)
                    {
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["Questions"] = [$"Cannot change the type of \"{question.Label}\" because answers already exist."]
                        });
                    }

                    question.Label = Norm(q.Label);
                    question.Type = q.Type!.Value;
                    question.Required = q.Required;
                    question.Options = options;
                    question.SortOrder = i;
                }
                else
                {
                    db.SignupQuestions.Add(new SignupQuestion
                    {
                        Id = Guid.NewGuid(),
                        EventId = evt.Id,
                        Label = Norm(q.Label),
                        Type = q.Type!.Value,
                        Required = q.Required,
                        Options = options,
                        SortOrder = i,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            foreach (var question in originalQuestions.Where(q => !requestedQuestionIds.Contains(q.Id)))
            {
                if (question.Answers.Count > 0)
                {
                    question.IsDeleted = true;
                }
                else
                {
                    db.SignupQuestions.Remove(question);
                }
            }
        }

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
                if (s.EndTime == s.StartTime)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        [$"Slots[{i}].EndTime"] = new[] { "EndTime must not equal StartTime. Use an earlier EndTime for an overnight slot." }
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
                    slot.SortOrder = i;
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
                        SortOrder = i,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            foreach (var slot in originalSlots.Where(s => !requestedIds.Contains(s.Id)))
            {
                foreach (var sg in slot.Signups.Where(sg => IsNotifiable(sg.Status)))
                {
                    removedSlotNotifications.Add(new RemovedSlotNotification(
                        sg.VolunteerName, sg.Email,
                        sg.Status is SignupStatus.WaitlistPending or SignupStatus.Waitlisted,
                        slot.Label, slot.StartTime, slot.EndTime));
                }
                db.TimeSlots.Remove(slot);
            }

            if (removedSlotNotifications.Count > 0)
            {
                var resolved = ResolveRemovalNotify(evt.RemovalEmailPolicy, request.NotifyOnRemove);
                if (resolved is null) return MissingNotifyChoice();
                notifyRemovedSlots = resolved.Value;
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

            if (notifyRemovedSlots)
            {
                foreach (var n in removedSlotNotifications)
                {
                    var (subject, html, text) = EmailTemplates.BuildSlotDeleted(
                        n.VolunteerName, evt.Group.Name, evt.Title,
                        n.SlotLabel, evt.Date, n.StartTime, n.EndTime,
                        evt.Location, n.WasWaitlisted);
                    await outbox.EnqueueAsync(n.Email, subject, html, text, ct: ct);
                }
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.Ok(new EventResponse(evt.Id, evt.GroupId, evt.Title, evt.Description, evt.Location, evt.Date, evt.RemovalEmailPolicy, evt.CreatedAt));
        });
    }

    private static async Task<IResult> DeleteEvent(Guid id, bool? notify, AppDbContext db, EmailOutboxService outbox, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Group)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups)
            .FirstOrDefaultAsync(e => e.Id == id && e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (evt is null) return Results.NotFound();

        var recipients = evt.TimeSlots
            .SelectMany(s => s.Signups)
            .Where(sg => IsNotifiable(sg.Status))
            .GroupBy(sg => sg.Email, StringComparer.OrdinalIgnoreCase)
            .Select(g => (VolunteerName: g.First().VolunteerName, Email: g.Key))
            .ToList();

        var shouldNotify = false;
        if (recipients.Count > 0)
        {
            var resolved = ResolveRemovalNotify(evt.RemovalEmailPolicy, notify);
            if (resolved is null) return MissingNotifyChoice();
            shouldNotify = resolved.Value;
        }

        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await db.Database.BeginTransactionAsync(ct);

            if (shouldNotify)
            {
                foreach (var r in recipients)
                {
                    var (subject, html, text) = EmailTemplates.BuildEventCancelled(
                        r.VolunteerName, evt.Group.Name, evt.Title, evt.Date, evt.Location);
                    await outbox.EnqueueAsync(r.Email, subject, html, text, ct: ct);
                }
            }

            db.Events.Remove(evt);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.NoContent();
        });
    }

    // --- Time Slots ---

    private static async Task<IResult> CreateSlot(Guid eventId, CreateSlotRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Group)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

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
            SortOrder = (await db.TimeSlots
                .Where(s => s.EventId == eventId)
                .MaxAsync(s => (int?)s.SortOrder, ct) ?? -1) + 1,
            CreatedAt = DateTime.UtcNow
        };

        db.TimeSlots.Add(slot);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/events/{eventId}/slots/{slot.Id}", new TimeSlotResponse(slot.Id, slot.EventId, slot.Label, SlotTimes.ResolveStart(evt.Date, slot.StartTime), SlotTimes.ResolveEnd(evt.Date, slot.StartTime, slot.EndTime), slot.Capacity, 0, slot.AllowWaitlist));
    }

    private static async Task<IResult> UpdateSlot(Guid eventId, Guid slotId, UpdateSlotRequest request, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var slot = await db.TimeSlots
            .Include(s => s.Event).ThenInclude(e => e.Group)
            .FirstOrDefaultAsync(s => s.Id == slotId && s.EventId == eventId && s.Event.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

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

            if (slot.EndTime == slot.StartTime)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["EndTime"] = new[] { "EndTime must not equal StartTime. Use an earlier EndTime for an overnight slot." }
                });
            }

            await db.SaveChangesAsync(ct);

            if (slot.Capacity > oldCapacity)
                await WaitlistService.PromoteWaitlistAsync(db, outbox, emailOptions, slotId, ct);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.Ok(new TimeSlotResponse(slot.Id, slot.EventId, slot.Label, SlotTimes.ResolveStart(slot.Event.Date, slot.StartTime), SlotTimes.ResolveEnd(slot.Event.Date, slot.StartTime, slot.EndTime), slot.Capacity, signupCount, slot.AllowWaitlist));
        });
    }

    private static async Task<IResult> DeleteSlot(Guid eventId, Guid slotId, bool? notify, AppDbContext db, EmailOutboxService outbox, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var slot = await db.TimeSlots
            .Include(s => s.Event).ThenInclude(e => e.Group)
            .Include(s => s.Signups)
            .FirstOrDefaultAsync(s => s.Id == slotId && s.EventId == eventId && s.Event.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (slot is null) return Results.NotFound();

        var affected = slot.Signups.Where(sg => IsNotifiable(sg.Status)).ToList();

        var shouldNotify = false;
        if (affected.Count > 0)
        {
            var resolved = ResolveRemovalNotify(slot.Event.RemovalEmailPolicy, notify);
            if (resolved is null) return MissingNotifyChoice();
            shouldNotify = resolved.Value;
        }

        // Snapshot before the cascade delete wipes the signups.
        var notifications = affected
            .Select(sg => new RemovedSlotNotification(
                sg.VolunteerName, sg.Email,
                sg.Status is SignupStatus.WaitlistPending or SignupStatus.Waitlisted,
                slot.Label, slot.StartTime, slot.EndTime))
            .ToList();
        var evt = slot.Event;

        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await db.Database.BeginTransactionAsync(ct);

            if (shouldNotify)
            {
                foreach (var n in notifications)
                {
                    var (subject, html, text) = EmailTemplates.BuildSlotDeleted(
                        n.VolunteerName, evt.Group.Name, evt.Title,
                        n.SlotLabel, evt.Date, n.StartTime, n.EndTime,
                        evt.Location, n.WasWaitlisted);
                    await outbox.EnqueueAsync(n.Email, subject, html, text, ct: ct);
                }
            }

            db.TimeSlots.Remove(slot);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.NoContent();
        });
    }

    // --- Roster ---

    private static async Task<IResult> GetRoster(DateOnly weekStart, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);

        var weekEnd = weekStart.AddDays(6);

        var events = await db.Events
            .Where(e => e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner) && e.Date >= weekStart && e.Date <= weekEnd)
            .Include(e => e.Group)
            .Include(e => e.Questions)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups).ThenInclude(su => su.Answers)
            .OrderBy(e => e.Date)
            .ToListAsync(ct);

        return Results.Ok(events.Select(e => new RosterEventResponse(
            e.Id, e.GroupId, e.Group.Name, e.Title, e.Description, e.Location, e.Date, e.RemovalEmailPolicy, e.CreatedAt, RosterQuestionResponse.From(e.Questions),
            e.TimeSlots.OrderBy(s => s.SortOrder).ThenBy(s => s.StartTime).Select(s => new RosterSlotResponse(
                s.Id, s.Label, SlotTimes.ResolveStart(e.Date, s.StartTime), SlotTimes.ResolveEnd(e.Date, s.StartTime, s.EndTime), s.Capacity, s.AllowWaitlist,
                s.Signups.Select(su => new SignupResponse(su.Id, su.TimeSlotId, su.VolunteerName, su.Email, su.Status.ToString(), su.CreatedAt,
                    su.Answers.Select(a => new SignupAnswerResponse(a.QuestionId, a.Value)).ToList()))
            ))
        )));
    }

    // --- Signups ---

    private static async Task<IResult> DeleteSignup(Guid id, bool? notify, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var signup = await db.Signups
            .Include(s => s.TimeSlot).ThenInclude(s => s.Event).ThenInclude(e => e.Group)
            .FirstOrDefaultAsync(s => s.Id == id && s.TimeSlot.Event.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (signup is null) return Results.NotFound();

        // Already inactive: idempotent, no email.
        if (signup.Status is SignupStatus.Cancelled or SignupStatus.Removed)
            return Results.NoContent();

        // Resolve the notify choice up-front so Ask without an explicit
        // choice fails fast instead of flipping status first.
        var shouldNotify = ResolveRemovalNotify(signup.TimeSlot.Event.RemovalEmailPolicy, notify);
        if (shouldNotify is null) return MissingNotifyChoice();

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
            if (shouldNotify.Value)
            {
                var (subject, html, text) = EmailTemplates.BuildSignupRemoved(
                    signup.VolunteerName,
                    evt.Group.Name,
                    evt.Title,
                    slot.Label,
                    evt.Date,
                    slot.StartTime,
                    slot.EndTime,
                    evt.Location,
                    wasWaitlisted);

                // EnqueueAsync saves changes, persisting the status flip and the outbox row atomically.
                await outbox.EnqueueAsync(signup.Email, subject, html, text, ct: ct);
            }

            if (wasOccupying)
                await WaitlistService.PromoteWaitlistAsync(db, outbox, emailOptions, slotId, ct);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.NoContent();
        });
    }

    private static async Task<IResult> ResendSignupConfirmation(Guid id, AppDbContext db, EmailOutboxService outbox, IOptions<EmailOptions> emailOptions, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var signup = await db.Signups
            .Include(s => s.TimeSlot).ThenInclude(s => s.Event).ThenInclude(e => e.Group)
            .FirstOrDefaultAsync(s => s.Id == id && s.TimeSlot.Event.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (signup is null) return Results.NotFound();

        if (signup.Status == SignupStatus.Confirmed)
            return Results.Conflict(new { error = "This signup is already confirmed.", code = "already_confirmed" });

        if (signup.Status == SignupStatus.Waitlisted)
            return Results.Conflict(new { error = "This signup is already on the waitlist.", code = "already_waitlisted" });

        if (signup.Status == SignupStatus.Cancelled)
            return Results.Conflict(new { error = "This signup was cancelled and cannot receive a confirmation email.", code = "signup_cancelled" });

        if (signup.Status == SignupStatus.Removed)
            return Results.Conflict(new { error = "This signup was removed and cannot receive a confirmation email.", code = "signup_removed" });

        if (signup.Status != SignupStatus.Pending && signup.Status != SignupStatus.WaitlistPending)
            return Results.Conflict(new { error = "Only pending signups can receive a confirmation email.", code = "signup_not_pending" });

        var rawToken = TokenService.GenerateToken();
        signup.ManagementTokenHash = TokenService.HashToken(rawToken);

        var slot = signup.TimeSlot;
        if (signup.Status == SignupStatus.WaitlistPending)
        {
            var position = await WaitlistService.GetWaitlistCountAsync(db, slot.Id, ct) + 1;
            await EnqueueWaitlistConfirmationEmail(db, outbox, emailOptions, signup, slot, rawToken, position, ct);
        }
        else
        {
            await EnqueueConfirmationEmail(db, outbox, emailOptions, signup, slot, rawToken, null, ct);
        }

        // EnqueueAsync saves changes, persisting the token rotation and the outbox row atomically.
        return Results.NoContent();
    }

    private static async Task EnqueueConfirmationEmail(
        AppDbContext db,
        EmailOutboxService outbox,
        IOptions<EmailOptions> emailOptions,
        Signup signup,
        TimeSlot slot,
        string rawToken,
        int? waitlistPosition,
        CancellationToken ct)
    {
        if (waitlistPosition.HasValue)
        {
            await EnqueueWaitlistConfirmationEmail(db, outbox, emailOptions, signup, slot, rawToken, waitlistPosition.Value, ct);
            return;
        }

        var manageUrl = $"{emailOptions.Value.BaseUrl.TrimEnd('/')}/signup/manage/{rawToken}";
        var evt = slot.Event;
        var links = CalendarInviteBuilder.BuildLinks(
            evt.Title,
            evt.Description,
            evt.Location,
            evt.Date,
            slot.StartTime,
            slot.EndTime,
            slot.Label,
            manageUrl);
        var ics = CalendarInviteBuilder.BuildIcs(
            evt.Title,
            evt.Description,
            evt.Location,
            evt.Date,
            slot.StartTime,
            slot.EndTime,
            slot.Label,
            manageUrl,
            signup.Id.ToString());
        var (subject, html, text) = EmailTemplates.BuildSignupConfirmation(
            signup.VolunteerName,
            slot.Event.Group.Name,
            slot.Event.Title,
            slot.Label,
            slot.Event.Date,
            slot.StartTime,
            slot.EndTime,
            manageUrl,
            evt.Location,
            links,
            hasCalendarAttachment: true);

        var attachment = new EmailAttachment(
            CalendarInviteBuilder.IcsFileName(evt.Title),
            "text/calendar",
            System.Text.Encoding.UTF8.GetBytes(ics));

        await outbox.EnqueueAsync(signup.Email, subject, html, text, attachment, ct);
    }

    private static async Task EnqueueWaitlistConfirmationEmail(
        AppDbContext db,
        EmailOutboxService outbox,
        IOptions<EmailOptions> emailOptions,
        Signup signup,
        TimeSlot slot,
        string rawToken,
        int waitlistPosition,
        CancellationToken ct)
    {
        var manageUrl = $"{emailOptions.Value.BaseUrl.TrimEnd('/')}/signup/manage/{rawToken}";

        var evt = slot.Event;
        var (subject, html, text) = EmailTemplates.BuildWaitlistConfirmation(
            signup.VolunteerName,
            evt.Group.Name,
            evt.Title,
            slot.Label,
            evt.Date,
            slot.StartTime,
            slot.EndTime,
            manageUrl,
            waitlistPosition,
            evt.Location);

        await outbox.EnqueueAsync(signup.Email, subject, html, text, ct: ct);
    }

    // --- Event Detail ---

    private static async Task<IResult> GetEvent(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Group)
            .Include(e => e.Questions)
            .Include(e => e.TimeSlots).ThenInclude(s => s.Signups).ThenInclude(su => su.Answers)
            .FirstOrDefaultAsync(e => e.Id == id && e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (evt is null) return Results.NotFound();

        return Results.Ok(new RosterEventResponse(
            evt.Id, evt.GroupId, evt.Group.Name, evt.Title, evt.Description, evt.Location, evt.Date, evt.RemovalEmailPolicy, evt.CreatedAt, RosterQuestionResponse.From(evt.Questions),
            evt.TimeSlots.OrderBy(s => s.SortOrder).ThenBy(s => s.StartTime).Select(s => new RosterSlotResponse(
                s.Id, s.Label, SlotTimes.ResolveStart(evt.Date, s.StartTime), SlotTimes.ResolveEnd(evt.Date, s.StartTime, s.EndTime), s.Capacity, s.AllowWaitlist,
                s.Signups.Select(su => new SignupResponse(su.Id, su.TimeSlotId, su.VolunteerName, su.Email, su.Status.ToString(), su.CreatedAt,
                    su.Answers.Select(a => new SignupAnswerResponse(a.QuestionId, a.Value)).ToList()))
            ))
        ));
    }

    // --- Invite Links ---

    private static async Task<IResult> CreateInviteLink(Guid eventId, CreateInviteLinkRequest? request, DateTime? expiresAt, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Group)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (evt is null) return Results.NotFound();

        var resolvedExpiresAt = request?.ExpiresAt ?? expiresAt ?? DateTime.UtcNow.AddDays(7);
        var name = string.IsNullOrWhiteSpace(request?.Name)
            ? $"Invite link {await db.InviteLinks.CountAsync(l => l.EventId == eventId, ct) + 1}"
            : Norm(request!.Name!);

        var link = new InviteLink
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Name = name,
            Code = GenerateInviteCode(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = resolvedExpiresAt
        };

        db.InviteLinks.Add(link);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new InviteLinkResponse(link.Id, link.EventId, link.Name, link.Code, link.IsActive, link.CreatedAt, link.ExpiresAt, 0));
    }

    private static async Task<IResult> ListInviteLinks(Guid eventId, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var evt = await db.Events
            .Include(e => e.Group)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner), ct);

        if (evt is null) return Results.NotFound();

        var links = await db.InviteLinks
            .Where(l => l.EventId == eventId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

        var linkIds = links.Select(l => l.Id).ToList();
        var counts = await db.Signups
            .Where(s => s.InviteLinkId != null && linkIds.Contains(s.InviteLinkId.Value)
                && s.Status != SignupStatus.Cancelled && s.Status != SignupStatus.Removed)
            .GroupBy(s => s.InviteLinkId!.Value)
            .Select(g => new { InviteLinkId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.InviteLinkId, g => g.Count, ct);

        return Results.Ok(links.Select(l => new InviteLinkResponse(
            l.Id, l.EventId, l.Name, l.Code, l.IsActive, l.CreatedAt, l.ExpiresAt,
            counts.TryGetValue(l.Id, out var c) ? c : 0)));
    }

    private static async Task<IResult> UpdateInviteLink(Guid id, UpdateInviteLinkRequest request, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var link = await db.InviteLinks
            .Include(l => l.Event!).ThenInclude(e => e.Group).ThenInclude(g => g.Admins)
            .FirstOrDefaultAsync(l => l.Id == id && l.EventId != null, ct);

        if (link is null || link.Event is null || !link.Event.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner))
            return Results.NotFound();

        link.Name = Norm(request.Name);
        await db.SaveChangesAsync(ct);

        var signupCount = await db.Signups.CountAsync(
            s => s.InviteLinkId == id && s.Status != SignupStatus.Cancelled && s.Status != SignupStatus.Removed, ct);

        return Results.Ok(new InviteLinkResponse(
            link.Id, link.EventId, link.Name, link.Code, link.IsActive, link.CreatedAt, link.ExpiresAt, signupCount));
    }

    private static async Task<IResult> RevokeInviteLink(Guid id, AppDbContext db, HttpContext http, CancellationToken ct)
    {
        var userId = GetUserId(http);
        var link = await db.InviteLinks
            .Include(l => l.Event!).ThenInclude(e => e.Group).ThenInclude(g => g.Admins)
            .FirstOrDefaultAsync(l => l.Id == id && l.EventId != null, ct);

        if (link is null || link.Event is null || !link.Event.Group.Admins.Any(a => a.ClerkUserId == userId && a.Role == GroupAdminRole.Owner))
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

public record CreateGroupRequest(
    [property: Required, NotWhitespace, StringLength(200)] string Name);

public record UpdateGroupRequest(
    [property: Required, NotWhitespace, StringLength(200)] string Name);

public record AddGroupAdminRequest(
    [property: Required, EmailAddress, StringLength(320)] string Email);

public record CreateEventRequest(
    Guid GroupId,
    [property: Required, NotWhitespace, StringLength(300)] string Title,
    [property: NotWhitespace, StringLength(2000)] string? Description,
    [property: NotWhitespace, StringLength(500)] string? Location,
    DateOnly Date,
    RemovalEmailPolicy? RemovalEmailPolicy,
    [property: MaxLength(50)] List<CreateSlotRequest>? Slots,
    [property: MaxLength(10)] List<QuestionUpsert>? Questions) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (GroupId == Guid.Empty)
        {
            yield return new ValidationResult(
                "GroupId is required.",
                [nameof(GroupId)]);
        }
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
    Guid? GroupId,
    [property: NotWhitespace, StringLength(300)] string? Title,
    [property: StringLength(2000)] string? Description,
    [property: StringLength(500)] string? Location,
    DateOnly? Date,
    RemovalEmailPolicy? RemovalEmailPolicy,
    bool? NotifyOnRemove,
    [property: MaxLength(50)] List<EventSlotUpsert>? Slots,
    [property: MaxLength(10)] List<QuestionUpsert>? Questions) : IValidatableObject
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
        if (EndTime == StartTime)
        {
            yield return new ValidationResult(
                "EndTime must not equal StartTime. Use an earlier EndTime for an overnight slot.",
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
        if (EndTime == StartTime)
        {
            yield return new ValidationResult(
                "EndTime must not equal StartTime. Use an earlier EndTime for an overnight slot.",
                [nameof(EndTime), nameof(StartTime)]);
        }
    }
}

public record QuestionUpsert(
    Guid? Id,
    [property: Required, NotWhitespace, StringLength(200)] string Label,
    QuestionType? Type,
    bool Required,
    [property: MaxLength(20)] List<string>? Options) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Type is null)
        {
            yield return new ValidationResult(
                "Type is required.",
                [nameof(Type)]);
            yield break;
        }

        if (Type == QuestionType.Dropdown)
        {
            var count = Options?.Count ?? 0;
            if (count == 0)
            {
                yield return new ValidationResult(
                    "Dropdown questions require at least one option.",
                    [nameof(Options)]);
            }
            else if (Options!.Any(o => string.IsNullOrWhiteSpace(o)))
            {
                yield return new ValidationResult(
                    "Options cannot be empty.",
                    [nameof(Options)]);
            }
            else if (Options!.Any(o => o.Trim().Length > 100))
            {
                yield return new ValidationResult(
                    "Each option can be at most 100 characters.",
                    [nameof(Options)]);
            }
        }
        else if (Options is { Count: > 0 })
        {
            yield return new ValidationResult(
                "Options are only allowed for dropdown questions.",
                [nameof(Options)]);
        }
    }
}

public record CreateInviteLinkRequest(
    [property: NotWhitespace, StringLength(100)] string? Name,
    DateTime? ExpiresAt);

public record UpdateInviteLinkRequest(
    [property: Required, NotWhitespace, StringLength(100)] string Name);

// --- Response DTOs ---

public record GroupResponse(Guid Id, string Name, DateTime CreatedAt, int EventCount, int AdminCount);

public record GroupAdminResponse(Guid Id, string? ClerkUserId, string? Name, string? Email, string Role);

public record GroupDetailResponse(
    Guid Id,
    string Name,
    DateTime CreatedAt,
    int EventCount,
    List<GroupAdminResponse> Admins,
    string CurrentUserRole);

public record InviteLinkResponse(Guid Id, Guid? EventId, string Name, string Code, bool IsActive, DateTime CreatedAt, DateTime? ExpiresAt, int SignupCount);

public record EventResponse(Guid Id, Guid GroupId, string Title, string? Description, string? Location, DateOnly Date, RemovalEmailPolicy RemovalEmailPolicy, DateTime CreatedAt);

public record EventWithSlotsResponse(Guid Id, Guid GroupId, string GroupName, string Title, string? Description, string? Location, DateOnly Date, RemovalEmailPolicy RemovalEmailPolicy, DateTime CreatedAt, IEnumerable<TimeSlotResponse> Slots);

public record TimeSlotResponse(Guid Id, Guid EventId, string Label, DateTime StartTime, DateTime EndTime, int Capacity, int SignupCount, bool AllowWaitlist);

public record RosterQuestionResponse(Guid Id, string Label, string Type, bool Required, bool IsDeleted, List<string>? Options)
{
    public static List<RosterQuestionResponse> From(IEnumerable<SignupQuestion> questions) =>
        questions.OrderBy(q => q.SortOrder).Select(q => new RosterQuestionResponse(
            q.Id, q.Label, q.Type.ToString(), q.Required, q.IsDeleted,
            q.Options is null ? null : ParseOptions(q.Options))).ToList();

    private static List<string> ParseOptions(string? options) =>
        string.IsNullOrEmpty(options)
            ? []
            : options.Split('\n').Select(o => o.Trim()).Where(o => o.Length > 0).ToList();
}

public record RosterEventResponse(Guid Id, Guid GroupId, string GroupName, string Title, string? Description, string? Location, DateOnly Date, RemovalEmailPolicy RemovalEmailPolicy, DateTime CreatedAt, List<RosterQuestionResponse> Questions, IEnumerable<RosterSlotResponse> Slots);

public record RosterSlotResponse(Guid Id, string Label, DateTime StartTime, DateTime EndTime, int Capacity, bool AllowWaitlist, IEnumerable<SignupResponse> Signups);

public record SignupResponse(Guid Id, Guid TimeSlotId, string VolunteerName, string Email, string Status, DateTime CreatedAt, List<SignupAnswerResponse> Answers);

public record SignupAnswerResponse(Guid QuestionId, string Value);
