namespace RosterMeApi.Entities;

public class Organization
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ClerkUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public ICollection<Event> Events { get; set; } = [];
}
