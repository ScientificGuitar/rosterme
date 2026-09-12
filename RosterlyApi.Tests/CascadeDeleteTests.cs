using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RosterlyApi.Data;
using RosterlyApi.Entities;
using Xunit;

namespace RosterlyApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class CascadeDeleteTests(IntegrationTestFactory factory) : IDisposable
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task DeleteEvent_CascadesToSlotsAndSignups()
    {
        var orgId = await SeedOrgAsync("Cascade Org");

        // Create event with slot
        var eventDate = FutureDate();
        var createEvt = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Cascade Event",
            date = eventDate,
            slots = new[] { new { label = "Cascade Slot", startTime = "08:00", endTime = "09:00", capacity = 5 } }
        });
        var evt = await createEvt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        // Create invite link and signup
        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;

        var roster = await _client.GetFromJsonAsync<JsonElement>(
            $"/api/organizations/{orgId}/roster?weekStart={WeekStartFor(eventDate)}", _jsonOptions);
        var slotId = roster.EnumerateArray().First()
            .GetProperty("slots").EnumerateArray().First()
            .GetProperty("id").GetGuid();

        await _client.PostAsJsonAsync($"/api/invite/{code}/signups", new { slotId, volunteerName = "Bob", email = "bob@example.com" });

        // Delete the event
        var deleteResp = await _client.DeleteAsync($"/api/events/{eventId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify slots and signups are gone
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Events.AnyAsync(e => e.Id == eventId));
        Assert.False(await db.TimeSlots.AnyAsync(s => s.EventId == eventId));
        Assert.False(await db.Signups.AnyAsync(s => s.TimeSlotId == slotId));
    }

    [Fact]
    public async Task DeleteEvent_LeavesInviteLinkOrphaned()
    {
        // Invite links use SetNull on Event delete (so the code is preserved, but the public
        // endpoint will 404 because EventId is null and Event is not loadable).
        var orgId = await SeedOrgAsync("Orphan Link Org");

        var createEvt = await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Doomed Event",
            date = FutureDate()
        });
        var evt = await createEvt.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var eventId = evt.GetProperty("id").GetGuid();

        var linkResp = await _client.PostAsJsonAsync($"/api/events/{eventId}/invite-links", new { });
        var link = await linkResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var code = link.GetProperty("code").GetString()!;
        var linkId = link.GetProperty("id").GetGuid();

        // Delete the event
        var deleteResp = await _client.DeleteAsync($"/api/events/{eventId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Invite link row still exists but EventId is null
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var orphaned = await db.InviteLinks.FindAsync(linkId);
            Assert.NotNull(orphaned);
            Assert.Null(orphaned!.EventId);
        }

        // Public endpoint returns 404 for the orphaned code
        var publicClient = factory.CreateClient();
        var getResp = await publicClient.GetAsync($"/api/invite/{code}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task DeleteOrganization_CascadesToEventsAndSlots()
    {
        var orgId = await SeedOrgAsync("Cascade Org 2");

        await _client.PostAsJsonAsync($"/api/organizations/{orgId}/events", new
        {
            title = "Doomed Event",
            date = FutureDate(),
            slots = new[] { new { label = "Doomed Slot", startTime = "08:00", endTime = "09:00", capacity = 2 } }
        });

        // Delete the organization via API
        var deleteOrgResp = await _client.DeleteAsync($"/api/organizations/{orgId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteOrgResp.StatusCode);

        // Verify cascade: nothing should remain
        using var checkScope = factory.Services.CreateScope();
        var checkDb = checkScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await checkDb.Organizations.AnyAsync(o => o.Id == orgId));
        Assert.False(await checkDb.Events.AnyAsync(e => e.OrganizationId == orgId));
        Assert.False(await checkDb.TimeSlots.AnyAsync(s => s.Event != null && s.Event.OrganizationId == orgId));
    }

    // --- Helpers ---

    private static string FutureDate(int daysAhead = 30) =>
        DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysAhead)).ToString("yyyy-MM-dd");

    private static string WeekStartFor(string dateString)
    {
        var date = DateOnly.Parse(dateString);
        return date.AddDays(-(((int)date.DayOfWeek + 6) % 7)).ToString("yyyy-MM-dd");
    }

    private async Task<Guid> SeedOrgAsync(string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = name,
            ClerkUserId = TestAuthHandler.TestUserId,
            CreatedAt = DateTime.UtcNow
        };
        db.Organizations.Add(org);
        await db.SaveChangesAsync();
        return org.Id;
    }

    public void Dispose() => _client.Dispose();
}
