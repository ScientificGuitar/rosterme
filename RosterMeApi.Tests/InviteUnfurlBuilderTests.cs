using RosterMeApi.Services;
using Xunit;

namespace RosterMeApi.Tests;

public class InviteUnfurlBuilderTests
{
    [Fact]
    public void FormatDate_UsesLongForm()
    {
        Assert.Equal("Saturday, June 14, 2025", InviteUnfurlBuilder.FormatDate(new DateOnly(2025, 6, 14)));
    }

    [Fact]
    public void Truncate_ShortValue_Unchanged()
    {
        Assert.Equal("Hello", InviteUnfurlBuilder.Truncate("  Hello  ", 70));
    }

    [Fact]
    public void Truncate_LongValue_EllipsizedWithinLimit()
    {
        var result = InviteUnfurlBuilder.Truncate(new string('a', 100), 70);
        Assert.Equal(70, result.Length);
        Assert.EndsWith("…", result);
    }

    [Fact]
    public void BuildHtml_EncodesMarkup()
    {
        var html = InviteUnfurlBuilder.BuildHtml(
            new InviteUnfurlData("<script>alert(\"x\")</script> & friends", "Group <b>", new DateOnly(2026, 3, 1)),
            "https://rosterme.app/invite/abc",
            "https://rosterme.app/api/invite/abc/og-image.png");

        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
        Assert.Contains("noindex, nofollow", html);
        Assert.Contains("1200", html);
        Assert.Contains("https://rosterme.app/api/invite/abc/og-image.png", html);
        // Description stays title/group/date only.
        Assert.DoesNotContain("og-image", html.Split("og:description")[0]);
    }

    [Fact]
    public void BuildHtml_DescriptionOmitsLocationAndCounts()
    {
        var html = InviteUnfurlBuilder.BuildHtml(
            new InviteUnfurlData("Park Cleanup", "Green Org", new DateOnly(2026, 3, 1)),
            "https://rosterme.app/invite/abc",
            "https://rosterme.app/api/invite/abc/og-image.png");

        Assert.Contains("Green Org · Sunday, March 1, 2026", html);
    }

    [Fact]
    public void BuildFallbackHtml_ContainsNoEventData()
    {
        var html = InviteUnfurlBuilder.BuildFallbackHtml(
            "https://rosterme.app/invite/bad", "https://rosterme.app/og-image.png");

        Assert.Contains("RosterMe", html);
        Assert.Contains("https://rosterme.app/og-image.png", html);
        Assert.DoesNotContain("/api/invite/", html);
        Assert.Contains("noindex, nofollow", html);
    }
}
