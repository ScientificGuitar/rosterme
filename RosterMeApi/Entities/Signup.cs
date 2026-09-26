namespace RosterMeApi.Entities;

public class Signup
{
    public Guid Id { get; set; }
    public Guid TimeSlotId { get; set; }
    public Guid? InviteLinkId { get; set; }
    public string VolunteerName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public SignupStatus Status { get; set; } = SignupStatus.Pending;
    public string ManagementTokenHash { get; set; } = string.Empty;
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ReminderSentAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public TimeSlot TimeSlot { get; set; } = null!;
    public InviteLink? InviteLink { get; set; }
    public ICollection<SignupAnswer> Answers { get; set; } = [];
}
