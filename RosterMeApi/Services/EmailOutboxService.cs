using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using RosterMeApi.Data;
using RosterMeApi.Entities;

namespace RosterMeApi.Services;

public class EmailOutboxService
{
    private readonly AppDbContext _db;
    private readonly IEmailSender _emailSender;
    private readonly EmailOptions _emailOptions;
    private readonly ILogger<EmailOutboxService> _logger;

    public EmailOutboxService(AppDbContext db, IEmailSender emailSender, IOptions<EmailOptions> emailOptions, ILogger<EmailOutboxService> logger)
    {
        _db = db;
        _emailSender = emailSender;
        _emailOptions = emailOptions.Value;
        _logger = logger;
    }

    public async Task EnqueueAsync(string to, string subject, string htmlBody, string? textBody = null, EmailAttachment? attachment = null, CancellationToken ct = default)
    {
        _db.EmailMessages.Add(new EmailMessage
        {
            Id = Guid.NewGuid(),
            To = to,
            Subject = subject,
            HtmlBody = htmlBody,
            TextBody = textBody,
            AttachmentFileName = attachment?.FileName,
            AttachmentContentType = attachment?.ContentType,
            AttachmentContent = attachment?.Content,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<int> ProcessPendingAsync(CancellationToken ct = default)
    {
        var messages = await _db.EmailMessages
            .Where(m => !m.Sent)
            .OrderBy(m => m.CreatedAt)
            .Take(_emailOptions.BatchSize)
            .ToListAsync(ct);

        foreach (var message in messages)
        {
            try
            {
                var attachment = message.AttachmentContent is null || message.AttachmentFileName is null
                    ? null
                    : new EmailAttachment(
                        message.AttachmentFileName,
                        message.AttachmentContentType ?? "application/octet-stream",
                        message.AttachmentContent);
                await _emailSender.SendAsync(message.To, message.Subject, message.HtmlBody, message.TextBody, attachment, ct);
                message.Sent = true;
                message.SentAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email {EmailId} to {To}", message.Id, message.To);
            }
        }

        await _db.SaveChangesAsync(ct);
        return messages.Count;
    }
}