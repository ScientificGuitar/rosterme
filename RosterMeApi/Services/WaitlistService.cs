using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using RosterMeApi.Data;
using RosterMeApi.Entities;

namespace RosterMeApi.Services;

public static class WaitlistService
{
    public static bool IsActive(SignupStatus status) =>
        status is SignupStatus.Pending or SignupStatus.Confirmed;

    public static bool IsWaitlist(SignupStatus status) =>
        status is SignupStatus.WaitlistPending or SignupStatus.Waitlisted;

    public static async Task<int> GetWaitlistPositionAsync(
        AppDbContext db, Guid slotId, Guid signupId, CancellationToken ct)
    {
        var mine = await db.Signups
            .Where(s => s.Id == signupId)
            .Select(s => new { s.ConfirmedAt, s.CreatedAt })
            .FirstOrDefaultAsync(ct);

        if (mine is null || mine.ConfirmedAt is null) return 1;

        var ahead = await db.Signups.CountAsync(s =>
            s.TimeSlotId == slotId
            && s.Status == SignupStatus.Waitlisted
            && s.Id != signupId
            && s.ConfirmedAt != null
            && (s.ConfirmedAt < mine.ConfirmedAt
                || (s.ConfirmedAt == mine.ConfirmedAt && s.CreatedAt < mine.CreatedAt)), ct);

        return ahead + 1;
    }

    public static async Task<int> GetWaitlistCountAsync(
        AppDbContext db, Guid slotId, CancellationToken ct) =>
        await db.Signups.CountAsync(s =>
            s.TimeSlotId == slotId && s.Status == SignupStatus.Waitlisted, ct);

    /// <summary>
    /// Promotes the oldest waitlisted signups while free capacity exists.
    /// Must be called inside the slot's advisory-lock transaction, after the
    /// releaser's status flip. Rotates the management token so the promotion
    /// email contains a working manage/cancel link.
    /// </summary>
    public static async Task<int> PromoteWaitlistAsync(
        AppDbContext db,
        EmailOutboxService outbox,
        IOptions<EmailOptions> emailOptions,
        Guid slotId,
        CancellationToken ct)
    {
        var slot = await db.TimeSlots
            .Include(s => s.Event!)
                .ThenInclude(e => e.Group)
            .FirstOrDefaultAsync(s => s.Id == slotId, ct);

        if (slot is null || slot.Event is null) return 0;

        var promoted = 0;

        while (true)
        {
            var active = await db.Signups.CountAsync(s =>
                s.TimeSlotId == slotId
                && (s.Status == SignupStatus.Pending || s.Status == SignupStatus.Confirmed), ct);

            if (active >= slot.Capacity) break;

            var next = await db.Signups
                .Where(s => s.TimeSlotId == slotId && s.Status == SignupStatus.Waitlisted)
                .OrderBy(s => s.ConfirmedAt!)
                .ThenBy(s => s.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (next is null) break;

            var rawToken = TokenService.GenerateToken();
            next.ManagementTokenHash = TokenService.HashToken(rawToken);
            next.Status = SignupStatus.Confirmed;
            next.ReminderSentAt = null;

            await EnqueuePromotionEmail(db, outbox, emailOptions, next, slot, rawToken, ct);
            promoted++;
        }

        return promoted;
    }

    private static async Task EnqueuePromotionEmail(
        AppDbContext db,
        EmailOutboxService outbox,
        IOptions<EmailOptions> emailOptions,
        Signup signup,
        TimeSlot slot,
        string rawToken,
        CancellationToken ct)
    {
        var manageUrl = $"{emailOptions.Value.BaseUrl.TrimEnd('/')}/signup/manage/{rawToken}";
        var evt = slot.Event;
        var links = CalendarInviteBuilder.BuildLinks(
            evt.Title, evt.Description, evt.Location, evt.Date,
            slot.StartTime, slot.EndTime, slot.Label, manageUrl);
        var ics = CalendarInviteBuilder.BuildIcs(
            evt.Title, evt.Description, evt.Location, evt.Date,
            slot.StartTime, slot.EndTime, slot.Label, manageUrl, signup.Id.ToString());
        var (subject, html, text) = EmailTemplates.BuildWaitlistPromotion(
            signup.VolunteerName, evt.Group.Name, evt.Title, slot.Label, evt.Date,
            slot.StartTime, slot.EndTime, manageUrl, evt.Location, links,
            hasCalendarAttachment: true);

        var attachment = new EmailAttachment(
            CalendarInviteBuilder.IcsFileName(evt.Title),
            "text/calendar",
            System.Text.Encoding.UTF8.GetBytes(ics));

        await outbox.EnqueueAsync(signup.Email, subject, html, text, attachment, ct);
    }
}
