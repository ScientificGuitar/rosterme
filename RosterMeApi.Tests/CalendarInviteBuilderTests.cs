using RosterMeApi.Services;
using Xunit;

namespace RosterMeApi.Tests;

public class CalendarInviteBuilderTests
{
    [Fact]
    public void BuildIcs_ContainsExpectedProperties()
    {
        var ics = CalendarInviteBuilder.BuildIcs(
            "Sunday Service",
            "Weekly gathering",
            "123 Main St",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0),
            new TimeOnly(9, 0),
            "Morning",
            "https://example.com/signup/manage/token",
            "signup-id-1");

        Assert.Contains("BEGIN:VCALENDAR", ics);
        Assert.Contains("END:VCALENDAR", ics);
        Assert.Contains("BEGIN:VEVENT", ics);
        Assert.Contains("SUMMARY:Sunday Service", ics);
        Assert.Contains("LOCATION:123 Main St", ics);
        Assert.Contains("DTSTART:20260906T080000", ics);
        Assert.Contains("DTEND:20260906T090000", ics);
        Assert.Contains("UID:signup-id-1@rosterme", ics);
        Assert.Contains("STATUS:CONFIRMED", ics);
        Assert.Contains("https://example.com/signup/manage/token", ics);
    }

    [Fact]
    public void BuildIcs_NullLocation_OmitsLocationProperty()
    {
        var ics = CalendarInviteBuilder.BuildIcs(
            "Sunday Service", null, null,
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "Morning", "https://example.com/m", "uid-1");

        Assert.DoesNotContain("LOCATION", ics);
    }

    [Fact]
    public void BuildIcs_EscapesSpecialCharacters()
    {
        var ics = CalendarInviteBuilder.BuildIcs(
            "Serve, Eat; Pray", null, "Hall A,B",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "Morning", "https://example.com/m", "uid-1");

        Assert.Contains("SUMMARY:Serve\\, Eat\\; Pray", ics);
        Assert.Contains("LOCATION:Hall A\\,B", ics);
    }

    [Fact]
    public void BuildLinks_ContainsEncodedFields()
    {
        var links = CalendarInviteBuilder.BuildLinks(
            "Sunday Service",
            "Weekly gathering",
            "123 Main St",
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0),
            new TimeOnly(9, 0),
            "Morning",
            "https://example.com/m");

        Assert.Contains("calendar.google.com", links.Google);
        Assert.Contains("20260906T080000/20260906T090000", links.Google);
        Assert.Contains("location=123%20Main%20St", links.Google);
        Assert.Contains("outlook.live.com", links.Outlook);
        Assert.Contains("calendar.yahoo.com", links.Yahoo);
    }

    [Fact]
    public void BuildLinks_NullLocation_OmitsLocationParam()
    {
        var links = CalendarInviteBuilder.BuildLinks(
            "Sunday Service", null, null,
            new DateOnly(2026, 9, 6),
            new TimeOnly(8, 0), new TimeOnly(9, 0),
            "Morning", "https://example.com/m");

        Assert.DoesNotContain("location=", links.Google);
    }

    [Fact]
    public void IcsFileName_SlugifiesTitle()
    {
        Assert.Equal("rosterme-sunday-service-9am.ics",
            CalendarInviteBuilder.IcsFileName("Sunday Service (9am)!"));
    }
}
