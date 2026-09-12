namespace RosterMeApi.Entities;

public class TimeSlot
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string Label { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int Capacity { get; set; }
    public bool AllowWaitlist { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public Event Event { get; set; } = null!;
    public ICollection<Signup> Signups { get; set; } = [];
}
