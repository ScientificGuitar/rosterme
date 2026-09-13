namespace RosterMeApi.Entities;

public class Event
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Location { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; }

    public Group Group { get; set; } = null!;
    public ICollection<TimeSlot> TimeSlots { get; set; } = [];
    public ICollection<SignupQuestion> Questions { get; set; } = [];
}
