namespace RosterMeApi.Services;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody, string? textBody = null, EmailAttachment? attachment = null, CancellationToken ct = default);
}