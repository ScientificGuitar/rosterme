using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using RosterMeApi.Data;
using RosterMeApi.Services;
using Xunit;

namespace RosterMeApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class InviteUnfurlTests(IntegrationTestFactory factory) : IDisposable
{
    private readonly HttpClient _adminClient = factory.CreateClient();
    private readonly HttpClient _publicClient = factory.CreateClient();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task Unfurl_ValidCode_Returns200HtmlWithEventTags()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Unfurl Org");
        var eventDate = await GetEventDateAsync(code);

        var response = await _publicClient.GetAsync($"/api/invite/{code}/unfurl");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.StartsWith("text/html", response.Content.Headers.ContentType?.ToString());
        var html = await response.Content.ReadAsStringAsync();

        Assert.Contains("property=\"og:title\" content=\"Future Event\"", html);
        Assert.Contains($"Unfurl Org · {InviteUnfurlBuilder.FormatDate(eventDate)}", html);
        Assert.Contains($"/api/invite/{code}/og-image.png", html);
        Assert.Contains("noindex, nofollow", html);
        Assert.Equal("public, max-age=300", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Unfurl_InvalidCode_Returns404FallbackWithoutEventData()
    {
        var response = await _publicClient.GetAsync("/api/invite/nonexistent/unfurl");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("RosterMe", html);
        Assert.DoesNotContain("/api/invite/", html);
        Assert.Contains("noindex, nofollow", html);
    }

    [Fact]
    public async Task Unfurl_RevokedLink_Returns404Fallback()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Unfurl Revoked Org");

        Guid linkId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            linkId = (await db.InviteLinks.FirstAsync(l => l.Code == code)).Id;
        }
        Assert.Equal(HttpStatusCode.NoContent,
            (await _adminClient.PutAsync($"/api/invite-links/{linkId}/revoke", null)).StatusCode);

        var response = await _publicClient.GetAsync($"/api/invite/{code}/unfurl");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var html = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Future Event", html);
    }

    [Fact]
    public async Task Unfurl_ExpiredLink_Returns404Fallback()
    {
        var (_, _, code) = await SeedInviteLinkAsync("Unfurl Expired Org");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.InviteLinks.FirstAsync(l => l.Code == code)).ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var response = await _publicClient.GetAsync($"/api/invite/{code}/unfurl");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Unfurl_MaliciousTitle_IsEscaped()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("Unfurl Escape Org");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Events.FirstAsync(e => e.Id == eventId)).Title = "<script>alert(\"x\")</script>";
            await db.SaveChangesAsync();
        }

        var html = await _publicClient.GetStringAsync($"/api/invite/{code}/unfurl");
        Assert.DoesNotContain("<script>alert", html);
        Assert.Contains("&lt;script&gt;", html);
    }

    [Fact]
    public async Task OgImage_ValidCode_ReturnsPng1200x630()
    {
        var (_, _, code) = await SeedInviteLinkAsync("OG Image Org");

        var response = await _publicClient.GetAsync($"/api/invite/{code}/og-image.png");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        // PNG signature + IHDR dimensions (big-endian at offsets 16/20).
        Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, bytes[..8]);
        Assert.Equal(1200, ReadBigEndianInt32(bytes, 16));
        Assert.Equal(630, ReadBigEndianInt32(bytes, 20));
        Assert.NotNull(response.Headers.ETag);
    }

    [Fact]
    public async Task OgImage_InvalidCode_RedirectsToStaticFallback()
    {
        using var noRedirectClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        var response = await noRedirectClient.GetAsync("/api/invite/nonexistent/og-image.png");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.EndsWith("/og-image.png", response.Headers.Location?.ToString());
    }

    [Fact]
    public async Task OgImage_MatchingEtag_Returns304()
    {
        var (_, _, code) = await SeedInviteLinkAsync("OG ETag Org");

        var first = await _publicClient.GetAsync($"/api/invite/{code}/og-image.png");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var etag = first.Headers.ETag?.Tag;
        Assert.False(string.IsNullOrEmpty(etag));

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/invite/{code}/og-image.png");
        request.Headers.TryAddWithoutValidation("If-None-Match", etag);
        var second = await _publicClient.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task OgImage_AfterEventEdit_ReRenders()
    {
        var (_, eventId, code) = await SeedInviteLinkAsync("OG Refresh Org");

        var first = await _publicClient.GetAsync($"/api/invite/{code}/og-image.png");
        var etagBefore = first.Headers.ETag?.Tag;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Events.FirstAsync(e => e.Id == eventId)).Title = "Completely Different Title Here";
            await db.SaveChangesAsync();
        }

        var second = await _publicClient.GetAsync($"/api/invite/{code}/og-image.png");
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.NotEqual(etagBefore, second.Headers.ETag?.Tag);
    }

    private static int ReadBigEndianInt32(byte[] bytes, int offset) =>
        (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];

    private async Task<DateOnly> GetEventDateAsync(string code)
    {
        var page = await _publicClient.GetFromJsonAsync<JsonElement>($"/api/invite/{code}", _jsonOptions);
        return DateOnly.Parse(page.GetProperty("event").GetProperty("date").GetString()!);
    }

    private async Task<(Guid orgId, Guid eventId, string code)> SeedInviteLinkAsync(string name)
    {
        var resp = await _adminClient.PostAsJsonAsync("/api/groups", new { name });
        var org = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        var orgId = org.GetProperty("id").GetGuid();

        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var evtResp = await _adminClient.PostAsJsonAsync("/api/events", new
        {
            groupId = orgId,
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
