using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RosterMeApi.Data;
using RosterMeApi.Entities;
using Xunit;

namespace RosterMeApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class ReportsEndpointTests : IDisposable
{
    private readonly IntegrationTestFactory _factory;
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ReportsEndpointTests(IntegrationTestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetReports_ReturnsSummaryAndStatusBreakdown()
    {
        var orgId = await SeedOrgAsync($"Reports Org {Guid.NewGuid():N}");
        var (eventId, slotId) = await SeedEventWithSlotAsync(orgId, capacity: 4);

        await SeedSignupAsync(slotId, SignupStatus.Pending, "Alice");
        await SeedSignupAsync(slotId, SignupStatus.Confirmed, "Bob");
        await SeedSignupAsync(slotId, SignupStatus.Waitlisted, "Wendy");
        await SeedSignupAsync(slotId, SignupStatus.Cancelled, "Gone");
        await SeedSignupAsync(slotId, SignupStatus.Removed, "Out");

        // Isolate to our event: the test DB is shared across the suite.
        var body = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/reports?eventIds={eventId}&days=7", _jsonOptions);

        var summary = body.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("events").GetInt32());
        Assert.Equal(1, summary.GetProperty("slots").GetInt32());
        Assert.Equal(4, summary.GetProperty("capacity").GetInt32());
        Assert.Equal(2, summary.GetProperty("activeSignups").GetInt32());
        Assert.Equal(1, summary.GetProperty("waitlisted").GetInt32());
        Assert.Equal(0.5, summary.GetProperty("fillRate").GetDouble(), precision: 5);

        var byStatus = body.GetProperty("signupsByStatus");
        Assert.Equal(1, byStatus.GetProperty("Pending").GetInt32());
        Assert.Equal(1, byStatus.GetProperty("Confirmed").GetInt32());
        Assert.Equal(1, byStatus.GetProperty("Waitlisted").GetInt32());
        Assert.Equal(1, byStatus.GetProperty("Cancelled").GetInt32());
        Assert.Equal(1, byStatus.GetProperty("Removed").GetInt32());

        var events = body.GetProperty("events").EnumerateArray().ToList();
        Assert.Single(events);
        Assert.Equal(4, events[0].GetProperty("capacity").GetInt32());
        Assert.Equal(2, events[0].GetProperty("activeSignups").GetInt32());
        Assert.Equal(1, events[0].GetProperty("waitlisted").GetInt32());

        var groups = body.GetProperty("groups").EnumerateArray().ToList();
        Assert.Single(groups);
        Assert.Equal(orgId, groups[0].GetProperty("id").GetGuid());

        var perDay = body.GetProperty("signupsPerDay").EnumerateArray().ToList();
        Assert.Equal(7, perDay.Count);
        // All 5 signups were created today (UTC).
        Assert.Equal(5, perDay[^1].GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task GetReports_FiltersByGroup()
    {
        var groupA = await SeedOrgAsync($"Reports A {Guid.NewGuid():N}");
        var groupB = await SeedOrgAsync($"Reports B {Guid.NewGuid():N}");
        var (eventA, _) = await SeedEventWithSlotAsync(groupA);
        var (eventB, _) = await SeedEventWithSlotAsync(groupB);

        var body = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/reports?groupIds={groupA}", _jsonOptions);

        var eventIds = body.GetProperty("events").EnumerateArray()
            .Select(e => e.GetProperty("id").GetGuid()).ToList();
        Assert.Contains(eventA, eventIds);
        Assert.DoesNotContain(eventB, eventIds);

        var groupIds = body.GetProperty("groups").EnumerateArray()
            .Select(g => g.GetProperty("id").GetGuid()).ToList();
        Assert.Contains(groupA, groupIds);
        Assert.DoesNotContain(groupB, groupIds);
    }

    [Fact]
    public async Task GetReports_FiltersByEvent()
    {
        var orgId = await SeedOrgAsync($"Reports Ev {Guid.NewGuid():N}");
        var (eventA, _) = await SeedEventWithSlotAsync(orgId);
        var (eventB, _) = await SeedEventWithSlotAsync(orgId);

        var body = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/reports?eventIds={eventA}&eventIds={eventB}", _jsonOptions);

        var eventIds = body.GetProperty("events").EnumerateArray()
            .Select(e => e.GetProperty("id").GetGuid()).ToList();
        Assert.Equal(2, eventIds.Count);
        Assert.Contains(eventA, eventIds);
        Assert.Contains(eventB, eventIds);
    }

    [Fact]
    public async Task GetReports_ExcludesOtherUsersGroups()
    {
        var otherGroupId = Guid.NewGuid();
        Guid otherEventId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var group = TestGroupSeeder.OwnedBy("Reports Foreign", TestAuthHandler.OtherUserId, otherGroupId);
            var evt = new Event
            {
                Id = Guid.NewGuid(),
                GroupId = otherGroupId,
                Title = "Foreign Event",
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                CreatedAt = DateTime.UtcNow
            };
            otherEventId = evt.Id;
            group.Events.Add(evt);
            db.Groups.Add(group);
            await db.SaveChangesAsync();
        }

        var body = await _client.GetFromJsonAsync<JsonElement>("/api/reports", _jsonOptions);

        var eventIds = body.GetProperty("events").EnumerateArray()
            .Select(e => e.GetProperty("id").GetGuid()).ToList();
        Assert.DoesNotContain(otherEventId, eventIds);
        var groupIds = body.GetProperty("groups").EnumerateArray()
            .Select(g => g.GetProperty("id").GetGuid()).ToList();
        Assert.DoesNotContain(otherGroupId, groupIds);
    }

    [Fact]
    public async Task GetReports_InvalidDays_Returns400()
    {
        var response = await _client.GetAsync("/api/reports?days=999");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // --- Helpers ---

    private async Task<Guid> SeedOrgAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/groups", new { name });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return body.GetProperty("id").GetGuid();
    }

    private static string FutureDate(int daysAhead = 30) =>
        DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysAhead)).ToString("yyyy-MM-dd");

    private async Task<(Guid eventId, Guid slotId)> SeedEventWithSlotAsync(Guid orgId, int capacity = 5)
    {
        var create = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = $"Reports Event {Guid.NewGuid():N}",
            date = FutureDate(),
            slots = new[] { new { label = "Slot 1", startTime = "09:00", endTime = "10:00", capacity } }
        });
        create.EnsureSuccessStatusCode();
        var evt = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var listed = await _client.GetFromJsonAsync<JsonElement>(
            "/api/events?from=2000-01-01&to=2100-01-01", _jsonOptions);
        var slotId = listed.EnumerateArray()
            .First(e => e.GetProperty("id").GetGuid() == eventId)
            .GetProperty("slots").EnumerateArray().First()
            .GetProperty("id").GetGuid();

        return (eventId, slotId);
    }

    private async Task SeedSignupAsync(Guid slotId, SignupStatus status, string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Signups.Add(new Signup
        {
            Id = Guid.NewGuid(),
            TimeSlotId = slotId,
            VolunteerName = $"{name} {Guid.NewGuid():N}",
            Email = $"{Guid.NewGuid():N}@example.com",
            Status = status,
            ManagementTokenHash = $"test-hash-{Guid.NewGuid():N}",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    public void Dispose() => _client.Dispose();
}
