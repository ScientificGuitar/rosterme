namespace RosterMeApi.Entities;

public enum GroupAdminRole
{
    Owner,
    Admin
}

public class GroupAdmin
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }

    /// <summary>Clerk <c>sub</c> user id. Null until the person has an account
    /// or has been linked (invite-by-email rows start unlinked).</summary>
    public string? ClerkUserId { get; set; }

    /// <summary>Display name, captured from Clerk JWT claims when available.</summary>
    public string? Name { get; set; }

    /// <summary>Normalized (lowercased, trimmed) email used to identify the member.</summary>
    public string? Email { get; set; }

    public GroupAdminRole Role { get; set; } = GroupAdminRole.Admin;
    public DateTime CreatedAt { get; set; }

    public Group Group { get; set; } = null!;
}