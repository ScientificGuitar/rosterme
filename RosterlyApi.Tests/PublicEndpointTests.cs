using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RosterlyApi.Data;
using RosterlyApi.Entities;
using Xunit;

namespace RosterlyApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class PublicEndpointTests(IntegrationTestFactory factory) : IDisposable
{
    private readonly HttpClient _adminClient = factory.CreateClient();
    private readonly HttpClient _publicClient = factory.CreateClient();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task GetInvitePage_ValidCode_ReturnsOrgAndEvent()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Public Org");

        var response = await _publicClient.GetAsync($"/api/invite/{code}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Public Org", body.GetProperty("organizationName").GetString());

        var evt = body.GetProperty("event");
        Assert.Equal(eventId, evt.GetProperty("id").GetGuid());
        Assert.Equal("Future Event", evt.GetProperty("title").GetString());
        Assert.False(evt.GetProperty("isPast").GetBoolean());

        var slots = evt.GetProperty("slots").EnumerateArray().ToList();
        Assert.Single(slots);
        Assert.False(slots[0].GetProperty("isFull").GetBoolean());
    }

    [Fact]
    public async Task GetInvitePage_InvalidCode_Returns404()
    {
        var response = await _publicClient.GetAsync("/api/invite/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetInvitePage_RevokedLink_Returns404()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Revoked Org");

        Guid linkId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            linkId = (await db.InviteLinks.FirstAsync(l => l.Code == code)).Id;
        }

        var revokeResp = await _adminClient.PutAsync($"/api/invite-links/{linkId}/revoke", null);
        Assert.Equal(HttpStatusCode.NoContent, revokeResp.StatusCode);

        var response = await _publicClient.GetAsync($"/api/invite/{code}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_ValidRequest_Returns201()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Signup Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slot = page.GetProperty("event").GetProperty("slots").EnumerateArray().First();
        var slotId = slot.GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Alice",
            email = "alice@example.com"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Alice", body.GetProperty("volunteerName").GetString());
        Assert.Equal("alice@example.com", body.GetProperty("email").GetString());
        Assert.Equal(slotId, body.GetProperty("slotId").GetGuid());
    }

    [Fact]
    public async Task CreateSignup_TrimsVolunteerName()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Trim Name Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "  Alice  ",
            email = "alice@example.com"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Alice", body.GetProperty("volunteerName").GetString());
    }

    [Fact]
    public async Task CreateSignup_MissingEmail_Returns400()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Missing Email Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "No Email"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_InvalidEmail_Returns400()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Invalid Email Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Bad Email",
            email = "not-an-email"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_ValidRequest_StoresPendingWithTokenHash()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Token Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Token User",
            email = "token@example.com"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var signup = await db.Signups.SingleAsync(s => s.Email == "token@example.com");

        Assert.Equal(SignupStatus.Pending, signup.Status);
        Assert.False(string.IsNullOrEmpty(signup.ManagementTokenHash));
        Assert.Equal(64, signup.ManagementTokenHash.Length);

        // A confirmation email should have been enqueued to the outbox
        var message = await db.EmailMessages.SingleAsync(m => m.To == "token@example.com");
        Assert.False(message.Sent);
        Assert.Contains("/signup/manage/", message.HtmlBody);
    }

    [Fact]
    public async Task GetSignupDetails_ValidToken_AutoConfirmsAndReturnsDetails()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Manage Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var resp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Manager",
            email = "manager@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        string rawToken;
        Guid signupId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var signup = await db.Signups.SingleAsync(s => s.Email == "manager@example.com");
            signupId = signup.Id;
            var message = await db.EmailMessages.SingleAsync(m => m.To == "manager@example.com");
            rawToken = message.HtmlBody
                .Substring(message.HtmlBody.IndexOf("/signup/manage/", StringComparison.Ordinal) + "/signup/manage/".Length)
                .Split('"')[0];
        }

        var manageResp = await _publicClient.GetAsync($"/api/signup/manage/{rawToken}");
        Assert.Equal(HttpStatusCode.OK, manageResp.StatusCode);
        var body = await manageResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);

        Assert.Equal(signupId, body.GetProperty("signupId").GetGuid());
        Assert.Equal("Manager", body.GetProperty("volunteerName").GetString());
        Assert.Equal("manager@example.com", body.GetProperty("email").GetString());
        Assert.Equal("Confirmed", body.GetProperty("status").GetString());
        Assert.Equal("Manage Org", body.GetProperty("organizationName").GetString());
        Assert.Equal("Future Event", body.GetProperty("eventTitle").GetString());
        Assert.Equal("Slot 1", body.GetProperty("slotLabel").GetString());

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var confirmed = await verifyDb.Signups.SingleAsync(s => s.Id == signupId);
        Assert.Equal(SignupStatus.Confirmed, confirmed.Status);
        Assert.NotNull(confirmed.ConfirmedAt);
    }

    [Fact]
    public async Task CancelSignup_ValidToken_MarksCancelled()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Cancel Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var resp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Canceller",
            email = "cancel@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        string rawToken;
        Guid signupId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var signup = await db.Signups.SingleAsync(s => s.Email == "cancel@example.com");
            signupId = signup.Id;
            var message = await db.EmailMessages.SingleAsync(m => m.To == "cancel@example.com");
            rawToken = message.HtmlBody
                .Substring(message.HtmlBody.IndexOf("/signup/manage/", StringComparison.Ordinal) + "/signup/manage/".Length)
                .Split('"')[0];
        }

        var cancelResp = await _publicClient.PostAsync($"/api/signup/manage/{rawToken}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancelResp.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cancelled = await verifyDb.Signups.SingleAsync(s => s.Id == signupId);
        Assert.Equal(SignupStatus.Cancelled, cancelled.Status);
    }

    [Fact]
    public async Task GetSignupDetails_InvalidToken_Returns404()
    {
        var response = await _publicClient.GetAsync("/api/signup/manage/not-a-real-token");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSignupDetails_InvalidToken_ReturnsInvalidManageLinkCode()
    {
        var response = await _publicClient.GetAsync("/api/signup/manage/not-a-real-token");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("invalid_manage_link", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CreateSignup_SlotFull_JoinsWaitlist()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Full Slot Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slot = page.GetProperty("event").GetProperty("slots").EnumerateArray().First();
        var slotId = slot.GetProperty("id").GetGuid();
        var capacity = slot.GetProperty("capacity").GetInt32();

        // Fill the slot to capacity
        for (int i = 0; i < capacity; i++)
        {
            var signupResp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = $"Volunteer {i + 1}",
                email = $"volunteer{i + 1}@example.com"
            });
            Assert.Equal(HttpStatusCode.Created, signupResp.StatusCode);
        }

        // One more joins the waitlist instead of failing
        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Extra Person",
            email = "extra@example.com"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("WaitlistPending", body.GetProperty("status").GetString());
        Assert.Equal(1, body.GetProperty("waitlistPosition").GetInt32());

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var signup = await verifyDb.Signups.SingleAsync(s => s.Email == "extra@example.com");
        Assert.Equal(SignupStatus.WaitlistPending, signup.Status);

        // Pending waitlist signups don't consume capacity
        var refreshed = await _publicClient.GetAsync($"/api/invite/{code}");
        var refreshedPage = await refreshed.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var refreshedSlot = refreshedPage.GetProperty("event").GetProperty("slots").EnumerateArray().First();
        Assert.Equal(capacity, refreshedSlot.GetProperty("signupCount").GetInt32());
        Assert.True(refreshedSlot.GetProperty("isFull").GetBoolean());

        // Waitlist confirmation email is worded differently
        var email = await verifyDb.EmailMessages.SingleAsync(m => m.To == "extra@example.com");
        Assert.StartsWith("You're on the waitlist:", email.Subject);
    }

    [Fact]
    public async Task CreateSignup_SlotFullWaitlistDisabled_Returns409WithCode()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("No Waitlist Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        // Disable the waitlist via the admin slot endpoint
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var slotEntityId = await db.TimeSlots
                .Where(s => s.EventId == eventId)
                .Select(s => s.Id)
                .SingleAsync();
            slotId = slotEntityId;
        }

        var disableResp = await _adminClient.PutAsJsonAsync(
            $"/api/events/{eventId}/slots/{slotId}", new { allowWaitlist = false });
        Assert.Equal(HttpStatusCode.OK, disableResp.StatusCode);

        for (int i = 0; i < 3; i++)
        {
            var signupResp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = $"Volunteer {i + 1}",
                email = $"nowait{i + 1}@example.com"
            });
            Assert.Equal(HttpStatusCode.Created, signupResp.StatusCode);
        }

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Extra Person",
            email = "nowait-extra@example.com"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("waitlist_disabled", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Waitlist_CancelPromotesOldestFirst()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Promote Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        // A takes the only... (capacity 3: fill with A, B, C then waitlist D, E)
        foreach (var (name, email) in new[] { ("A", "wl-a@example.com"), ("B", "wl-b@example.com"), ("C", "wl-c@example.com") })
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = name,
                email
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }
        foreach (var (name, email) in new[] { ("A", "wl-a@example.com"), ("B", "wl-b@example.com"), ("C", "wl-c@example.com") })
        {
            string token;
            using (var scope = factory.Services.CreateScope())
                token = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), email);
            var confirm = await _publicClient.GetAsync($"/api/signup/manage/{token}");
            Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        }

        // D and E join the waitlist (D first)
        foreach (var (name, email) in new[] { ("D", "wl-d@example.com"), ("E", "wl-e@example.com") })
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = name,
                email
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }
        string tokenD, tokenE;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            tokenD = ExtractManageToken(db, "wl-d@example.com");
        }
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // E confirms after D so D is ahead in the queue
            var confirmD = await _publicClient.GetAsync($"/api/signup/manage/{tokenD}");
            Assert.Equal(HttpStatusCode.OK, confirmD.StatusCode);
        }
        using (var scope = factory.Services.CreateScope())
            tokenE = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "wl-e@example.com");
        var confirmE = await _publicClient.GetAsync($"/api/signup/manage/{tokenE}");
        Assert.Equal(HttpStatusCode.OK, confirmE.StatusCode);

        // A cancels -> D (oldest waitlisted) auto-promotes, E stays queued
        string tokenA;
        using (var scope = factory.Services.CreateScope())
            tokenA = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "wl-a@example.com");
        var cancel = await _publicClient.PostAsync($"/api/signup/manage/{tokenA}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Confirmed,
            (await verifyDb.Signups.SingleAsync(s => s.Email == "wl-d@example.com")).Status);
        Assert.Equal(SignupStatus.Waitlisted,
            (await verifyDb.Signups.SingleAsync(s => s.Email == "wl-e@example.com")).Status);

        var promo = await verifyDb.EmailMessages
            .Where(m => m.To == "wl-d@example.com")
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        Assert.StartsWith("You're in:", promo.Subject);
    }

    [Fact]
    public async Task Waitlist_LateConfirmerStaysBehindQueue()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Late Confirm Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        foreach (var (name, email) in new[] { ("A", "late-a@example.com"), ("B", "late-b@example.com"), ("C", "late-c@example.com") })
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = name,
                email
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }

        // F joins waitlist but doesn't confirm yet; G joins and confirms first
        var f = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "F",
            email = "late-f@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, f.StatusCode);
        var g = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "G",
            email = "late-g@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, g.StatusCode);

        string tokenG;
        using (var scope = factory.Services.CreateScope())
            tokenG = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "late-g@example.com");
        Assert.Equal(HttpStatusCode.OK, (await _publicClient.GetAsync($"/api/signup/manage/{tokenG}")).StatusCode);

        string tokenF;
        using (var scope = factory.Services.CreateScope())
            tokenF = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "late-f@example.com");
        var confirmF = await _publicClient.GetAsync($"/api/signup/manage/{tokenF}");
        Assert.Equal(HttpStatusCode.OK, confirmF.StatusCode);
        var bodyF = await confirmF.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Waitlisted", bodyF.GetProperty("status").GetString());
        Assert.Equal(2, bodyF.GetProperty("waitlistPosition").GetInt32());
    }

    [Fact]
    public async Task Waitlist_DuplicateWaitlisted_Returns409WithCode()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Dup Waitlist Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        for (int i = 0; i < 3; i++)
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = $"V{i}",
                email = $"dup-wl-{i}@example.com"
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }

        var join = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "W",
            email = "dup-wl@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        string token;
        using (var scope = factory.Services.CreateScope())
            token = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "dup-wl@example.com");
        Assert.Equal(HttpStatusCode.OK, (await _publicClient.GetAsync($"/api/signup/manage/{token}")).StatusCode);

        var again = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "W",
            email = "dup-wl@example.com"
        });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        var body = await again.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("duplicate_waitlisted", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Waitlist_CapacityIncrease_PromotesInOrder()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Capacity Bump Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        foreach (var (name, email) in new[] { ("A", "cap-a@example.com"), ("B", "cap-b@example.com"), ("C", "cap-c@example.com") })
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = name,
                email
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }

        foreach (var email in new[] { "cap-d@example.com", "cap-e@example.com" })
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = email,
                email
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
            string token;
            using (var scope = factory.Services.CreateScope())
                token = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), email);
            Assert.Equal(HttpStatusCode.OK, (await _publicClient.GetAsync($"/api/signup/manage/{token}")).StatusCode);
        }

        // +2 capacity promotes both D and E
        var bump = await _adminClient.PutAsJsonAsync(
            $"/api/events/{eventId}/slots/{slotId}", new { capacity = 5 });
        Assert.Equal(HttpStatusCode.OK, bump.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Confirmed,
            (await verifyDb.Signups.SingleAsync(s => s.Email == "cap-d@example.com")).Status);
        Assert.Equal(SignupStatus.Confirmed,
            (await verifyDb.Signups.SingleAsync(s => s.Email == "cap-e@example.com")).Status);
    }

    [Fact]
    public async Task Waitlist_OrganizerRemove_PromotesNext()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Remove Promote Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        foreach (var (name, email) in new[] { ("A", "rm-a@example.com"), ("B", "rm-b@example.com"), ("C", "rm-c@example.com") })
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = name,
                email
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
            string token;
            using (var scope = factory.Services.CreateScope())
                token = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), email);
            await _publicClient.GetAsync($"/api/signup/manage/{token}");
        }

        var join = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "W",
            email = "rm-w@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);
        string tokenW;
        using (var scope = factory.Services.CreateScope())
            tokenW = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "rm-w@example.com");
        Assert.Equal(HttpStatusCode.OK, (await _publicClient.GetAsync($"/api/signup/manage/{tokenW}")).StatusCode);

        Guid signupIdA;
        using (var scope = factory.Services.CreateScope())
            signupIdA = (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Signups
                .SingleAsync(s => s.Email == "rm-a@example.com")).Id;

        var remove = await _adminClient.DeleteAsync($"/api/signups/{signupIdA}");
        Assert.Equal(HttpStatusCode.NoContent, remove.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Confirmed,
            (await verifyDb.Signups.SingleAsync(s => s.Email == "rm-w@example.com")).Status);
    }

    [Fact]
    public async Task CancelSignup_AfterOrganizerRemoval_Returns409WithCode()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Cancel Removed Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var join = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Removed User",
            email = "cancel-removed@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        string rawToken;
        Guid signupId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var signup = await db.Signups.SingleAsync(s => s.Email == "cancel-removed@example.com");
            signupId = signup.Id;
            rawToken = ExtractManageToken(db, "cancel-removed@example.com");
        }

        var remove = await _adminClient.DeleteAsync($"/api/signups/{signupId}");
        Assert.Equal(HttpStatusCode.NoContent, remove.StatusCode);

        var cancel = await _publicClient.PostAsync($"/api/signup/manage/{rawToken}/cancel", null);
        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);
        var body = await cancel.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("removed_by_organization", body.GetProperty("code").GetString());

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Removed,
            (await verifyDb.Signups.SingleAsync(s => s.Id == signupId)).Status);
    }

    [Fact]
    public async Task Waitlist_ManagePage_ShowsPosition()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Position Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        for (int i = 0; i < 3; i++)
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = $"V{i}",
                email = $"pos-{i}@example.com"
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }

        var join = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "W",
            email = "pos-w@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        string token;
        using (var scope = factory.Services.CreateScope())
            token = ExtractManageToken(scope.ServiceProvider.GetRequiredService<AppDbContext>(), "pos-w@example.com");
        var details = await _publicClient.GetAsync($"/api/signup/manage/{token}");
        Assert.Equal(HttpStatusCode.OK, details.StatusCode);
        var body = await details.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Waitlisted", body.GetProperty("status").GetString());
        Assert.Equal(1, body.GetProperty("waitlistPosition").GetInt32());
    }

    [Fact]
    public async Task GetInvitePage_PastEvent_MarksIsPast()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Past Mark Org");
        await MoveEventToPastAsync(eventId);

        var response = await _publicClient.GetAsync($"/api/invite/{code}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var evt = body.GetProperty("event");
        Assert.True(evt.GetProperty("isPast").GetBoolean());
    }

    [Fact]
    public async Task CreateSignup_PastEvent_Returns400WithCode()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Past Slot Org");

        var getPage = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        await MoveEventToPastAsync(eventId);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Late User",
            email = "late@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("event_in_past", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CreateSignup_InvalidCode_Returns404()
    {
        var response = await _publicClient.PostAsJsonAsync("/api/invite/badcode/signups", new
        {
            slotId = Guid.NewGuid(),
            volunteerName = "Nobody",
            email = "nobody@example.com"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_SlotFromDifferentEvent_Returns404()
    {
        var (orgId, eventId, code) = await SeedInviteLinkAsync("Scoped Org");

        // Create a second event under the same org with its own slot, then look up its slot id
        var otherEventResp = await _adminClient.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Other Event",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd"),
            slots = new[] { new { label = "Other Slot", startTime = "08:00", endTime = "09:00", capacity = 5 } }
        });
        var otherEvent = await otherEventResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var otherEventId = otherEvent.GetProperty("id").GetGuid();
        Assert.NotEqual(eventId, otherEventId);

        var otherSlotId = (await _adminClient.GetFromJsonAsync<JsonElement>(
            $"/api/events/{otherEventId}", _jsonOptions))
            .GetProperty("slots").EnumerateArray().First()
            .GetProperty("id").GetGuid();

        // Try to sign up for the other event's slot using the original invite code
        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId = otherSlotId,
            volunteerName = "Sneaky",
            email = "sneaky@example.com"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_DuplicatePendingSameEmailAndSlot_Returns409WithCode()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Dup Pending Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Dup User",
            email = "dup@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Dup User",
            email = "dup@example.com"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("duplicate_pending", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CreateSignup_DuplicateConfirmedSameEmailAndSlot_Returns409WithCode()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Dup Confirmed Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Confirmed Dup",
            email = "confdup@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        // Confirm it by hitting the manage page
        string rawToken;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            rawToken = ExtractManageToken(db, "confdup@example.com");
        }
        var confirm = await _publicClient.GetAsync($"/api/signup/manage/{rawToken}");
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Confirmed Dup",
            email = "confdup@example.com"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("duplicate_confirmed", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CreateSignup_CaseInsensitiveDuplicate_Returns409()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Case Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Case User",
            email = "Case@Example.COM"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Case User",
            email = "case@example.com"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_SameEmailDifferentSlot_Returns201()
    {
        var (orgId, eventId, code) = await SeedInviteLinkAsync("Multi Slot Org");

        var slotResp = await _adminClient.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "Slot 2",
            startTime = "10:00",
            endTime = "11:00",
            capacity = 3
        });
        Assert.Equal(HttpStatusCode.Created, slotResp.StatusCode);

        var page = await GetInvitePageJsonAsync(code);
        Assert.Equal(2, page.Slots.Length);
        var slot1 = page.Slots[0].Id;
        var slot2 = page.Slots[1].Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId = slot1,
            volunteerName = "Multi",
            email = "multi@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId = slot2,
            volunteerName = "Multi",
            email = "multi@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_ReSignupAfterCancel_Returns201()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Re Signup Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Re User",
            email = "re@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        string rawToken;
        Guid cancelledId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            cancelledId = db.Signups.Single(s => s.Email == "re@example.com").Id;
            rawToken = ExtractManageToken(db, "re@example.com");
        }

        var cancel = await _publicClient.PostAsync($"/api/signup/manage/{rawToken}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        var again = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Re User",
            email = "re@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, again.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await verifyDb.Signups.Where(s => s.Email == "re@example.com").ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.Contains(rows, s => s.Id == cancelledId && s.Status == SignupStatus.Cancelled);
        Assert.Contains(rows, s => s.Status == SignupStatus.Pending);
    }

    [Fact]
    public async Task ResendSignup_Pending_Returns200RotatesTokenAndEnqueuesEmail()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Resend Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Resend User",
            email = "resend@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        string originalHash;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            originalHash = db.Signups.Single(s => s.Email == "resend@example.com").ManagementTokenHash;
        }

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups/resend", new
        {
            slotId,
            email = "resend@example.com"
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var signup = await verifyDb.Signups.SingleAsync(s => s.Email == "resend@example.com");
        Assert.NotEqual(originalHash, signup.ManagementTokenHash);
        Assert.Equal(SignupStatus.Pending, signup.Status);

        var emails = await verifyDb.EmailMessages.Where(m => m.To == "resend@example.com").ToListAsync();
        Assert.Equal(2, emails.Count);
    }

    [Fact]
    public async Task ResendSignup_Confirmed_Returns409()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Resend Confirmed Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var first = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "RC User",
            email = "rc@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        string rawToken;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            rawToken = ExtractManageToken(db, "rc@example.com");
        }
        var confirm = await _publicClient.GetAsync($"/api/signup/manage/{rawToken}");
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups/resend", new
        {
            slotId,
            email = "rc@example.com"
        });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("already_confirmed", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task ResendSignup_Waitlisted_Returns409WithCode()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Resend Waitlisted Org");
        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        for (int i = 0; i < 3; i++)
        {
            var r = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId,
                volunteerName = $"V{i}",
                email = $"rw-{i}@example.com"
            });
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }

        var join = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "W",
            email = "rw-w@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        string rawToken;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            rawToken = ExtractManageToken(db, "rw-w@example.com");
        }
        var confirm = await _publicClient.GetAsync($"/api/signup/manage/{rawToken}");
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups/resend", new
        {
            slotId,
            email = "rw-w@example.com"
        });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("already_waitlisted", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task ResendSignup_UnknownEmail_Returns404()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Resend Missing Org");

        var page = await GetInvitePageJsonAsync(code);
        var slotId = page.Slots.First().Id;

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups/resend", new
        {
            slotId,
            email = "nobody@example.com"
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Helpers ---

    // --- Signup Questions & Answers ---

    [Fact]
    public async Task GetInvitePage_ReturnsNonDeletedQuestionsInOrder()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Invite Questions Org");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var deleted = await db.SignupQuestions
                .FirstAsync(q => q.EventId == eventId && q.Type == QuestionType.Phone);
            deleted.IsDeleted = true;
            await db.SaveChangesAsync();
        }

        var response = await _publicClient.GetAsync($"/api/invite/{code}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var page = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var questions = page.GetProperty("event").GetProperty("questions").EnumerateArray().ToList();

        Assert.Equal(2, questions.Count);
        Assert.Equal("T-shirt size", questions[0].GetProperty("label").GetString());
        Assert.Equal("Dropdown", questions[0].GetProperty("type").GetString());
        Assert.True(questions[0].GetProperty("required").GetBoolean());
        var options = questions[0].GetProperty("options").EnumerateArray().Select(o => o.GetString()).ToList();
        Assert.Equal(["S", "M", "L"], options);
        Assert.Equal("Emergency contact", questions[1].GetProperty("label").GetString());
        Assert.Equal("ShortText", questions[1].GetProperty("type").GetString());
        // Deleted question must not appear.
        Assert.DoesNotContain(questions, q => q.GetProperty("type").GetString() == "Phone");
    }

    [Fact]
    public async Task CreateSignup_WithAnswers_StoresAnswersInSameTransaction()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Answers Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var evt = await _adminClient.GetAsync($"/api/events/{eventId}");
        Assert.Equal(HttpStatusCode.OK, evt.StatusCode);
        var evtJson = await evt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var questions = evtJson.GetProperty("questions").EnumerateArray().ToList();
        var sizeId = questions[0].GetProperty("id").GetGuid();
        var phoneId = questions[1].GetProperty("id").GetGuid();
        var contactId = questions[2].GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Answering Alice",
            email = "answers@example.com",
            answers = new object[]
            {
                new { questionId = sizeId, value = "M" },
                new { questionId = phoneId, value = "+1 (555) 123-4567" },
                new { questionId = contactId, value = "Jane Doe" }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var signup = await db.Signups.Include(s => s.Answers)
                .FirstAsync(s => s.Email == "answers@example.com");
            Assert.Equal(3, signup.Answers.Count);
            Assert.Contains(signup.Answers, a => a.Value == "M");
            Assert.Contains(signup.Answers, a => a.Value == "+1 (555) 123-4567");
            Assert.Contains(signup.Answers, a => a.Value == "Jane Doe");
        }
    }

    [Fact]
    public async Task CreateSignup_OptionalQuestionOmitted_Succeeds()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Optional Omitted Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var evt = await _adminClient.GetAsync($"/api/events/{eventId}");
        var evtJson = await evt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var questions = evtJson.GetProperty("questions").EnumerateArray().ToList();
        var sizeId = questions.First(q => q.GetProperty("type").GetString() == "Dropdown").GetProperty("id").GetGuid();
        var contactId = questions.First(q => q.GetProperty("type").GetString() == "ShortText").GetProperty("id").GetGuid();

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "No Phone",
            email = "nophone@example.com",
            answers = new object[]
            {
                new { questionId = sizeId, value = "M" },
                new { questionId = contactId, value = "Jane Doe" }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_MissingRequiredQuestion_Returns400()
    {
        var (_, _, code) = await SeedEventWithQuestionsAsync("Missing Required Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "No Answer",
            email = "missing@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.True(body.GetProperty("errors").EnumerateObject().Any());
    }

    [Fact]
    public async Task CreateSignup_InvalidPhone_Returns400()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Bad Phone Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var phoneId = await GetQuestionIdAsync(eventId, QuestionType.Phone);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Bad Phone",
            email = "badphone@example.com",
            answers = new[] { new { questionId = phoneId, value = "not-a-phone" } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_DropdownValueNotInOptions_Returns400()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Bad Dropdown Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var sizeId = await GetQuestionIdAsync(eventId, QuestionType.Dropdown);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Bad Size",
            email = "badsize@example.com",
            answers = new[] { new { questionId = sizeId, value = "XXL" } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_DuplicateAnswer_Returns400()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Dup Answer Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var sizeId = await GetQuestionIdAsync(eventId, QuestionType.Dropdown);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Dup Answer",
            email = "dupanswer@example.com",
            answers = new object[]
            {
                new { questionId = sizeId, value = "M" },
                new { questionId = sizeId, value = "L" }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_UnknownQuestion_Returns400()
    {
        var (_, _, code) = await SeedEventWithQuestionsAsync("Unknown Question Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Unknown Q",
            email = "unknownq@example.com",
            answers = new[] { new { questionId = Guid.NewGuid(), value = "anything" } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_DeletedQuestionAnswer_Returns400()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Deleted Question Org");
        var slotId = await GetFirstSlotIdAsync(code);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var deleted = await db.SignupQuestions
                .FirstAsync(q => q.EventId == eventId && q.Type == QuestionType.Phone);
            deleted.IsDeleted = true;
            await db.SaveChangesAsync();
        }

        var phoneId = await GetQuestionIdAsync(eventId, QuestionType.Phone);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Deleted Q",
            email = "deletedq@example.com",
            answers = new[] { new { questionId = phoneId, value = "+1 555 123 4567" } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_AnswerTooLong_Returns400()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Long Answer Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var contactId = await GetQuestionIdAsync(eventId, QuestionType.ShortText);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Long Answer",
            email = "longanswer@example.com",
            answers = new[] { new { questionId = contactId, value = new string('x', 501) } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSignup_EmptyAndWhitespaceAnswers_AreIgnored()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Empty Answers Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var sizeId = await GetQuestionIdAsync(eventId, QuestionType.Dropdown);
        var phoneId = await GetQuestionIdAsync(eventId, QuestionType.Phone);
        var contactId = await GetQuestionIdAsync(eventId, QuestionType.ShortText);

        // Empty entry first, then a real answer for the same question; plus a
        // whitespace-only answer for another question.
        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Empty Answers",
            email = "emptyanswers@example.com",
            answers = new object[]
            {
                new { questionId = sizeId, value = "" },
                new { questionId = sizeId, value = "M" },
                new { questionId = phoneId, value = "   " },
                new { questionId = contactId, value = "Jane Doe" }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var signup = await db.Signups.Include(s => s.Answers)
                .FirstAsync(s => s.Email == "emptyanswers@example.com");
            Assert.Equal(2, signup.Answers.Count);
            Assert.Contains(signup.Answers, a => a.Value == "M");
            Assert.Contains(signup.Answers, a => a.Value == "Jane Doe");
        }
    }

    [Fact]
    public async Task CreateSignup_EmptyAnswerForUnknownQuestion_Ignored()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Empty Unknown Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var sizeId = await GetQuestionIdAsync(eventId, QuestionType.Dropdown);
        var contactId = await GetQuestionIdAsync(eventId, QuestionType.ShortText);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Empty Unknown",
            email = "emptyunknown@example.com",
            answers = new object[]
            {
                new { questionId = Guid.NewGuid(), value = "" },
                new { questionId = sizeId, value = "L" },
                new { questionId = contactId, value = "Jane Doe" }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var signup = await db.Signups.Include(s => s.Answers)
                .FirstAsync(s => s.Email == "emptyunknown@example.com");
            Assert.Equal(2, signup.Answers.Count);
        }
    }

    [Fact]
    public async Task CreateSignup_WhitespaceOnlyRequiredAnswer_Returns400()
    {
        var (_, eventId, code) = await SeedEventWithQuestionsAsync("Whitespace Required Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var sizeId = await GetQuestionIdAsync(eventId, QuestionType.Dropdown);
        var contactId = await GetQuestionIdAsync(eventId, QuestionType.ShortText);

        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Whitespace Required",
            email = "whitespace@example.com",
            answers = new object[]
            {
                new { questionId = sizeId, value = " " },
                new { questionId = contactId, value = "Jane Doe" }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var errors = body.GetProperty("errors");
        Assert.True(errors.EnumerateObject().Any(e =>
            e.Value.EnumerateArray().Any(m =>
                m.GetString()!.Contains("required", StringComparison.OrdinalIgnoreCase))));
    }

    private async Task<(Guid orgId, Guid eventId, string code)> SeedEventWithQuestionsAsync(string orgName)
    {
        var resp = await _adminClient.PostAsJsonAsync("/api/organizations", new { name = orgName });
        var org = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var orgId = org.GetProperty("id").GetGuid();

        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var evtResp = await _adminClient.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Questions Event",
            date = futureDate.ToString("yyyy-MM-dd"),
            slots = new[]
            {
                new { label = "Slot 1", startTime = "08:00", endTime = "09:00", capacity = 3 }
            },
            questions = new object[]
            {
                new { label = "T-shirt size", type = "Dropdown", required = true, options = new[] { "S", "M", "L" } },
                new { label = "Phone", type = "Phone", required = false },
                new { label = "Emergency contact", type = "ShortText", required = true }
            }
        });
        var evt = await evtResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var linkResp = await _adminClient.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        return (orgId, eventId, code);
    }

    private async Task<Guid> GetFirstSlotIdAsync(string code)
    {
        var page = await _publicClient.GetAsync($"/api/invite/{code}");
        var pageJson = await page.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return pageJson.GetProperty("event").GetProperty("slots").EnumerateArray()
            .First().GetProperty("id").GetGuid();
    }

    private async Task<Guid> GetQuestionIdAsync(Guid eventId, QuestionType type)
    {
        var evt = await _adminClient.GetAsync($"/api/events/{eventId}");
        var evtJson = await evt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return evtJson.GetProperty("questions").EnumerateArray()
            .First(q => q.GetProperty("type").GetString() == type.ToString())
            .GetProperty("id").GetGuid();
    }

    private async Task MoveEventToPastAsync(Guid eventId)
    {
        // The API no longer allows creating past events, so move the event into
        // the past directly to exercise past-slot behavior.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var evt = await db.Events.SingleAsync(e => e.Id == eventId);
        evt.Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        await db.SaveChangesAsync();
    }

    private sealed record InviteSlotTestData(Guid Id);

    private sealed record InvitePageTestData(InviteSlotTestData[] Slots);

    private async Task<InvitePageTestData> GetInvitePageJsonAsync(string code)
    {
        var resp = await _publicClient.GetAsync($"/api/invite/{code}");
        var page = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slots = page.GetProperty("event").GetProperty("slots").EnumerateArray()
            .Select(s => new InviteSlotTestData(s.GetProperty("id").GetGuid()))
            .ToArray();
        return new InvitePageTestData(slots);
    }

    private static string ExtractManageToken(AppDbContext db, string email)
    {
        var message = db.EmailMessages.Single(m => m.To == email);
        const string marker = "/signup/manage/";
        var start = message.HtmlBody.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
        return message.HtmlBody.Substring(start).Split('"')[0];
    }

    private async Task<(Guid orgId, Guid eventId, string code)> SeedInviteLinkAsync(string name)    {
        var resp = await _adminClient.PostAsJsonAsync("/api/organizations", new { name });
        var org = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var orgId = org.GetProperty("id").GetGuid();

        // Create a future event with a slot so the invite page has data
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var evtResp = await _adminClient.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Future Event",
            date = futureDate.ToString("yyyy-MM-dd"),
            slots = new[]
            {
                new { label = "Slot 1", startTime = "08:00", endTime = "09:00", capacity = 3 }
            }
        });
        var evt = await evtResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var linkResp = await _adminClient.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        return (orgId, eventId, code);
    }

    public void Dispose()
    {
        _adminClient.Dispose();
        _publicClient.Dispose();
    }
}
