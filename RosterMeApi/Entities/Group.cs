namespace RosterMeApi.Entities;

public class Group
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GroupOwner { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public ICollection<Event> Events { get; set; } = [];
}
