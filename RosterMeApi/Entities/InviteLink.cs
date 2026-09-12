namespace RosterMeApi.Entities;

public class InviteLink
{
    public Guid Id { get; set; }
    public Guid? EventId { get; set; }
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    public Event? Event { get; set; }
}
