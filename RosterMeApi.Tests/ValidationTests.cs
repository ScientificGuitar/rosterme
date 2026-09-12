using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RosterMeApi.Data;
using RosterMeApi.Entities;
using RosterMeApi.Validation;
using Xunit;

namespace RosterMeApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class ValidationTests(IntegrationTestFactory factory) : IDisposable
{
    private readonly HttpClient _admin = factory.CreateClient();
    private readonly HttpClient _public = factory.CreateClient();
    private readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    // --- CreateOrganization ---

    [Fact]
    public async Task CreateOrganization_EmptyName_Returns400()
    {
        var response = await _admin.PostAsJsonAsync("/api/organizations", new { name = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Name");
    }

    [Fact]
    public async Task CreateOrganization_WhitespaceName_Returns400()
    {
        var response = await _admin.PostAsJsonAsync("/api/organizations", new { name = "   " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Name");
    }

    [Fact]
    public async Task CreateOrganization_OverlongName_Returns400()
    {
        var response = await _admin.PostAsJsonAsync("/api/organizations", new { name = new string('a', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Name");
    }

    // --- CreateEvent ---

    [Fact]
    public async Task CreateEvent_EmptyTitle_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Title");
    }

    [Fact]
    public async Task CreateEvent_OverlongTitle_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = new string('x', 301),
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Title");
    }

    [Fact]
    public async Task CreateEvent_DefaultDate_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Service",
            date = "0001-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Date");
    }

    [Fact]
    public async Task CreateEvent_PastDate_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Service",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)).ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Date");
    }

    [Fact]
    public async Task UpdateEvent_PastDate_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)).ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Date");
    }

    [Fact]
    public async Task CreateEvent_NegativeSlotCapacity_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Service",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd"),
            slots = new[] { new { label = "Bad", startTime = "08:00", endTime = "09:00", capacity = 0 } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("errors", out var errors));
        var keys = errors.EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains(keys, k => k.StartsWith("Slots[0]"));
    }

    [Fact]
    public async Task CreateEvent_EndBeforeStart_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Service",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd"),
            slots = new[] { new { label = "Backwards", startTime = "10:00", endTime = "09:00", capacity = 2 } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateEvent_MultipleSlotFailures_ReturnsAllErrors()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd"),
            slots = new[]
            {
                new { label = "", startTime = "10:00", endTime = "10:00", capacity = 0 },
                new { label = "Ok", startTime = "11:00", endTime = "12:00", capacity = 1 }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_json);
        var errors = body.GetProperty("errors");
        var fieldKeys = errors.EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains("Title", fieldKeys);
        Assert.Contains(fieldKeys, k => k.StartsWith("Slots[0]"));
    }

    // --- UpdateEvent ---

    [Fact]
    public async Task UpdateEvent_PartialUpdate_NullTitleAllowed()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            description = "Just updating description"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEvent_ExplicitEmptyTitle_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PutAsJsonAsync($"/api/events/{eventId}", new { title = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Title");
    }

    [Fact]
    public async Task UpdateEvent_OverlongDescription_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PutAsJsonAsync($"/api/events/{eventId}", new
        {
            description = new string('d', 2001)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Description");
    }

    // --- CreateSlot ---

    [Fact]
    public async Task CreateSlot_EmptyLabel_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "",
            startTime = "09:00",
            endTime = "10:00",
            capacity = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Label");
    }

    [Fact]
    public async Task CreateSlot_CapacityOverMax_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "Huge",
            startTime = "09:00",
            endTime = "10:00",
            capacity = 10_001
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSlot_EndEqualsStart_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "Zero",
            startTime = "09:00",
            endTime = "09:00",
            capacity = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateSlot_OnlyEndTime_MakesEndBeforeStart_Returns400()
    {
        // Seed slot 09:00–10:00 then PATCH only the end time. With the cross-field
        // check in the handler, sending endTime earlier than the stored startTime
        // must fail with 400 — the previously-loaded value matters, not just the
        // values present in the request body.
        var eventId = await SeedEventAsync();
        var create = await _admin.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "Original",
            startTime = "09:00",
            endTime = "10:00",
            capacity = 3
        });
        var slot = await create.Content.ReadFromJsonAsync<JsonElement>(_json);
        var slotId = slot.GetProperty("id").GetGuid();

        var response = await _admin.PutAsJsonAsync($"/api/events/{eventId}/slots/{slotId}", new
        {
            endTime = "08:00"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "EndTime");
    }

    [Fact]
    public async Task UpdateSlot_BothTimesValid_Returns200()
    {
        // Regression guard: a valid end-only PATCH must still succeed and persist.
        var eventId = await SeedEventAsync();
        var create = await _admin.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "Original",
            startTime = "09:00",
            endTime = "10:00",
            capacity = 3
        });
        var slot = await create.Content.ReadFromJsonAsync<JsonElement>(_json);
        var slotId = slot.GetProperty("id").GetGuid();

        var response = await _admin.PutAsJsonAsync($"/api/events/{eventId}/slots/{slotId}", new
        {
            endTime = "11:00"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // --- Public signup ---

    [Fact]
    public async Task CreateSignup_EmptyName_Returns400()
    {
        var (_, _, code) = await SeedInviteLinkAsync();

        var getPage = await _public.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_json);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _public.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "",
            email = "alice@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "VolunteerName");
    }

    [Fact]
    public async Task CreateSignup_EmptyGuidSlotId_Returns400()
    {
        var (_, _, code) = await SeedInviteLinkAsync();

        var response = await _public.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId = Guid.Empty,
            volunteerName = "Alice",
            email = "alice@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "SlotId");
    }

    [Fact]
    public async Task CreateSignup_OverlongName_Returns400()
    {
        var (_, _, code) = await SeedInviteLinkAsync();

        var getPage = await _public.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_json);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _public.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = new string('a', 201),
            email = "alice@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "VolunteerName");
    }

    [Fact]
    public async Task CreateSignup_WhitespaceName_Returns400()
    {
        var (_, _, code) = await SeedInviteLinkAsync();

        var getPage = await _public.GetAsync($"/api/invite/{code}");
        var page = await getPage.Content.ReadFromJsonAsync<JsonElement>(_json);
        var slotId = page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();

        var response = await _public.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "   ",
            email = "alice@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "VolunteerName");
    }

    [Fact]
    public async Task CreateEvent_WhitespaceTitle_Returns400()
    {
        var orgId = await SeedOrgAsync();

        var response = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "   ",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Title");
    }

    [Fact]
    public async Task CreateSlot_WhitespaceLabel_Returns400()
    {
        var eventId = await SeedEventAsync();

        var response = await _admin.PostAsJsonAsync($"/api/events/{eventId}/slots", new
        {
            label = "  \t ",
            startTime = "09:00",
            endTime = "10:00",
            capacity = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetailsAsync(response, "Label");
    }

    // --- Global exception handler ---

    [Fact]
    public void DbConflictDetector_RecognisesUniqueViolation()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var ex = Assert.Throws<DbUpdateException>(() =>
        {
            db.InviteLinks.Add(new InviteLink
            {
                Id = Guid.NewGuid(),
                EventId = null,
                Code = "u1",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            db.InviteLinks.Add(new InviteLink
            {
                Id = Guid.NewGuid(),
                EventId = null,
                Code = "u1",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
        });

        Assert.True(DbConflictDetector.IsConflict(ex));
        Assert.False(DbConflictDetector.IsClientReferenceError(ex));
    }

    [Fact]
    public void DbConflictDetector_RecognisesForeignKeyViolation()
    {
        // Insert a Signup that references a non-existent TimeSlotId. Real Postgres
        // raises SQLSTATE 23503 (foreign_key_violation) — this must be classified
        // as a client reference error (400), not a conflict (409).
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var ex = Assert.Throws<DbUpdateException>(() =>
        {
            db.Signups.Add(new Signup
            {
                Id = Guid.NewGuid(),
                TimeSlotId = Guid.NewGuid(),  // does not exist in TimeSlots
                VolunteerName = "FK Test",
                CreatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
        });

        Assert.True(DbConflictDetector.IsClientReferenceError(ex));
        Assert.False(DbConflictDetector.IsConflict(ex));
    }

    [Fact]
    public void DbConflictDetector_RejectsTransientError()
    {
        // Build a DbUpdateException whose inner is NOT a Postgres conflict (e.g. a
        // connection drop or provider error). The detector must not treat it as a
        // conflict so the global handler falls through to 500.
        var ex = new DbUpdateException("transient", new InvalidOperationException("connection lost"));

        Assert.False(DbConflictDetector.IsConflict(ex));
        Assert.False(DbConflictDetector.IsClientReferenceError(ex));
    }

    [Fact]
    public void DbConflictDetector_RejectsNullInner()
    {
        // Defensive: a DbUpdateException without an inner should not be a conflict.
        var ex = new DbUpdateException("naked");

        Assert.False(DbConflictDetector.IsConflict(ex));
        Assert.False(DbConflictDetector.IsClientReferenceError(ex));
    }

    // --- Malformed JSON ---

    [Theory]
    [InlineData("{\"name\": \"Test", "truncated")]
    [InlineData("{\"name\": 123}", "wrong-type")]
    [InlineData("not-json", "not-json")]
    public async Task MalformedJson_Returns400WithProblemBody(string body, string _)
    {
        // The minimal-API JSON binder catches BadHttpRequestException and writes a
        // 400 response itself (before our UseExceptionHandler runs). We just verify
        // the contract: 400 status, non-empty body, and a parseable JSON object
        // with a 400 status field. Title and content type are framework-defined
        // and may evolve.
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        var response = await _admin.PostAsync("/api/organizations", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var bodyText = await response.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(bodyText), "Expected a non-empty body");

        var problem = JsonSerializer.Deserialize<JsonElement>(bodyText);
        Assert.Equal(400, problem.GetProperty("status").GetInt32());
    }

    // --- Helpers ---

    private static async Task AssertProblemDetailsAsync(HttpResponseMessage response, string expectedField)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("errors", out var errors), $"Body missing 'errors': {body}");
        var keys = errors.EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains(keys, k => k == expectedField || k.StartsWith(expectedField + "["));
    }

    private async Task<Guid> SeedOrgAsync()
    {
        var resp = await _admin.PostAsJsonAsync("/api/organizations", new { name = "Val Org" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        return body.GetProperty("id").GetGuid();
    }

    private async Task<Guid> SeedEventAsync()
    {
        var orgId = await SeedOrgAsync();
        var resp = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Val Event",
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd")
        });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        return body.GetProperty("id").GetGuid();
    }

    private async Task<(Guid orgId, Guid eventId, string code)> SeedInviteLinkAsync()
    {
        var orgId = await SeedOrgAsync();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var evtResp = await _admin.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Future Event",
            date = futureDate.ToString("yyyy-MM-dd"),
            slots = new[] { new { label = "Slot 1", startTime = "08:00", endTime = "09:00", capacity = 3 } }
        });
        var evt = await evtResp.Content.ReadFromJsonAsync<JsonElement>(_json);
        var eventId = evt.GetProperty("id").GetGuid();

        var linkResp = await _admin.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_json);
        var code = link.GetProperty("code").GetString()!;
        return (orgId, eventId, code);
    }

    public void Dispose()
    {
        _admin.Dispose();
        _public.Dispose();
    }
}
