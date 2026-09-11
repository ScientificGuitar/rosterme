using RosterlyApi.Services;
using Xunit;

namespace RosterlyApi.Tests;

public class EmailTemplatesTests
{
    [Fact]
    public void BuildSignupConfirmation_WithLocationAndLinks_IncludesBoth()
    {
        var links = CalendarInviteBuilder.BuildLinks(
            "Sunday Service", null, "123 Main St",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "Morning", "https://example.com/m");

        var (_, html, text) = EmailTemplates.BuildSignupConfirmation(
            "Jane", "My Org", "Sunday Service", "Morning",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "https://example.com/m",
            "123 Main St", links, hasCalendarAttachment: true);

        Assert.Contains("Morning", html);
        Assert.Contains("Shift: Morning", text);
        Assert.Contains("123 Main St", html);
        Assert.Contains("Location: 123 Main St", text);
        Assert.Contains("calendar.google.com", html);
        Assert.Contains("outlook.live.com", html);
        Assert.Contains(".ics invite is also attached", html);
    }

    [Fact]
    public void BuildSignupReminder_IncludesDetailsAndManageLinkWithoutCalendar()
    {
        var (subject, html, text) = EmailTemplates.BuildSignupReminder(
            "Jane", "My Org", "Sunday Service", "Morning",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "https://example.com/signup/manage/token123",
            "123 Main St");

        Assert.Contains("Sunday Service", subject);
        Assert.Contains("Morning", html);
        Assert.Contains("Shift: Morning", text);
        Assert.Contains("123 Main St", html);
        Assert.Contains("Location: 123 Main St", text);
        Assert.Contains("https://example.com/signup/manage/token123", html);
        Assert.Contains("https://example.com/signup/manage/token123", text);
        Assert.DoesNotContain("calendar.google.com", html);
        Assert.DoesNotContain("calendar.google.com", text);
    }

    [Fact]
    public void BuildSignupConfirmation_WithoutLocationOrLinks_OmitsSections()
    {
        var (_, html, text) = EmailTemplates.BuildSignupConfirmation(
            "Jane", "My Org", "Sunday Service", "Morning",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "https://example.com/m");

        Assert.Contains("Morning", html);
        Assert.Contains("Shift: Morning", text);
        Assert.DoesNotContain("LOCATION", html);
        Assert.DoesNotContain("Location:", text);
        Assert.DoesNotContain("calendar.google.com", html);
    }
}
