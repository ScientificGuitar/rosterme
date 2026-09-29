namespace RosterMeApi.Services;

/// <summary>Repeat cadence for bulk event creation.</summary>
public enum RecurrenceFrequency
{
    Daily,
    Weekly,
    Monthly
}

/// <summary>
/// Expands a recurrence rule into concrete event dates. The start date is
/// always included as the first occurrence (weekly callers must include the
/// start date's weekday, enforced by validation). Monthly repeats clamp to
/// the last day of shorter months (Jan 31 → Feb 28).
/// Series are capped at <see cref="MaxOccurrences"/> occurrences within
/// <see cref="MaxHorizonMonths"/> months — the frontend shows these limits
/// and previews the truncated span, so callers never expect more.
/// </summary>
public static class RecurrenceExpander
{
    public const int MaxOccurrences = 60;
    public const int MaxHorizonMonths = 12;

    public static List<DateOnly> Expand(
        DateOnly start,
        RecurrenceFrequency frequency,
        int interval,
        IReadOnlyList<DayOfWeek>? daysOfWeek,
        int? count,
        DateOnly? untilDate)
    {
        interval = interval <= 0 ? 1 : interval;
        return frequency switch
        {
            RecurrenceFrequency.Daily => ExpandDaily(start, interval, count, untilDate),
            RecurrenceFrequency.Weekly => ExpandWeekly(start, interval, daysOfWeek ?? [], count, untilDate),
            RecurrenceFrequency.Monthly => ExpandMonthly(start, interval, count, untilDate),
            _ => []
        };
    }

    private static bool ExceedsHorizon(DateOnly start, DateOnly date) =>
        date > start.AddMonths(MaxHorizonMonths);

    private static List<DateOnly> ExpandDaily(
        DateOnly start, int interval, int? count, DateOnly? untilDate)
    {
        var dates = new List<DateOnly>();
        var date = start;
        while (true)
        {
            if (untilDate.HasValue && date > untilDate.Value) break;
            if (ExceedsHorizon(start, date)) break;
            dates.Add(date);
            if (count.HasValue && dates.Count >= count.Value) break;
            if (dates.Count >= MaxOccurrences) break;
            date = date.AddDays(interval);
        }
        return dates;
    }

    private static List<DateOnly> ExpandWeekly(
        DateOnly start, int interval, IReadOnlyList<DayOfWeek> daysOfWeek,
        int? count, DateOnly? untilDate)
    {
        var wanted = new HashSet<DayOfWeek>(daysOfWeek);
        if (wanted.Count == 0) return [];
        // Monday-based week index so "every N weeks" stays aligned to calendar weeks.
        var startMonday = start.AddDays(-(((int)start.DayOfWeek + 6) % 7));
        var dates = new List<DateOnly>();
        var date = start;
        while (true)
        {
            if (untilDate.HasValue && date > untilDate.Value) break;
            if (ExceedsHorizon(start, date)) break;
            var monday = date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
            var weekOffset = (monday.DayNumber - startMonday.DayNumber) / 7;
            if (date >= start && wanted.Contains(date.DayOfWeek) && weekOffset % interval == 0)
            {
                dates.Add(date);
                if (count.HasValue && dates.Count >= count.Value) break;
                if (dates.Count >= MaxOccurrences) break;
            }
            date = date.AddDays(1);
        }
        return dates;
    }

    private static List<DateOnly> ExpandMonthly(
        DateOnly start, int interval, int? count, DateOnly? untilDate)
    {
        var dates = new List<DateOnly>();
        var index = 0;
        while (true)
        {
            var month = start.Month - 1 + index * interval;
            var year = start.Year + month / 12;
            var monthOfYear = month % 12 + 1;
            var day = Math.Min(start.Day, DateTime.DaysInMonth(year, monthOfYear));
            var date = new DateOnly(year, monthOfYear, day);
            if (untilDate.HasValue && date > untilDate.Value) break;
            if (ExceedsHorizon(start, date)) break;
            dates.Add(date);
            if (count.HasValue && dates.Count >= count.Value) break;
            if (dates.Count >= MaxOccurrences) break;
            index++;
        }
        return dates;
    }
}
