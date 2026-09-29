using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RosterMeApi.Data;
using RosterMeApi.Entities;
using Xunit;

namespace RosterMeApi.Tests;

/// <summary>Tests for the per-event recent-activity feed.</summary>
[Collection(IntegrationTestCollection.Name)]
public class EventActivityTests(IntegrationTestFactory factory) : IDisposable
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly HttpClient _publicClient = factory.CreateClient();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task CreateEvent_LogsEventCreatedWithActor()
    {
        var orgId = await SeedOrgAsync("Activity Created Org");
        var eventId = await CreateEventAsync(orgId, "Activity Event", actorName: "Org Owner");

        var feed = await GetActivityAsync(eventId);

        var items = feed.GetProperty("items").EnumerateArray().ToList();
        var created = Assert.Single(items);
        Assert.Equal("EventCreated", created.GetProperty("kind").GetString());
        Assert.Equal("created this event", created.GetProperty("message").GetString());
        Assert.Equal("Org Owner", created.GetProperty("actorName").GetString());
        Assert.Equal(TestAuthHandler.TestUserId, created.GetProperty("actorClerkUserId").GetString());
        Assert.False(feed.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task UpdateEvent_LogsEventUpdatedNewestFirst()
    {
        var orgId = await SeedOrgAsync("Activity Updated Org");
        var eventId = await CreateEventAsync(orgId, "Update Me", actorName: "Editor");

        var update = await SendAsUserAsync(HttpMethod.Put, $"/api/events/{eventId}", new { title = "Updated Title" }, TestAuthHandler.TestUserId, name: "Editor");
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(2, items.Count);
        Assert.Equal("EventUpdated", items[0].GetProperty("kind").GetString());
        Assert.Equal("edited this event", items[0].GetProperty("message").GetString());
        Assert.Equal("Editor", items[0].GetProperty("actorName").GetString());
        Assert.Equal("EventCreated", items[1].GetProperty("kind").GetString());
    }

    [Fact]
    public async Task InviteLifecycle_LogsCreatedRenamedRevoked()
    {
        var orgId = await SeedOrgAsync("Activity Invite Org");
        var eventId = await CreateEventAsync(orgId, "Invite Event", actorName: "Owner");

        var linkResp = await SendAsUserAsync(HttpMethod.Post, $"/api/events/{eventId}/invite-links", new { name = "Helpers" }, TestAuthHandler.TestUserId, name: "Owner");
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var linkId = link.GetProperty("id").GetGuid();

        var rename = await SendAsUserAsync(HttpMethod.Put, $"/api/invite-links/{linkId}", new { name = "Helpers v2" }, TestAuthHandler.TestUserId, name: "Owner");
        Assert.Equal(HttpStatusCode.OK, rename.StatusCode);

        var revoke = await SendAsUserAsync(HttpMethod.Put, $"/api/invite-links/{linkId}/revoke", null, TestAuthHandler.TestUserId, name: "Owner");
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        var kinds = items.Select(i => i.GetProperty("kind").GetString()).ToList();
        Assert.Equal(["InviteRevoked", "InviteRenamed", "InviteCreated", "EventCreated"], kinds);
        Assert.Contains("revoked invite link “Helpers v2”", items[0].GetProperty("message").GetString());
        Assert.Contains("renamed invite link “Helpers” to “Helpers v2”", items[1].GetProperty("message").GetString());
    }

    [Fact]
    public async Task SlotLifecycle_LogsCreatedUpdatedDeleted()
    {
        var orgId = await SeedOrgAsync("Activity Slot Org");
        var eventId = await CreateEventAsync(orgId, "Slot Event", actorName: "Owner");

        var create = await _client.PostAsJsonAsync($"/api/events/{eventId}/slots",
            new { label = "Evening", startTime = "18:00", endTime = "19:00", capacity = 2 });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var slot = await create.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var slotId = slot.GetProperty("id").GetGuid();

        var update = await _client.PutAsJsonAsync($"/api/events/{eventId}/slots/{slotId}", new { capacity = 5 });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var delete = await _client.DeleteAsync($"/api/events/{eventId}/slots/{slotId}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        var kinds = items.Select(i => i.GetProperty("kind").GetString()).ToList();
        Assert.Equal(["SlotDeleted", "SlotUpdated", "SlotCreated", "EventCreated"], kinds);
    }

    [Fact]
    public async Task SignupFlow_LogsCreatedConfirmedCancelled()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Activity Signup Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var signupResp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Activity Alice",
            email = "activity-alice@example.com"
        });
        Assert.Equal(HttpStatusCode.Created, signupResp.StatusCode);

        var token = await ExtractManageTokenAsync("activity-alice@example.com");
        var confirm = await _publicClient.PostAsync($"/api/signup/manage/{token}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var cancel = await _publicClient.PostAsync($"/api/signup/manage/{token}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        var kinds = items.SkipLast(2).Select(i => i.GetProperty("kind").GetString()).ToList();
        Assert.Equal(["SignupCancelled", "SignupConfirmed", "SignupCreated"], kinds);
        foreach (var item in items.Take(3))
        {
            Assert.Equal("Activity Alice", item.GetProperty("actorName").GetString());
            Assert.Equal(JsonValueKind.Null, item.GetProperty("actorClerkUserId").ValueKind);
            Assert.Equal("Activity Alice", item.GetProperty("volunteerName").GetString());
        }
    }

    [Fact]
    public async Task DeleteSignup_LogsSignupRemovedWithNotifySuffix()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Activity Remove Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var signupResp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Removable Bob",
            email = "removable-bob@example.com"
        });
        var signup = await signupResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var signupId = signup.GetProperty("id").GetGuid();

        var delete = await SendAsUserAsync(HttpMethod.Delete, $"/api/signups/{signupId}?notify=true", null, TestAuthHandler.TestUserId, name: "Remover");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        var removed = items.First(i => i.GetProperty("kind").GetString() == "SignupRemoved");
        Assert.Contains("removed Removable Bob from “Slot 1” and notified them", removed.GetProperty("message").GetString());
        Assert.Equal("Remover", removed.GetProperty("actorName").GetString());
        Assert.Equal("Removable Bob", removed.GetProperty("volunteerName").GetString());
    }

    [Fact]
    public async Task ResendConfirmation_LogsConfirmationResent()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Activity Resend Org");
        var slotId = await GetFirstSlotIdAsync(code);

        var signupResp = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = "Resend Rita",
            email = "resend-rita@example.com"
        });
        var signup = await signupResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var signupId = signup.GetProperty("id").GetGuid();

        var resend = await SendAsUserAsync(HttpMethod.Post, $"/api/signups/{signupId}/resend", null, TestAuthHandler.TestUserId, name: "Resender");
        Assert.Equal(HttpStatusCode.NoContent, resend.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        var resent = items.First(i => i.GetProperty("kind").GetString() == "ConfirmationResent");
        Assert.Contains("resent the confirmation email to Resend Rita", resent.GetProperty("message").GetString());
        Assert.Equal("Resender", resent.GetProperty("actorName").GetString());
    }

    [Fact]
    public async Task WaitlistPromotion_LogsPromoted()
    {
        var orgId = await SeedOrgAsync("Activity Promote Org");
        var eventId = await CreateSmallEventAsync(orgId);
        var code = await CreateInviteCodeAsync(eventId);
        var slotId = await GetFirstSlotIdAsync(code);

        // Fill the single spot and confirm.
        await SignupAsync(code, slotId, "Spot Holder", "spot-holder@example.com");
        var holderToken = await ExtractManageTokenAsync("spot-holder@example.com");
        await _publicClient.PostAsync($"/api/signup/manage/{holderToken}/confirm", null);

        // Waitlisted volunteer confirms onto the waitlist.
        await SignupAsync(code, slotId, "Waiter Wendy", "waiter-wendy@example.com");
        var wendyToken = await ExtractManageTokenAsync("waiter-wendy@example.com");
        await _publicClient.PostAsync($"/api/signup/manage/{wendyToken}/confirm", null);

        // Freeing the spot promotes Wendy.
        var cancel = await _publicClient.PostAsync($"/api/signup/manage/{holderToken}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        var items = (await GetActivityAsync(eventId)).GetProperty("items").EnumerateArray().ToList();
        var promoted = items.First(i => i.GetProperty("kind").GetString() == "WaitlistPromoted");
        Assert.Contains("was promoted from the waitlist for “Solo”", promoted.GetProperty("message").GetString());
        Assert.Equal("Waiter Wendy", promoted.GetProperty("volunteerName").GetString());
        Assert.Equal(JsonValueKind.Null, promoted.GetProperty("actorName").ValueKind);
    }

    [Fact]
    public async Task GetActivity_OtherUsersEvent_Returns404()
    {
        var otherEventId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var group = TestGroupSeeder.OwnedBy("Other Activity Org", TestAuthHandler.OtherUserId);
            db.Groups.Add(group);
            db.Events.Add(new Event
            {
                Id = otherEventId,
                GroupId = group.Id,
                Title = "Someone Else",
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync($"/api/events/{otherEventId}/activity");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetActivity_PaginatesNewestFirst()
    {
        var orgId = await SeedOrgAsync("Activity Page Org");
        var eventId = await CreateEventAsync(orgId, "Paged Event", actorName: "Owner");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var baseTime = DateTime.UtcNow;
            for (var i = 0; i < 12; i++)
            {
                db.EventActivities.Add(new EventActivity
                {
                    Id = Guid.NewGuid(),
                    EventId = eventId,
                    Kind = ActivityKind.EventUpdated,
                    Message = $"edit #{i}",
                    OccurredAt = baseTime.AddMinutes(i)
                });
            }
            await db.SaveChangesAsync();
        }

        // 1 (created) + 12 seeded = 13 total. Default page takes the last 5.
        var first = await GetActivityRawAsync(eventId, "", HttpStatusCode.OK);
        var firstItems = first.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(5, firstItems.Count);
        Assert.Equal(13, first.GetProperty("total").GetInt32());
        Assert.True(first.GetProperty("hasMore").GetBoolean());
        Assert.Equal("edit #11", firstItems[0].GetProperty("message").GetString());

        var second = await GetActivityRawAsync(eventId, "?skip=5&take=10", HttpStatusCode.OK);
        var secondItems = second.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(8, secondItems.Count);
        Assert.False(second.GetProperty("hasMore").GetBoolean());
        Assert.Equal("created this event", secondItems[7].GetProperty("message").GetString());
    }

    // --- Helpers ---

    private async Task<JsonElement> GetActivityAsync(Guid eventId) =>
        await GetActivityRawAsync(eventId, "", HttpStatusCode.OK);

    private async Task<JsonElement> GetActivityRawAsync(Guid eventId, string query, HttpStatusCode expected)
    {
        var response = await _client.GetAsync($"/api/events/{eventId}/activity{query}");
        Assert.Equal(expected, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
    }

    private async Task<Guid> SeedOrgAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/groups", new { name });
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return body.GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateEventAsync(Guid orgId, string title, string actorName)
    {
        var response = await SendAsUserAsync(HttpMethod.Post, "/api/events",
            new { groupId = orgId, title, date = FutureDate() }, TestAuthHandler.TestUserId, name: actorName);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return body.GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateSmallEventAsync(Guid orgId)
    {
        var response = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = "Small Event",
            date = FutureDate(),
            slots = new[] { new { label = "Solo", startTime = "09:00", endTime = "10:00", capacity = 1 } }
        });
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return body.GetProperty("id").GetGuid();
    }

    private async Task<string> CreateInviteCodeAsync(Guid eventId)
    {
        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        return link.GetProperty("code").GetString()!;
    }

    private async Task<(Guid orgId, Guid eventId, string code)> SeedInviteLinkAsync(string name)
    {
        var orgId = await SeedOrgAsync(name);
        var response = await _client.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
            title = "Future Event",
            date = FutureDate(),
            slots = new[] { new { label = "Slot 1", startTime = "08:00", endTime = "09:00", capacity = 3 } }
        });
        var evt = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();
        var code = await CreateInviteCodeAsync(eventId);
        return (orgId, eventId, code);
    }

    private async Task<Guid> GetFirstSlotIdAsync(string code)
    {
        var page = await _publicClient.GetFromJsonAsync<JsonElement>($"/api/invite/{code}", _jsonOptions);
        return page.GetProperty("event").GetProperty("slots").EnumerateArray().First().GetProperty("id").GetGuid();
    }

    private async Task SignupAsync(string code, Guid slotId, string name, string email)
    {
        var response = await _publicClient.PostAsJsonAsync($"/api/invite/{code}/signups", new
        {
            slotId,
            volunteerName = name,
            email
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task<string> ExtractManageTokenAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var message = await db.EmailMessages
            .Where(m => m.To == email)
            .OrderByDescending(m => m.CreatedAt)
            .FirstAsync();
        const string marker = "/signup/manage/";
        var start = message.HtmlBody.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
        return message.HtmlBody.Substring(start).Split('"')[0];
    }

    private async Task<HttpResponseMessage> SendAsUserAsync(
        HttpMethod method, string url, object? body, string userId, string? name = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null) request.Content = JsonContent.Create(body);
        request.Headers.Add(TestAuthHandler.UserIdHeader, userId);
        if (name is not null) request.Headers.Add(TestAuthHandler.NameHeader, name);
        return await _client.SendAsync(request);
    }

    private static string FutureDate(int daysAhead = 30) =>
        DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysAhead)).ToString("yyyy-MM-dd");

    public void Dispose()
    {
        _client.Dispose();
        _publicClient.Dispose();
    }
}
