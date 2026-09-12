using Microsoft.Extensions.Options;

using Resend;

namespace RosterMeApi.Services;

public class ResendEmailSender : IEmailSender
{
    private readonly IResend _resend;
    private readonly EmailOptions _emailOptions;
    private readonly ILogger<ResendEmailSender> _logger;

    public ResendEmailSender(IResend resend, IOptions<EmailOptions> emailOptions, ILogger<ResendEmailSender> logger)
    {
        _resend = resend;
        _emailOptions = emailOptions.Value;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, string? textBody = null, EmailAttachment? attachment = null, CancellationToken ct = default)
    {
        var from = string.IsNullOrWhiteSpace(_emailOptions.FromName)
            ? _emailOptions.FromEmail
            : $"{_emailOptions.FromName} <{_emailOptions.FromEmail}>";

        var message = new Resend.EmailMessage
        {
            From = from,
            To = [to],
            Subject = subject,
            HtmlBody = htmlBody,
            TextBody = textBody
        };

        if (attachment is not null)
        {
            message.Attachments =
            [
                new Resend.EmailAttachment
                {
                    Filename = attachment.FileName,
                    Content = new Resend.ByteArrayOrString(attachment.Content),
                    ContentType = attachment.ContentType
                }
            ];
        }

        var result = await _resend.EmailSendAsync(message, ct);
        if (!result.Success)
            throw new InvalidOperationException($"Resend failed: {result.Exception?.Message ?? "unknown error"}");

        _logger.LogInformation("Sent email to {To} with subject {Subject} (Resend id {Id})", to, subject, result.Content);
    }
}