using System.Text;

namespace RosterMeApi.Services;

/// <summary>
/// Builds RFC 5545 calendar invites (.ics) and "Add to calendar" provider links
/// for volunteer signups.
/// </summary>
/// <remarks>
/// Event times are stored as timezone-less <see cref="DateOnly"/> + <see cref="TimeOnly"/>
/// values, so the invite uses floating local times (no TZID/UTC suffix). Calendar
/// apps interpret those in the viewer's local timezone, which matches how the
/// times are displayed in the app.
/// </remarks>
public static class CalendarInviteBuilder
{
    public sealed record CalendarLinks(string Google, string Outlook, string Yahoo);

    public static string BuildIcs(
        string eventTitle,
        string? description,
        string? location,
        DateOnly eventDate,
        TimeOnly startTime,
        TimeOnly endTime,
        string slotLabel,
        string manageUrl,
        string uid)
    {
        var start = eventDate.ToDateTime(startTime);
        var end = eventDate.ToDateTime(endTime);
        var stamp = DateTime.UtcNow;

        var textDescription = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(description))
            textDescription.AppendLine(description);
        textDescription.AppendLine($"Shift: {slotLabel} ({startTime:HH:mm}–{endTime:HH:mm})");
        textDescription.Append("View or cancel your signup: ");
        textDescription.Append(manageUrl);

        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCALENDAR");
        sb.AppendLine("VERSION:2.0");
        sb.AppendLine("PRODID:-//RosterMe//Volunteer Signup//EN");
        sb.AppendLine("METHOD:PUBLISH");
        sb.AppendLine("BEGIN:VEVENT");
        AppendProperty(sb, "UID", $"{uid}@rosterme");
        AppendProperty(sb, "DTSTAMP", FormatUtc(stamp));
        AppendProperty(sb, "DTSTART", FormatFloating(start));
        AppendProperty(sb, "DTEND", FormatFloating(end));
        AppendProperty(sb, "SUMMARY", eventTitle);
        if (!string.IsNullOrWhiteSpace(location))
            AppendProperty(sb, "LOCATION", location);
        AppendProperty(sb, "DESCRIPTION", textDescription.ToString());
        sb.AppendLine("STATUS:CONFIRMED");
        sb.AppendLine("END:VEVENT");
        sb.AppendLine("END:VCALENDAR");
        return sb.ToString();
    }

    public static CalendarLinks BuildLinks(
        string eventTitle,
        string? description,
        string? location,
        DateOnly eventDate,
        TimeOnly startTime,
        TimeOnly endTime,
        string slotLabel,
        string manageUrl)
    {
        var start = eventDate.ToDateTime(startTime);
        var end = eventDate.ToDateTime(endTime);
        var dates = $"{FormatFloating(start)}/{FormatFloating(end)}";
        var details = string.IsNullOrWhiteSpace(description)
            ? $"Shift: {slotLabel}. View or cancel: {manageUrl}"
            : $"{description} Shift: {slotLabel}. View or cancel: {manageUrl}";

        var google = "https://calendar.google.com/calendar/render?action=TEMPLATE"
            + $"&text={Uri.EscapeDataString(eventTitle)}"
            + $"&dates={dates}"
            + $"&details={Uri.EscapeDataString(details)}"
            + (string.IsNullOrWhiteSpace(location) ? "" : $"&location={Uri.EscapeDataString(location)}");

        var outlook = "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent"
            + $"&subject={Uri.EscapeDataString(eventTitle)}"
            + $"&startdt={FormatFloating(start)}"
            + $"&enddt={FormatFloating(end)}"
            + $"&body={Uri.EscapeDataString(details)}"
            + (string.IsNullOrWhiteSpace(location) ? "" : $"&location={Uri.EscapeDataString(location)}");

        var yahoo = "https://calendar.yahoo.com/?v=60&view=d&type=20"
            + $"&title={Uri.EscapeDataString(eventTitle)}"
            + $"&st={FormatFloating(start)}"
            + $"&et={FormatFloating(end)}"
            + $"&desc={Uri.EscapeDataString(details)}"
            + (string.IsNullOrWhiteSpace(location) ? "" : $"&in_loc={Uri.EscapeDataString(location)}");

        return new CalendarLinks(google, outlook, yahoo);
    }

    public static string IcsFileName(string eventTitle)
    {
        var slug = new string(eventTitle
            .ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray());
        slug = string.Join("-", slug.Split('-', StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrEmpty(slug)) slug = "event";
        if (slug.Length > 50) slug = slug[..50];
        return $"rosterme-{slug}.ics";
    }

    private static string FormatFloating(DateTime dt) => dt.ToString("yyyyMMdd'T'HHmmss");
    private static string FormatUtc(DateTime dt) => dt.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");

    private static void AppendProperty(StringBuilder sb, string name, string value)
    {
        var escaped = value
            .Replace("\\", "\\\\")
            .Replace(";", "\\;")
            .Replace(",", "\\,")
            .Replace("\r\n", "\\n")
            .Replace("\n", "\\n");

        var line = $"{name}:{escaped}";
        // Fold lines longer than 75 octets per RFC 5545 §3.1.
        // Content here is UTF-8; fold conservatively on chars to stay well under the limit.
        const int maxLen = 73;
        if (line.Length <= maxLen + 2)
        {
            sb.AppendLine(line);
            return;
        }
        sb.AppendLine(line[..maxLen]);
        var rest = line[maxLen..];
        while (rest.Length > maxLen - 1)
        {
            sb.Append(' ');
            sb.AppendLine(rest[..(maxLen - 1)]);
            rest = rest[(maxLen - 1)..];
        }
        sb.Append(' ');
        sb.AppendLine(rest);
    }
}
