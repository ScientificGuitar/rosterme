using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RosterMeApi.Data;
using Xunit;

namespace RosterMeApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class RecurringEventTests : IDisposable
{
    private readonly IntegrationTestFactory _factory;
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public RecurringEventTests(IntegrationTestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateRecurringEvents_Weekly_CreatesOneEventPerOccurrence()
    {
        var orgId = await SeedOrgAsync("Recurring Org");
        // Monday 2026-10-05, repeating Mon+Wed x4 total.
        var start = NextWeekday(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)), DayOfWeek.Monday);

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "Weekly Service",
            description = "Repeating gathering",
            location = "Main Hall",
            date = start.ToString("yyyy-MM-dd"),
            slots = new[]
            {
                new { label = "Morning", startTime = "08:00", endTime = "09:00", capacity = 3 }
            },
            questions = new object[]
            {
                new { label = "Phone", type = "Phone", required = false }
            },
            recurrence = new
            {
                frequency = "Weekly",
                interval = 1,
                daysOfWeek = new[] { "Monday", "Wednesday" },
                count = 4
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal(4, created.GetArrayLength());

        var dates = created.EnumerateArray()
            .Select(e => DateOnly.Parse(e.GetProperty("date").GetString()!))
            .OrderBy(d => d)
            .ToList();
        Assert.Equal(start, dates[0]);
        Assert.Equal(start.AddDays(2), dates[1]);
        Assert.Equal(start.AddDays(7), dates[2]);
        Assert.Equal(start.AddDays(9), dates[3]);

        // Every occurrence replicates title, slots and questions.
        foreach (var item in created.EnumerateArray())
        {
            var eventId = item.GetProperty("id").GetGuid();
            var evt = await _client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}", _jsonOptions);
            Assert.Equal("Weekly Service", evt.GetProperty("title").GetString());
            var slots = evt.GetProperty("slots").EnumerateArray().ToList();
            Assert.Single(slots);
            Assert.Equal("Morning", slots[0].GetProperty("label").GetString());
            var questions = evt.GetProperty("questions").EnumerateArray().ToList();
            Assert.Single(questions);
            Assert.Equal("Phone", questions[0].GetProperty("label").GetString());
        }

        // No invite links are copied — each occurrence starts clean.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ids = created.EnumerateArray().Select(e => e.GetProperty("id").GetGuid()).ToList();
            Assert.Equal(0, await db.InviteLinks.CountAsync(l => l.EventId != null && ids.Contains(l.EventId.Value)));
        }
    }

    [Fact]
    public async Task CreateRecurringEvents_DailyUntilDate_ExpandsCorrectly()
    {
        var orgId = await SeedOrgAsync("Daily Recurring Org");
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "Daily Standup",
            date = start.ToString("yyyy-MM-dd"),
            recurrence = new
            {
                frequency = "Daily",
                interval = 1,
                untilDate = start.AddDays(2).ToString("yyyy-MM-dd")
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal(3, created.GetArrayLength());
    }

    [Fact]
    public async Task CreateRecurringEvents_MissingEnd_Returns400()
    {
        var orgId = await SeedOrgAsync("Missing End Org");

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "No End",
            date = FutureDate(),
            recurrence = new { frequency = "Daily", interval = 1 }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateRecurringEvents_BothCountAndUntilDate_Returns400()
    {
        var orgId = await SeedOrgAsync("Both Ends Org");
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "Both Ends",
            date = start.ToString("yyyy-MM-dd"),
            recurrence = new
            {
                frequency = "Daily",
                interval = 1,
                count = 4,
                untilDate = start.AddDays(10).ToString("yyyy-MM-dd")
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateRecurringEvents_StartWeekdayNotSelected_Returns400()
    {
        var orgId = await SeedOrgAsync("Weekday Mismatch Org");
        // Start on a Monday but only select Wednesday.
        var start = NextWeekday(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)), DayOfWeek.Monday);

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "Mismatch",
            date = start.ToString("yyyy-MM-dd"),
            recurrence = new
            {
                frequency = "Weekly",
                interval = 1,
                daysOfWeek = new[] { "Wednesday" },
                count = 3
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateRecurringEvents_ExceedingMaxOccurrences_Returns400()
    {
        var orgId = await SeedOrgAsync("Too Many Org");

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "Too Many",
            date = FutureDate(),
            recurrence = new { frequency = "Daily", interval = 1, count = 61 }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateRecurringEvents_MonthlyBeyondHorizon_CreatesTruncatedSeries()
    {
        var orgId = await SeedOrgAsync("Horizon Org");
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));

        // 24 requested, but the 12-month horizon only fits 13.
        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = orgId,
            title = "Monthly Long",
            date = start.ToString("yyyy-MM-dd"),
            recurrence = new
            {
                frequency = "Monthly",
                interval = 1,
                count = 24
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal(13, created.GetArrayLength());

        var dates = created.EnumerateArray()
            .Select(e => DateOnly.Parse(e.GetProperty("date").GetString()!))
            .OrderBy(d => d)
            .ToList();
        Assert.Equal(start, dates[0]);
        Assert.All(dates, d => Assert.True(d <= start.AddMonths(12)));
    }

    [Fact]
    public async Task CreateRecurringEvents_OtherUsersGroup_Returns404()
    {
        var otherGroupId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Groups.Add(TestGroupSeeder.OwnedBy("Other Group", TestAuthHandler.OtherUserId, otherGroupId));
            await db.SaveChangesAsync();
        }

        var response = await _client.PostAsJsonAsync("/api/events/recurring", new
        {
            groupId = otherGroupId,
            title = "Hijacked Series",
            date = FutureDate(),
            recurrence = new { frequency = "Daily", interval = 1, count = 3 }
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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

    private static DateOnly NextWeekday(DateOnly from, DayOfWeek day)
    {
        var delta = ((int)day - (int)from.DayOfWeek + 7) % 7;
        return from.AddDays(delta);
    }

    public void Dispose() => _client.Dispose();
}
