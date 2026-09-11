using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RosterlyApi.Data;
using RosterlyApi.Entities;
using Xunit;

namespace RosterlyApi.Tests;

public class AdminEndpointTests : IClassFixture<IntegrationTestFactory>
{
    private readonly IntegrationTestFactory _factory;
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AdminEndpointTests(IntegrationTestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // --- Organization ---

    [Fact]
    public async Task CreateOrganization_Returns201()
    {
        var response = await _client.PostAsJsonAsync("/api/organizations", new { name = "Test Church" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Test Church", body.GetProperty("name").GetString());
        Assert.NotEqual(Guid.Empty, body.GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task CreateOrganization_TrimsName()
    {
        var response = await _client.PostAsJsonAsync("/api/organizations", new { name = "  Padded Church  " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Padded Church", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task CreateEvent_TrimsTitleAndSlotLabel()
    {
        var orgId = await SeedOrgAsync("Trim Org");

        var response = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "  Sunday Service  ",
            description = "  Morning gathering  ",
            location = "  123 Main St  ",
            date = FutureDate(),
            slots = new[]
            {
                new { label = "  Morning  ", startTime = "08:00", endTime = "09:00", capacity = 3 }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var evt = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        Assert.Equal("Sunday Service", evt.GetProperty("title").GetString());
        Assert.Equal("Morning gathering", evt.GetProperty("description").GetString());
        Assert.Equal("123 Main St", evt.GetProperty("location").GetString());
        Assert.Equal("Morning", evt.GetProperty("slots").EnumerateArray().First().GetProperty("label").GetString());
    }

    [Fact]
    public async Task GetOrganization_ReturnsOrg()
    {
        var orgId = await SeedOrgAsync("Simple Org");

        var response = await _client.GetAsync($"/api/organizations/{orgId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Simple Org", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetOrganization_OtherUsersOrg_Returns404()
    {
        var otherOrgId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Organizations.Add(new Organization
            {
                Id = otherOrgId,
                Name = "Other Org",
                ClerkUserId = TestAuthHandler.OtherUserId,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync($"/api/organizations/{otherOrgId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Events ---

    [Fact]
    public async Task CreateEvent_Returns201()
    {
        var orgId = await SeedOrgAsync("Event Org");

        var response = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Sunday Service",
            date = FutureDate()
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Sunday Service", body.GetProperty("title").GetString());
    }

    [Fact]
    public async Task CreateEvent_WithInlineSlots_Returns201WithSlots()
    {
        var orgId = await SeedOrgAsync("Slots Org");
        var eventDate = FutureDate();

        var response = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Service With Slots",
            date = eventDate,
            slots = new[]
            {
                new { label = "Morning", startTime = "08:00", endTime = "09:00", capacity = 3 },
                new { label = "Evening", startTime = "18:00", endTime = "19:00", capacity = 5 }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        // Verify slots appear in roster
        var roster = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/organizations/{orgId}/roster?weekStart={WeekStartFor(eventDate)}", _jsonOptions);
        var events = roster.EnumerateArray().ToList();
        var evt = events.First(e => e.GetProperty("title").GetString() == "Service With Slots");
        var slots = evt.GetProperty("slots").EnumerateArray().ToList();
        Assert.Equal(2, slots.Count);
    }

    [Fact]
    public async Task ListEvents_ByDateRange_ReturnsFilteredEvents()
    {
        var orgId = await SeedOrgAsync("List Org");
        var baseDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));

        await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new { title = "Event 1", date = baseDate.ToString("yyyy-MM-dd") });
        await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new { title = "Event 2", date = baseDate.AddDays(7).ToString("yyyy-MM-dd") });
        await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new { title = "Event 3", date = baseDate.AddDays(14).ToString("yyyy-MM-dd") });

        var response = await _client.GetAsync($"/api/organizations/{orgId}/events?from={baseDate.AddDays(5):yyyy-MM-dd}&to={baseDate.AddDays(10):yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var titles = body.EnumerateArray().Select(e => e.GetProperty("title").GetString()).ToList();
        Assert.Contains("Event 2", titles);
        Assert.DoesNotContain("Event 1", titles);
        Assert.DoesNotContain("Event 3", titles);
    }

    [Fact]
    public async Task UpdateEvent_UpdatesFields()
    {
        var orgId = await SeedOrgAsync("Update Org");
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events",
            new { title = "Old Title", date = FutureDate() });
        var created = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}",
            new { title = "New Title" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("New Title", body.GetProperty("title").GetString());
    }

    [Fact]
    public async Task UpdateEvent_EmptyDescription_ClearsDescription()
    {
        var orgId = await SeedOrgAsync("Clear Description Org");
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events",
            new { title = "Described Event", description = "Old description", date = FutureDate() });
        var created = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}",
            new { description = "" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("description").ValueKind);
    }

    [Fact]
    public async Task UpdateEvent_WhitespaceDescription_ClearsDescription()
    {
        var orgId = await SeedOrgAsync("Clear Whitespace Description Org");
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events",
            new { title = "Described Event", description = "Old description", date = FutureDate() });
        var created = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}",
            new { description = "   " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("description").ValueKind);
    }

    [Fact]
    public async Task UpdateEvent_WithSlotSync_CreatesUpdatesAndDeletesAtomically()
    {
        var orgId = await SeedOrgAsync("Sync Slots Org");
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Sync Event",
            date = FutureDate(),
            slots = new[]
            {
                new { label = "Keep", startTime = "08:00", endTime = "09:00", capacity = 2 },
                new { label = "Drop", startTime = "10:00", endTime = "11:00", capacity = 2 }
            }
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var before = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        var keepId = before.GetProperty("slots").EnumerateArray()
            .First(s => s.GetProperty("label").GetString() == "Keep")
            .GetProperty("id").GetGuid();

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            title = "Sync Event Updated",
            slots = new object[]
            {
                new { id = keepId, label = "Keep Renamed", startTime = "08:00", endTime = "09:30", capacity = 4 },
                new { label = "Brand New", startTime = "12:00", endTime = "13:00", capacity = 5 }
            }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var after = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        Assert.Equal("Sync Event Updated", after.GetProperty("title").GetString());
        var afterSlots = after.GetProperty("slots").EnumerateArray().ToList();
        Assert.Equal(2, afterSlots.Count);
        Assert.DoesNotContain(afterSlots, s => s.GetProperty("label").GetString() == "Drop");
        var renamed = afterSlots.First(s => s.GetProperty("label").GetString() == "Keep Renamed");
        Assert.Equal(keepId, renamed.GetProperty("id").GetGuid());
        Assert.Equal(4, renamed.GetProperty("capacity").GetInt32());
        Assert.Contains(afterSlots, s => s.GetProperty("label").GetString() == "Brand New");
    }

    [Fact]
    public async Task UpdateEvent_WithSlots_CapacityBelowSignupCount_Returns400()
    {
        var (_, eventId, slotId) = await SeedSlotAsync("Sync Cap Org");

        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        foreach (var email in new[] { "one@example.com", "two@example.com" })
        {
            var signupResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups",
                new { slotId, volunteerName = "Vol", email });
            Assert.Equal(HttpStatusCode.Created, signupResp.StatusCode);
        }

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            slots = new object[]
            {
                new { id = slotId, label = "Test Slot", startTime = "09:00", endTime = "10:00", capacity = 1 }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEvent_WithSlots_InvalidTimes_Returns400()
    {
        var (_, eventId, slotId) = await SeedSlotAsync("Sync Times Org");

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            slots = new object[]
            {
                new { id = slotId, label = "Test Slot", startTime = "10:00", endTime = "09:00", capacity = 3 }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEvent_OmitsSlots_LeavesSlotsUntouched()
    {
        var (_, eventId, _) = await SeedSlotAsync("Sync Omit Org");

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}",
            new { title = "Renamed Only" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var after = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        Assert.Equal("Renamed Only", after.GetProperty("title").GetString());
        Assert.Single(after.GetProperty("slots").EnumerateArray());
    }

    [Fact]
    public async Task UpdateEvent_WithSlots_UnknownSlotId_Returns404()
    {
        var (_, eventId, _) = await SeedSlotAsync("Sync Unknown Org");

        var response = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            slots = new object[]
            {
                new { id = Guid.NewGuid(), label = "Ghost", startTime = "09:00", endTime = "10:00", capacity = 2 }
            }
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEvent_RemovesEvent()
    {
        var orgId = await SeedOrgAsync("Delete Org");
        var eventDate = FutureDate();
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events",
            new { title = "To Delete", date = eventDate });
        var created = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var response = await _client.DeleteAsync($"/api/events/{eventId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var roster = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/organizations/{orgId}/roster?weekStart={WeekStartFor(eventDate)}", _jsonOptions);
        Assert.Empty(roster.EnumerateArray());
    }

    // --- Slots ---

    [Fact]
    public async Task CreateSlot_Returns201()
    {
        var orgId = await SeedOrgAsync("Slot Org");
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events",
            new { title = "Slot Event", date = FutureDate() });
        var created = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = created.GetProperty("id").GetGuid();

        var response = await _client.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "Test Slot",
            startTime = "10:00",
            endTime = "11:00",
            capacity = 4
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Test Slot", body.GetProperty("label").GetString());
    }



    [Fact]
    public async Task DeleteSlot_RemovesSlot()
    {
        var orgId = await SeedOrgAsync("Del Slot Org");
        var createEvt = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events",
            new { title = "Del Slot Event", date = FutureDate() });
        var evt = await createEvt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var createSlot = await _client.PostAsJsonAsync($"/api/events/{eventId}/slots",
            new { label = "To Delete", startTime = "09:00", endTime = "10:00", capacity = 2 });
        var slot = await createSlot.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = slot.GetProperty("id").GetGuid();

        var response = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    // --- Roster ---

    [Fact]
    public async Task GetRoster_ReturnsWeeklyData()
    {
        var orgId = await SeedOrgAsync("Roster Org");
        var eventDate = FutureDate();
        var create = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Roster Event",
            date = eventDate,
            slots = new[] { new { label = "Slot 1", startTime = "08:00", endTime = "09:00", capacity = 2 } }
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var response = await _client.GetAsync($"/api/organizations/{orgId}/roster?weekStart={WeekStartFor(eventDate)}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var events = body.EnumerateArray().ToList();
        Assert.NotEmpty(events);
        Assert.Contains(events, e => e.GetProperty("title").GetString() == "Roster Event");
    }

    [Fact]
    public async Task GetRoster_EmptyWeek_ReturnsEmptyList()
    {
        var orgId = await SeedOrgAsync("Empty Org");

        var response = await _client.GetAsync($"/api/organizations/{orgId}/roster?weekStart=2025-01-06");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Empty(body.EnumerateArray());
    }

    // --- Signups ---

    [Fact]
    public async Task AdminDeleteSignup_RemovesSignup()
    {
        var (orgId, eventId, slotId) = await SeedSlotAsync("Admin Del Signup");

        // Create an invite link for this event, sign up via public endpoint
        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        var signupResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups",
            new { slotId, volunteerName = "Jane", email = "jane@example.com" });
        var signup = await signupResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var signupId = signup.GetProperty("id").GetGuid();

        var response = await _client.DeleteAsync($"/api/signups/{signupId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Soft-removed, not hard-deleted
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.Signups.SingleAsync(s => s.Id == signupId);
        Assert.Equal(SignupStatus.Removed, stored.Status);
    }

    [Fact]
    public async Task AdminDeleteSignup_NotifiesVolunteerAndManageLinkShowsRemoved()
    {
        var (_, eventId, slotId) = await SeedSlotAsync("Admin Del Notify");

        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        var signupResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups",
            new { slotId, volunteerName = "Remy", email = "remy@example.com" });
        Assert.Equal(HttpStatusCode.Created, signupResp.StatusCode);
        var signup = await signupResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var signupId = signup.GetProperty("id").GetGuid();

        string rawToken;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var message = await db.EmailMessages.SingleAsync(m => m.To == "remy@example.com");
            rawToken = message.HtmlBody
                .Substring(message.HtmlBody.IndexOf("/signup/manage/", StringComparison.Ordinal) + "/signup/manage/".Length)
                .Split('"')[0];
        }

        var deleteResp = await _client.DeleteAsync($"/api/signups/{signupId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await db.Signups.SingleAsync(s => s.Id == signupId);
            Assert.Equal(SignupStatus.Removed, stored.Status);

            var removal = await db.EmailMessages
                .Where(m => m.To == "remy@example.com")
                .OrderByDescending(m => m.CreatedAt)
                .FirstAsync();
            Assert.Contains("Update on your signup", removal.Subject, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("removed", removal.HtmlBody, StringComparison.OrdinalIgnoreCase);
        }

        // Manage link still resolves, showing Removed instead of "Invalid link"
        var manageResp = await _client.GetAsync($"/api/signup/manage/{rawToken}");
        Assert.Equal(HttpStatusCode.OK, manageResp.StatusCode);
        var manage = await manageResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Removed", manage.GetProperty("status").GetString());

        // Volunteer cancel after removal is rejected with a distinct code
        var cancelResp = await _client.PostAsync($"/api/signup/manage/{rawToken}/cancel", null);
        Assert.Equal(HttpStatusCode.Conflict, cancelResp.StatusCode);
        var cancelBody = await cancelResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("removed_by_organization", cancelBody.GetProperty("code").GetString());

        // Resend after removal reports removal, and the spot is freed for re-signup
        var resendResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups/resend",
            new { slotId, email = "remy@example.com" });
        Assert.Equal(HttpStatusCode.NotFound, resendResp.StatusCode);

        var resSignupResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups",
            new { slotId, volunteerName = "Remy", email = "remy@example.com" });
        Assert.Equal(HttpStatusCode.Created, resSignupResp.StatusCode);
    }

    [Fact]
    public async Task AdminDeleteSignup_AlreadyCancelled_SendsNoEmail()
    {
        var (_, eventId, slotId) = await SeedSlotAsync("Admin Del Cancelled");

        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        var signupResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups",
            new { slotId, volunteerName = "Gone", email = "gone@example.com" });
        var signup = await signupResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var signupId = signup.GetProperty("id").GetGuid();

        string rawToken;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var message = await db.EmailMessages.SingleAsync(m => m.To == "gone@example.com");
            rawToken = message.HtmlBody
                .Substring(message.HtmlBody.IndexOf("/signup/manage/", StringComparison.Ordinal) + "/signup/manage/".Length)
                .Split('"')[0];
        }

        // Volunteer cancels first
        var cancelResp = await _client.PostAsync($"/api/signup/manage/{rawToken}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancelResp.StatusCode);

        int emailCount;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            emailCount = await db.EmailMessages.CountAsync(m => m.To == "gone@example.com");
        }

        var deleteResp = await _client.DeleteAsync($"/api/signups/{signupId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await verifyDb.Signups.SingleAsync(s => s.Id == signupId);
        Assert.Equal(SignupStatus.Cancelled, stored.Status);
        Assert.Equal(emailCount, await verifyDb.EmailMessages.CountAsync(m => m.To == "gone@example.com"));
    }

    // --- Invite Links ---

    [Fact]
    public async Task CreateInviteLink_ReturnsLinkScopedToEvent()
    {
        var (_, eventId, _) = await SeedSlotAsync("Link Org");

        var response = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = body.GetProperty("code").GetString();
        Assert.NotNull(code);
        Assert.Equal(8, code!.Length);
        Assert.True(body.GetProperty("isActive").GetBoolean());
        Assert.Equal(eventId, body.GetProperty("eventId").GetGuid());
    }

    [Fact]
    public async Task CreateInviteLink_OtherUsersEvent_Returns404()
    {
        var otherEventId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var org = new Organization
            {
                Id = Guid.NewGuid(),
                Name = "Other",
                ClerkUserId = TestAuthHandler.OtherUserId,
                CreatedAt = DateTime.UtcNow
            };
            db.Organizations.Add(org);
            db.Events.Add(new Event
            {
                Id = otherEventId,
                OrganizationId = org.Id,
                Title = "Other Event",
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var response = await _client.PostAsJsonAsync($"/api/events/{otherEventId}/invite-links", new { });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListInviteLinks_ReturnsEventLinks()
    {
        var (_, eventId, _) = await SeedSlotAsync("List Link Org");

        await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });

        var response = await _client.GetAsync($"/api/events/{eventId}/invite-links");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var links = body.EnumerateArray().ToList();
        Assert.Equal(2, links.Count);
        Assert.All(links, l => Assert.Equal(eventId, l.GetProperty("eventId").GetGuid()));
    }

    [Fact]
    public async Task RevokeInviteLink_DeactivatesLink()
    {
        var (_, eventId, _) = await SeedSlotAsync("Revoke Link Org");

        var createResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var linkId = created.GetProperty("id").GetGuid();

        var revokeResp = await _client.PutAsync($"/api/invite-links/{linkId}/revoke", null);
        Assert.Equal(HttpStatusCode.NoContent, revokeResp.StatusCode);

        var list = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/invite-links", _jsonOptions);
        var link = list.EnumerateArray().First(l => l.GetProperty("id").GetGuid() == linkId);
        Assert.False(link.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task RevokeInviteLink_OtherUsersLink_Returns404()
    {
        var (_, eventId, _) = await SeedSlotAsync("Revoke Other Link Org");

        // Create the link as the test user
        var createResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var linkId = created.GetProperty("id").GetGuid();

        // Now switch to a different user and try to revoke
        var otherClient = _factory.CreateClient();
        otherClient.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, TestAuthHandler.OtherUserId);

        var revokeResp = await otherClient.PutAsync($"/api/invite-links/{linkId}/revoke", null);
        Assert.Equal(HttpStatusCode.NotFound, revokeResp.StatusCode);
    }

    // --- Helpers ---

    private async Task<Guid> SeedOrgAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/organizations", new { name });
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return body.GetProperty("id").GetGuid();
    }

    private static string FutureDate(int daysAhead = 30) =>
        DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysAhead)).ToString("yyyy-MM-dd");

    private static string WeekStartFor(string dateString)
    {
        var date = DateOnly.Parse(dateString);
        return date.AddDays(-(((int)date.DayOfWeek + 6) % 7)).ToString("yyyy-MM-dd");
    }

    private async Task<(Guid orgId, Guid eventId, Guid slotId)> SeedSlotAsync(string orgName)
    {
        var orgId = await SeedOrgAsync(orgName);
        var eventDate = FutureDate();
        var createEvt = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Test Event",
            date = eventDate,
            slots = new[] { new { label = "Test Slot", startTime = "09:00", endTime = "10:00", capacity = 3 } }
        });
        var evt = await createEvt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        // Fetch the roster to get the slot ID
        var roster = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/organizations/{orgId}/roster?weekStart={WeekStartFor(eventDate)}", _jsonOptions);
        var slotId = roster.EnumerateArray().First()
            .GetProperty("slots").EnumerateArray().First()
            .GetProperty("id").GetGuid();

        return (orgId, eventId, slotId);
    }
}
