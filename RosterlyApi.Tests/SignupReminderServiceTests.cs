using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RosterlyApi.Data;
using RosterlyApi.Entities;
using RosterlyApi.Services;
using Xunit;

namespace RosterlyApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class SignupReminderServiceTests
{
    private readonly IntegrationTestFactory _factory;

    public SignupReminderServiceTests(IntegrationTestFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task EnqueueDueReminders_ConfirmedSignupWithin24h_EnqueuesEmailAndMarksSent()
    {
        var start = DateTime.UtcNow.AddHours(20);
        var signupId = await SeedSignupAsync(
            "reminder@example.com", "Reminded User", SignupStatus.Confirmed, start,
            createdAt: DateTime.UtcNow.AddHours(-5));

        var enqueued = await RunReminderSweepAsync();

        Assert.Equal(1, enqueued);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var signup = await db.Signups.SingleAsync(s => s.Id == signupId);
        Assert.NotNull(signup.ReminderSentAt);

        var message = await db.EmailMessages
            .Where(m => m.To == "reminder@example.com" && m.Subject.Contains("Reminder"))
            .SingleAsync();
        Assert.False(message.Sent);
        Assert.Contains("/signup/manage/", message.HtmlBody);
        Assert.Contains("Reminded User", message.HtmlBody);
    }

    [Fact]
    public async Task EnqueueDueReminders_SecondRun_DoesNotResend()
    {
        var start = DateTime.UtcNow.AddHours(20);
        await SeedSignupAsync(
            "once@example.com", "Once User", SignupStatus.Confirmed, start,
            createdAt: DateTime.UtcNow.AddHours(-5));

        Assert.Equal(1, await RunReminderSweepAsync());
        Assert.Equal(0, await RunReminderSweepAsync());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.EmailMessages.CountAsync(m => m.To == "once@example.com");
        Assert.Equal(1, count);
    }

    [Theory]
    [InlineData(SignupStatus.Pending)]
    [InlineData(SignupStatus.Cancelled)]
    [InlineData(SignupStatus.Removed)]
    public async Task EnqueueDueReminders_NonConfirmedSignup_Skipped(SignupStatus status)
    {
        var start = DateTime.UtcNow.AddHours(20);
        var email = $"nonconfirmed-{status}@example.com";
        await SeedSignupAsync(email, "Non Confirmed", status, start);

        var enqueued = await RunReminderSweepAsync();

        Assert.Equal(0, enqueued);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(db.EmailMessages.Where(m => m.To == email));
    }

    [Fact]
    public async Task EnqueueDueReminders_ConfirmedSignupBeyond24h_Skipped()
    {
        var start = DateTime.UtcNow.AddHours(48);
        await SeedSignupAsync(
            "later@example.com", "Later User", SignupStatus.Confirmed, start);

        Assert.Equal(0, await RunReminderSweepAsync());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(db.EmailMessages.Where(m => m.To == "later@example.com"));
    }

    [Fact]
    public async Task EnqueueDueReminders_ConfirmedSignupInPast_Skipped()
    {
        var start = DateTime.UtcNow.AddHours(-2);
        await SeedSignupAsync(
            "past@example.com", "Past User", SignupStatus.Confirmed, start);

        Assert.Equal(0, await RunReminderSweepAsync());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(db.EmailMessages.Where(m => m.To == "past@example.com"));
    }

    [Fact]
    public async Task EnqueueDueReminders_RecentlyCreatedSignup_SuppressedWithoutRotatingToken()
    {
        var start = DateTime.UtcNow.AddHours(20);
        var signupId = await SeedSignupAsync(
            "recent@example.com", "Recent User", SignupStatus.Confirmed, start,
            createdAt: DateTime.UtcNow.AddHours(-1));

        string originalHash;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            originalHash = (await db.Signups.SingleAsync(s => s.Id == signupId)).ManagementTokenHash;
        }

        var enqueued = await RunReminderSweepAsync();

        Assert.Equal(0, enqueued);

        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<AppDbContext>();
        var signup = await db2.Signups.SingleAsync(s => s.Id == signupId);
        // Suppressed forever: claimed so no later sweep retries, but token untouched.
        Assert.NotNull(signup.ReminderSentAt);
        Assert.Equal(originalHash, signup.ManagementTokenHash);
        Assert.Empty(db2.EmailMessages.Where(m => m.To == "recent@example.com"));

        // A second sweep still sends nothing.
        Assert.Equal(0, await RunReminderSweepAsync());
    }

    [Fact]
    public async Task EnqueueDueReminders_SignupOlderThanLeeway_SendsReminder()
    {
        var start = DateTime.UtcNow.AddHours(20);
        await SeedSignupAsync(
            "oldsignup@example.com", "Old Signup User", SignupStatus.Confirmed, start,
            createdAt: DateTime.UtcNow.AddHours(-5));

        Assert.Equal(1, await RunReminderSweepAsync());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.NotEmpty(db.EmailMessages.Where(m => m.To == "oldsignup@example.com"));
    }

    private async Task<int> RunReminderSweepAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var reminders = scope.ServiceProvider.GetRequiredService<SignupReminderService>();
        return await reminders.EnqueueDueRemindersAsync();
    }

    private async Task<Guid> SeedSignupAsync(
        string email, string name, SignupStatus status, DateTime slotStartUtc, DateTime? createdAt = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = "Reminder Test Org",
            ClerkUserId = TestAuthHandler.TestUserId,
            CreatedAt = DateTime.UtcNow
        };
        var evt = new Event
        {
            Id = Guid.NewGuid(),
            OrganizationId = org.Id,
            Title = "Reminder Event",
            Date = DateOnly.FromDateTime(slotStartUtc),
            CreatedAt = DateTime.UtcNow
        };
        var slot = new TimeSlot
        {
            Id = Guid.NewGuid(),
            EventId = evt.Id,
            Label = "Slot 1",
            StartTime = TimeOnly.FromDateTime(slotStartUtc),
            EndTime = TimeOnly.FromDateTime(slotStartUtc.AddHours(1)),
            Capacity = 5,
            CreatedAt = DateTime.UtcNow
        };
        var signup = new Signup
        {
            Id = Guid.NewGuid(),
            TimeSlotId = slot.Id,
            VolunteerName = name,
            Email = email,
            Status = status,
            ManagementTokenHash = TokenService.HashToken(TokenService.GenerateToken()),
            ConfirmedAt = status == SignupStatus.Confirmed ? DateTime.UtcNow : null,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };

        db.Organizations.Add(org);
        db.Events.Add(evt);
        db.TimeSlots.Add(slot);
        db.Signups.Add(signup);
        await db.SaveChangesAsync();

        return signup.Id;
    }
}
