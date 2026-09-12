namespace RosterMeApi.Services;

public class ReminderOptions
{
    public bool Enabled { get; set; } = true;
    public int IntervalMinutes { get; set; } = 10;
    public int HoursBefore { get; set; } = 24;
    public int BatchSize { get; set; } = 100;
    public double SuppressIfCreatedWithinHours { get; set; } = 3;
}
