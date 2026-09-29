using RosterMeApi.Services;
using Xunit;

namespace RosterMeApi.Tests;

public class RecurrenceExpanderTests
{
    [Fact]
    public void Expand_Daily_IncludesStartAndStepsByInterval()
    {
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 10, 5), RecurrenceFrequency.Daily, 2, null, 3, null);

        Assert.Equal(
            [new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 7), new DateOnly(2026, 10, 9)],
            dates);
    }

    [Fact]
    public void Expand_Weekly_MultipleDays_IncludesStartDate()
    {
        // Monday 2026-10-05, repeating Mon+Wed.
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 10, 5), RecurrenceFrequency.Weekly, 1,
            [DayOfWeek.Monday, DayOfWeek.Wednesday], 4, null);

        Assert.Equal(
            [
                new DateOnly(2026, 10, 5),
                new DateOnly(2026, 10, 7),
                new DateOnly(2026, 10, 12),
                new DateOnly(2026, 10, 14)
            ],
            dates);
    }

    [Fact]
    public void Expand_Weekly_EveryTwoWeeks_SkipsAlternateWeeks()
    {
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 10, 5), RecurrenceFrequency.Weekly, 2,
            [DayOfWeek.Monday], 3, null);

        Assert.Equal(
            [
                new DateOnly(2026, 10, 5),
                new DateOnly(2026, 10, 19),
                new DateOnly(2026, 11, 2)
            ],
            dates);
    }

    [Fact]
    public void Expand_Weekly_UntilDate_StopsAtUntil()
    {
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 10, 5), RecurrenceFrequency.Weekly, 1,
            [DayOfWeek.Monday], null, new DateOnly(2026, 10, 19));

        Assert.Equal(
            [new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 12), new DateOnly(2026, 10, 19)],
            dates);
    }

    [Fact]
    public void Expand_Monthly_ClampsToLastDayOfShortMonths()
    {
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 1, 31), RecurrenceFrequency.Monthly, 1, null, 3, null);

        Assert.Equal(
            [new DateOnly(2026, 1, 31), new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 31)],
            dates);
    }

    [Fact]
    public void Expand_UntilDateBeforeStart_ReturnsEmpty()
    {
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 10, 5), RecurrenceFrequency.Daily, 1, null,
            null, new DateOnly(2026, 10, 4));

        Assert.Empty(dates);
    }

    [Fact]
    public void Expand_Weekly_NoDays_ReturnsEmpty()
    {
        var dates = RecurrenceExpander.Expand(
            new DateOnly(2026, 10, 5), RecurrenceFrequency.Weekly, 1, [], 4, null);

        Assert.Empty(dates);
    }
}
