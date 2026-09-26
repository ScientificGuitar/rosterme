namespace RosterMeApi.Services;

/// <summary>
/// Timeslots store wall-clock <see cref="TimeOnly"/> values against the parent
/// event's <see cref="DateOnly"/>. An end time earlier than the start time
/// means the slot rolls over to the next day.
/// </summary>
public static class SlotTimes
{
    public static bool IsOvernight(TimeOnly startTime, TimeOnly endTime) => endTime < startTime;

    public static DateTime ResolveStart(DateOnly eventDate, TimeOnly startTime) =>
        eventDate.ToDateTime(startTime);

    public static DateTime ResolveEnd(DateOnly eventDate, TimeOnly startTime, TimeOnly endTime) =>
        IsOvernight(startTime, endTime)
            ? eventDate.AddDays(1).ToDateTime(endTime)
            : eventDate.ToDateTime(endTime);

    /// <summary>Suffix appended to displayed end times for overnight slots.</summary>
    public static string OvernightSuffix(TimeOnly startTime, TimeOnly endTime) =>
        IsOvernight(startTime, endTime) ? " (+1 day)" : "";
}
