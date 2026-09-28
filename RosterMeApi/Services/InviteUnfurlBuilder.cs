using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace RosterMeApi.Services;

/// <summary>
/// Public data needed to unfurl an invite link on chat platforms.
/// Title/group/date only — never location, emails, or signup counts.
/// </summary>
public sealed record InviteUnfurlData(string EventTitle, string GroupName, DateOnly EventDate);

/// <summary>
/// Builds the server-rendered HTML crawlers (Discord, WhatsApp, ...) read
/// when an invite link is shared. Chat-platform unfurlers don't execute JS,
/// so the SPA's client-side meta tags are invisible to them — this HTML is
/// served to bot user-agents by the frontend nginx instead of index.html.
/// </summary>
public static class InviteUnfurlBuilder
{
    public const int OgImageWidth = 1200;
    public const int OgImageHeight = 630;

    private const int MaxTitleLength = 70;
    private const int MaxDescriptionLength = 200;

    // Lets common punctuation (·, …, —, accented letters) through raw so the
    // served HTML stays readable; HTML metacharacters are still encoded.
    private static readonly HtmlEncoder Encoder = HtmlEncoder.Create(
        UnicodeRanges.BasicLatin,
        UnicodeRanges.Latin1Supplement,
        UnicodeRanges.LatinExtendedA,
        UnicodeRanges.GeneralPunctuation);

    public static string FormatDate(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue).ToString("dddd, MMMM d, yyyy", CultureInfo.InvariantCulture);

    public static string Truncate(string value, int maxLength)
    {
        var trimmed = value.Trim();
        if (trimmed.Length <= maxLength)
            return trimmed;
        return trimmed[..(maxLength - 1)].TrimEnd() + "…";
    }

    /// <summary>Full OG page for an active invite link.</summary>
    public static string BuildHtml(InviteUnfurlData data, string inviteUrl, string imageUrl)
    {
        var title = Truncate(data.EventTitle, MaxTitleLength);
        var description = Truncate($"{data.GroupName} · {FormatDate(data.EventDate)}", MaxDescriptionLength);
        return BuildDocument(
            pageTitle: $"{title} - Signup | RosterMe",
            ogTitle: title,
            description: description,
            inviteUrl: inviteUrl,
            imageUrl: imageUrl);
    }

    /// <summary>
    /// Generic fallback for revoked/expired/unknown codes. Contains no event
    /// data (mirrors the static tags in client/index.html).
    /// </summary>
    public static string BuildFallbackHtml(string inviteUrl, string fallbackImageUrl) =>
        BuildDocument(
            pageTitle: "RosterMe - Volunteer Signups",
            ogTitle: "RosterMe - Volunteer Signups",
            description: "Create volunteer shifts, share one signup link, and see who's coming. Free, no volunteer accounts needed.",
            inviteUrl: inviteUrl,
            imageUrl: fallbackImageUrl);

    private static string BuildDocument(
        string pageTitle,
        string ogTitle,
        string description,
        string inviteUrl,
        string imageUrl)
    {
        var enc = Encoder;
        // Invite pages stay out of search indexes; noindex does not affect
        // chat-platform unfurling, which only reads the OG tags.
        return $"""
            <!doctype html>
            <html lang="en">
            <head>
            <meta charset="utf-8" />
            <title>{enc.Encode(pageTitle)}</title>
            <meta name="robots" content="noindex, nofollow" />
            <meta name="description" content="{enc.Encode(description)}" />
            <link rel="canonical" href="{enc.Encode(inviteUrl)}" />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="RosterMe" />
            <meta property="og:title" content="{enc.Encode(ogTitle)}" />
            <meta property="og:description" content="{enc.Encode(description)}" />
            <meta property="og:url" content="{enc.Encode(inviteUrl)}" />
            <meta property="og:image" content="{enc.Encode(imageUrl)}" />
            <meta property="og:image:width" content="{OgImageWidth}" />
            <meta property="og:image:height" content="{OgImageHeight}" />
            <meta property="og:image:type" content="image/png" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="{enc.Encode(ogTitle)}" />
            <meta name="twitter:description" content="{enc.Encode(description)}" />
            <meta name="twitter:image" content="{enc.Encode(imageUrl)}" />
            </head>
            <body></body>
            </html>
            """;
    }
}
