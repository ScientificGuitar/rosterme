using RosterMeApi.Entities;

namespace RosterMeApi.Tests;

/// <summary>
/// Builds a <see cref="Group"/> together with its Owner-role
/// <see cref="GroupAdmin"/> row, mirroring what POST /api/groups creates.
/// Used by tests that seed groups directly via the DbContext.
/// </summary>
public static class TestGroupSeeder
{
    public static Group OwnedBy(string name, string ownerId, Guid? id = null)
    {
        var groupId = id ?? Guid.NewGuid();
        var group = new Group
        {
            Id = groupId,
            Name = name,
            CreatedAt = DateTime.UtcNow
        };
        group.Admins.Add(new GroupAdmin
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            ClerkUserId = ownerId,
            Role = GroupAdminRole.Owner,
            CreatedAt = DateTime.UtcNow
        });
        return group;
    }

    /// <summary>Adds a linked Admin-role row (the person has an account).</summary>
    public static Group WithLinkedAdmin(
        this Group group, string clerkUserId, string? email = null, string? name = null)
    {
        group.Admins.Add(new GroupAdmin
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            ClerkUserId = clerkUserId,
            Email = email,
            Name = name,
            Role = GroupAdminRole.Admin,
            CreatedAt = DateTime.UtcNow
        });
        return group;
    }

    /// <summary>Adds an email-only admin row (invited, no account yet).</summary>
    public static Group WithUnlinkedAdmin(this Group group, string email)
    {
        group.Admins.Add(new GroupAdmin
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            Email = email,
            Role = GroupAdminRole.Admin,
            CreatedAt = DateTime.UtcNow
        });
        return group;
    }
}