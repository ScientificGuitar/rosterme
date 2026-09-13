using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using RosterMeApi.Data;
using RosterMeApi.Entities;
using Xunit;

namespace RosterMeApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class SuperAdminEndpointTests : IDisposable
{
    private readonly IntegrationTestFactory _factory;
    private readonly HttpClient _client;
    private readonly HttpClient _superadmin;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public SuperAdminEndpointTests(IntegrationTestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _superadmin = factory.CreateClient();
        _superadmin.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, "superAdmin");
    }

    public void Dispose()
    {
        _client.Dispose();
        _superadmin.Dispose();
    }

    [Fact]
    public async Task Stats_WithoutRole_Returns403()
    {
        var response = await _client.GetAsync("/api/superadmin/stats");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Stats_WithRole_Returns200()
    {
        var response = await _superadmin.GetAsync("/api/superadmin/stats");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.True(body.TryGetProperty("groups", out _));
        Assert.True(body.TryGetProperty("signupsByStatus", out _));
        Assert.True(body.TryGetProperty("capacityFillRate", out _));
    }

    [Fact]
    public async Task Activity_WithRole_Returns30DaysByDefault()
    {
        var response = await _superadmin.GetAsync("/api/superadmin/activity");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal(30, body.GetProperty("signupsPerDay").GetArrayLength());
        Assert.Equal(30, body.GetProperty("eventsPerDay").GetArrayLength());
    }

    [Fact]
    public async Task Activity_InvalidDays_Returns400()
    {
        var response = await _superadmin.GetAsync("/api/superadmin/activity?days=999");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Recent_WithRole_Returns200()
    {
        var response = await _superadmin.GetAsync("/api/superadmin/recent?take=5");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.True(body.TryGetProperty("groups", out _));
        Assert.True(body.TryGetProperty("events", out _));
        Assert.True(body.TryGetProperty("signups", out _));
    }

    [Fact]
    public async Task Outbox_FilterAndPagination_Works()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.EmailMessages.Add(new EmailMessage
            {
                Id = Guid.NewGuid(),
                To = "pending@example.com",
                Subject = "Pending",
                HtmlBody = "<p>hi</p>",
                Sent = false,
                CreatedAt = DateTime.UtcNow
            });
            db.EmailMessages.Add(new EmailMessage
            {
                Id = Guid.NewGuid(),
                To = "sent@example.com",
                Subject = "Sent",
                HtmlBody = "<p>hi</p>",
                Sent = true,
                CreatedAt = DateTime.UtcNow,
                SentAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var pending = await _superadmin.GetFromJsonAsync<JsonElement>(
            "/api/superadmin/outbox?sent=false&take=50", _jsonOptions);
        Assert.True(pending.GetProperty("total").GetInt32() >= 1);
        foreach (var item in pending.GetProperty("items").EnumerateArray())
            Assert.False(item.GetProperty("sent").GetBoolean());

        var page = await _superadmin.GetFromJsonAsync<JsonElement>(
            "/api/superadmin/outbox?skip=1&take=1", _jsonOptions);
        Assert.Equal(1, page.GetProperty("items").GetArrayLength());

        // Payload must exclude bodies
        foreach (var item in pending.GetProperty("items").EnumerateArray())
        {
            Assert.False(item.TryGetProperty("htmlBody", out _));
            Assert.False(item.TryGetProperty("textBody", out _));
        }
    }

    [Fact]
    public async Task Outbox_TakeOver100_Returns400()
    {
        var response = await _superadmin.GetAsync("/api/superadmin/outbox?take=101");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteOutbox_Unsent_Returns204()
    {
        var id = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.EmailMessages.Add(new EmailMessage
            {
                Id = id,
                To = "del@example.com",
                Subject = "Delete me",
                HtmlBody = "<p>hi</p>",
                Sent = false,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var response = await _superadmin.DeleteAsync($"/api/superadmin/outbox/{id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteOutbox_Sent_Returns409AlreadySent()
    {
        var id = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.EmailMessages.Add(new EmailMessage
            {
                Id = id,
                To = "sent2@example.com",
                Subject = "Keep me",
                HtmlBody = "<p>hi</p>",
                Sent = true,
                CreatedAt = DateTime.UtcNow,
                SentAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var response = await _superadmin.DeleteAsync($"/api/superadmin/outbox/{id}");
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        Assert.Equal("already_sent", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task DeleteOutbox_UnknownId_Returns404()
    {
        var response = await _superadmin.DeleteAsync($"/api/superadmin/outbox/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteOutbox_WithoutRole_Returns403()
    {
        var response = await _client.DeleteAsync($"/api/superadmin/outbox/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
