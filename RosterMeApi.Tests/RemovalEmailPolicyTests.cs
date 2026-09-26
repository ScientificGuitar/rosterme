using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RosterMeApi.Data;
using RosterMeApi.Entities;
using Xunit;

namespace RosterMeApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class RemovalEmailPolicyTests : IDisposable
{
    private readonly IntegrationTestFactory _factory;
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public RemovalEmailPolicyTests(IntegrationTestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateEvent_DefaultPolicy_IsAsk()
    {
        var orgId = await SeedOrgAsync("Policy Default Org");
        var create = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = "Policy Default Event",
            date = FutureDate()
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var evt = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Ask", evt.GetProperty("removalEmailPolicy").GetString());
    }

    [Fact]
    public async Task CreateEvent_ExplicitAlways_RoundTrips()
    {
        var orgId = await SeedOrgAsync("Policy Always Org");
        var create = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = "Always Event",
            date = FutureDate(),
            removalEmailPolicy = "Always"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var evt = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("Always", evt.GetProperty("removalEmailPolicy").GetString());

        var fetched = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/events/{evt.GetProperty("id").GetGuid()}", _jsonOptions);
        Assert.Equal("Always", fetched.GetProperty("removalEmailPolicy").GetString());
    }

    [Fact]
    public async Task UpdateEvent_PolicyChange_Persisted()
    {
        var (eventId, _, _, _) = await SeedEventWithSignupAsync("Policy Update Org", "Ask", "policy-update@example.com");

        var update = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            removalEmailPolicy = "Never"
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var fetched = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        Assert.Equal("Never", fetched.GetProperty("removalEmailPolicy").GetString());
    }

    [Fact]
    public async Task DeleteSignup_Ask_WithoutNotify_Returns400WithCode()
    {
        var (_, _, _, signupId) = await SeedEventWithSignupAsync("Ask 400 Org", "Ask", "ask-400@example.com");
        var before = await EmailCountAsync("ask-400@example.com");

        var response = await _client.DeleteAsync($"/api/signups/{signupId}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("missing_notify_choice", body.GetProperty("code").GetString());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Pending, (await db.Signups.SingleAsync(s => s.Id == signupId)).Status);
        Assert.Equal(before, await db.EmailMessages.CountAsync(m => m.To == "ask-400@example.com"));
    }

    [Fact]
    public async Task DeleteSignup_Ask_NotifyTrue_SendsRemovedEmail()
    {
        var (_, _, _, signupId) = await SeedEventWithSignupAsync("Ask True Org", "Ask", "ask-true@example.com");

        var response = await _client.DeleteAsync($"/api/signups/{signupId}?notify=true");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Removed, (await db.Signups.SingleAsync(s => s.Id == signupId)).Status);
        var removal = await db.EmailMessages
            .Where(m => m.To == "ask-true@example.com")
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        Assert.Contains("Update on your signup", removal.Subject, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteSignup_Ask_NotifyFalse_SilentButRemoves()
    {
        var (_, _, _, signupId) = await SeedEventWithSignupAsync("Ask False Org", "Ask", "ask-false@example.com");
        var before = await EmailCountAsync("ask-false@example.com");

        var response = await _client.DeleteAsync($"/api/signups/{signupId}?notify=false");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Removed, (await db.Signups.SingleAsync(s => s.Id == signupId)).Status);
        Assert.Equal(before, await db.EmailMessages.CountAsync(m => m.To == "ask-false@example.com"));
    }

    [Fact]
    public async Task DeleteSignup_Never_SilentWithoutParam()
    {
        var (_, _, _, signupId) = await SeedEventWithSignupAsync("Never Org", "Never", "never@example.com");
        var before = await EmailCountAsync("never@example.com");

        var response = await _client.DeleteAsync($"/api/signups/{signupId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Removed, (await db.Signups.SingleAsync(s => s.Id == signupId)).Status);
        Assert.Equal(before, await db.EmailMessages.CountAsync(m => m.To == "never@example.com"));
    }

    [Fact]
    public async Task DeleteSignup_Always_SendsWithoutParam()
    {
        var (_, _, _, signupId) = await SeedEventWithSignupAsync("Always Org", "Always", "always@example.com");

        var response = await _client.DeleteAsync($"/api/signups/{signupId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(SignupStatus.Removed, (await db.Signups.SingleAsync(s => s.Id == signupId)).Status);
        var removal = await db.EmailMessages
            .Where(m => m.To == "always@example.com")
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        Assert.Contains("Update on your signup", removal.Subject, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteSlot_Ask_WithoutNotify_Returns400AndKeepsSlot()
    {
        var (eventId, slotId, _, _) = await SeedEventWithSignupAsync("Slot Ask 400 Org", "Ask", "slot-ask-400@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("missing_notify_choice", body.GetProperty("code").GetString());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.TimeSlots.AnyAsync(s => s.Id == slotId));
    }

    [Fact]
    public async Task DeleteSlot_Ask_NotifyTrue_EmailsSlotDeleted()
    {
        var (eventId, slotId, _, _) = await SeedEventWithSignupAsync("Slot Ask True Org", "Ask", "slot-ask-true@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}?notify=true");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.TimeSlots.AnyAsync(s => s.Id == slotId));
        Assert.False(await db.Signups.AnyAsync(s => s.TimeSlotId == slotId));
        var mail = await db.EmailMessages
            .Where(m => m.To == "slot-ask-true@example.com")
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        Assert.Contains("Shift removed", mail.Subject, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteSlot_Never_SilentWithoutParam()
    {
        var (eventId, slotId, _, _) = await SeedEventWithSignupAsync("Slot Never Org", "Never", "slot-never@example.com");
        var before = await EmailCountAsync("slot-never@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.TimeSlots.AnyAsync(s => s.Id == slotId));
        Assert.Equal(before, await db.EmailMessages.CountAsync(m => m.To == "slot-never@example.com"));
    }

    [Fact]
    public async Task DeleteSlot_Always_SendsWithoutParam()
    {
        var (eventId, slotId, _, _) = await SeedEventWithSignupAsync("Slot Always Org", "Always", "slot-always@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.TimeSlots.AnyAsync(s => s.Id == slotId));
        var mail = await db.EmailMessages
            .Where(m => m.To == "slot-always@example.com")
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        Assert.Contains("Shift removed", mail.Subject, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteSlot_EmptySlot_NeedsNoNotifyChoice()
    {
        var orgId = await SeedOrgAsync("Empty Slot Org");
        var create = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = "Empty Slot Event",
            date = FutureDate(),
            removalEmailPolicy = "Ask",
            slots = new[] { new { label = "Lonely", startTime = "09:00", endTime = "10:00", capacity = 2 } }
        });
        var evt = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();
        var fetched = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        var slotId = fetched.GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEvent_Ask_WithoutNotify_Returns400AndKeepsEvent()
    {
        var (eventId, _, _, _) = await SeedEventWithSignupAsync("Event Ask 400 Org", "Ask", "event-ask-400@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.Events.AnyAsync(e => e.Id == eventId));
    }

    [Fact]
    public async Task DeleteEvent_Ask_NotifyTrue_DedupesOneEmailPerVolunteer()
    {
        // Same volunteer on two slots gets a single cancellation email.
        var orgId = await SeedOrgAsync("Event Dedupe Org");
        var create = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = "Dedupe Event",
            date = FutureDate(),
            removalEmailPolicy = "Ask",
            slots = new[]
            {
                new { label = "Morning", startTime = "08:00", endTime = "09:00", capacity = 5 },
                new { label = "Afternoon", startTime = "13:00", endTime = "14:00", capacity = 5 }
            }
        });
        var evt = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        var fetched = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        foreach (var slot in fetched.GetProperty("slots").EnumerateArray())
        {
            var signup = await _client.PostAsJsonAsync($"/api/invite/{code}/signups", new
            {
                slotId = slot.GetProperty("id").GetGuid(),
                volunteerName = "Dedupe Vol",
                email = "dedupe@example.com"
            });
            Assert.Equal(HttpStatusCode.Created, signup.StatusCode);
        }
        var before = await EmailCountAsync("dedupe@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}?notify=true");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Events.AnyAsync(e => e.Id == eventId));
        var cancellations = await db.EmailMessages
            .Where(m => m.To == "dedupe@example.com" && m.Subject.Contains("Event cancelled"))
            .ToListAsync();
        Assert.Single(cancellations);
        Assert.Equal(before + 1, await db.EmailMessages.CountAsync(m => m.To == "dedupe@example.com"));
    }

    [Fact]
    public async Task DeleteEvent_Never_SilentWithoutParam()
    {
        var (eventId, _, _, _) = await SeedEventWithSignupAsync("Event Never Org", "Never", "event-never@example.com");
        var before = await EmailCountAsync("event-never@example.com");

        var response = await _client.DeleteAsync($"/api/events/{eventId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Events.AnyAsync(e => e.Id == eventId));
        Assert.Equal(before, await db.EmailMessages.CountAsync(m => m.To == "event-never@example.com"));
    }

    [Fact]
    public async Task UpdateEvent_BulkSlotRemove_Ask_RequiresNotifyChoice()
    {
        var (eventId, slotId, _, _) = await SeedEventWithSignupAsync("Bulk Ask Org", "Ask", "bulk-ask@example.com");
        var before = await EmailCountAsync("bulk-ask@example.com");

        // Dropping the only slot without a choice fails and keeps the slot.
        var missing = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            slots = Array.Empty<object>()
        });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.True(await db.TimeSlots.AnyAsync(s => s.Id == slotId));
        }

        var withChoice = await _client.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            notifyOnRemove = true,
            slots = Array.Empty<object>()
        });
        Assert.Equal(HttpStatusCode.OK, withChoice.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await verifyDb.TimeSlots.AnyAsync(s => s.Id == slotId));
        var mail = await verifyDb.EmailMessages
            .Where(m => m.To == "bulk-ask@example.com")
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        Assert.Contains("Shift removed", mail.Subject, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(before + 1, await verifyDb.EmailMessages.CountAsync(m => m.To == "bulk-ask@example.com"));
    }

    // --- Helpers ---

    private async Task<Guid> SeedOrgAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/groups", new { name });
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return body.GetProperty("id").GetGuid();
    }

    private static string FutureDate(int daysAhead = 30) =>
        DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysAhead)).ToString("yyyy-MM-dd");

    private async Task<(Guid eventId, Guid slotId, string code, Guid signupId)> SeedEventWithSignupAsync(
        string orgName, string policy, string email)
    {
        var orgId = await SeedOrgAsync(orgName);
        var create = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = $"{orgName} Event",
            date = FutureDate(),
            removalEmailPolicy = policy,
            slots = new[] { new { label = "Shift", startTime = "09:00", endTime = "10:00", capacity = 3 } }
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var evt = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var fetched = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
        var slotId = fetched.GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        var signupResp = await _client.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Policy Vol",
            email
        });
        Assert.Equal(HttpStatusCode.Created, signupResp.StatusCode);
        var signup = await signupResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);

        return (eventId, slotId, code, signup.GetProperty("id").GetGuid());
    }

    private async Task<int> EmailCountAsync(string to)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.EmailMessages.CountAsync(m => m.To == to);
    }

    public void Dispose() => _client.Dispose();
}
