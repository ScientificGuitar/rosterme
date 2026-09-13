using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using RosterMeApi.Data;
using RosterMeApi.Entities;

namespace RosterMeApi.Services;

public class SignupReminderService
{
    private readonly AppDbContext _db;
    private readonly EmailOutboxService _outbox;
    private readonly EmailOptions _emailOptions;
    private readonly ReminderOptions _reminderOptions;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<SignupReminderService> _logger;

    public SignupReminderService(
        AppDbContext db,
        EmailOutboxService outbox,
        IOptions<EmailOptions> emailOptions,
        IOptions<ReminderOptions> reminderOptions,
        TimeProvider timeProvider,
        ILogger<SignupReminderService> logger)
    {
        _db = db;
        _outbox = outbox;
        _emailOptions = emailOptions.Value;
        _reminderOptions = reminderOptions.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<int> EnqueueDueRemindersAsync(CancellationToken ct = default)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var hoursBefore = _reminderOptions.HoursBefore > 0 ? _reminderOptions.HoursBefore : 24;
        var batchSize = _reminderOptions.BatchSize > 0 ? _reminderOptions.BatchSize : 100;
        var windowEnd = now.AddHours(hoursBefore);

        // Event.Date + TimeSlot.StartTime can't be translated to SQL (DateOnly.ToDateTime),
        // so pre-filter by date to keep the candidate set small and do the exact
        // 24h-window check in memory.
        var today = DateOnly.FromDateTime(now);
        var maxDate = DateOnly.FromDateTime(windowEnd.AddDays(1));

        var candidates = await _db.Signups
            .Where(s => s.Status == SignupStatus.Confirmed && s.ReminderSentAt == null)
            .Include(s => s.TimeSlot)
                .ThenInclude(t => t.Event)
                    .ThenInclude(e => e.Group)
            .Where(s => s.TimeSlot.Event.Date >= today && s.TimeSlot.Event.Date <= maxDate)
            .OrderBy(s => s.CreatedAt)
            .Take(batchSize * 4)
            .ToListAsync(ct);

        var due = candidates
            .Where(s =>
            {
                // Event times are stored as timezone-less DateOnly + TimeOnly; treat them as UTC
                var start = DateTime.SpecifyKind(
                    s.TimeSlot.Event.Date.ToDateTime(s.TimeSlot.StartTime),
                    DateTimeKind.Utc);
                return start > now && start <= windowEnd;
            })
            .Take(batchSize)
            .ToList();

        // Leeway: if the signup was created very recently, its confirmation email
        // (with a working manage link) is still fresh. Sending a reminder now would
        // rotate the token and invalidate that link, so suppress the reminder entirely.
        var leewayHours = _reminderOptions.SuppressIfCreatedWithinHours;
        var sendable = due;
        if (leewayHours > 0)
        {
            var leewayCutoff = now.AddHours(-leewayHours);
            var suppressed = due.Where(s => s.CreatedAt >= leewayCutoff).ToList();
            foreach (var signup in suppressed)
            {
                signup.ReminderSentAt = now;
                _logger.LogInformation("Skipped reminder for recently-created signup {SignupId}", signup.Id);
            }

            sendable = [.. due.Except(suppressed)];

            if (suppressed.Count > 0 && sendable.Count == 0)
            {
                await _db.SaveChangesAsync(ct);
                return 0;
            }
        }

        foreach (var signup in sendable)
        {
            // Rotate the management token so the reminder can embed a working view/cancel link (same as resend flow).
            var rawToken = TokenService.GenerateToken();
            signup.ManagementTokenHash = TokenService.HashToken(rawToken);
            signup.ReminderSentAt = now;

            var manageUrl = $"{_emailOptions.BaseUrl.TrimEnd('/')}/signup/manage/{rawToken}";
            var slot = signup.TimeSlot;
            var evt = slot.Event;
            var (subject, html, text) = EmailTemplates.BuildSignupReminder(
                signup.VolunteerName,
                evt.Group.Name,
                evt.Title,
                slot.Label,
                evt.Date,
                slot.StartTime,
                slot.EndTime,
                manageUrl,
                evt.Location);

            // EnqueueAsync saves changes, persisting the token rotation,
            // the ReminderSentAt claim, and the outbox row atomically.
            await _outbox.EnqueueAsync(signup.Email, subject, html, text, ct: ct);
            _logger.LogInformation("Enqueued reminder for signup {SignupId}", signup.Id);
        }

        return sendable.Count;
    }
}
