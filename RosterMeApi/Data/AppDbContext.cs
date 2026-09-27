using Microsoft.EntityFrameworkCore;
using RosterMeApi.Entities;

namespace RosterMeApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupAdmin> GroupAdmins => Set<GroupAdmin>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<TimeSlot> TimeSlots => Set<TimeSlot>();
    public DbSet<Signup> Signups => Set<Signup>();
    public DbSet<SignupQuestion> SignupQuestions => Set<SignupQuestion>();
    public DbSet<SignupAnswer> SignupAnswers => Set<SignupAnswer>();
    public DbSet<InviteLink> InviteLinks => Set<InviteLink>();
    public DbSet<EmailMessage> EmailMessages => Set<EmailMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<GroupAdmin>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ClerkUserId).HasMaxLength(100);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(320);
            entity.Property(e => e.Role).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.HasIndex(e => new { e.GroupId, e.Email }).IsUnique();
            // Exactly one owner per group, enforced at the database level.
            entity.HasIndex(e => e.GroupId)
                .IsUnique()
                .HasFilter("\"Role\" = 'Owner'");
            // Access checks filter by (GroupId, ClerkUserId); the identity sync
            // looks up admins globally by ClerkUserId alone.
            entity.HasIndex(e => new { e.GroupId, e.ClerkUserId });
            entity.HasIndex(e => e.ClerkUserId);
            entity.HasOne(e => e.Group)
                .WithMany(g => g.Admins)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(300).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2000);
            entity.Property(e => e.Location).HasMaxLength(500);
            entity.HasOne(e => e.Group)
                .WithMany(o => o.Events)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.GroupId, e.Date });
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.RemovalEmailPolicy).HasConversion<string>().HasMaxLength(20).IsRequired().HasDefaultValue(RemovalEmailPolicy.Ask);
        });

        modelBuilder.Entity<TimeSlot>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Label).HasMaxLength(200).IsRequired();
            entity.HasOne(s => s.Event)
                .WithMany(o => o.TimeSlots)
                .HasForeignKey(s => s.EventId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Property(e => e.AllowWaitlist).HasDefaultValue(true).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Signup>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.VolunteerName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(320).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.ManagementTokenHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(e => e.ManagementTokenHash).IsUnique();
            entity.HasIndex(e => new { e.Email, e.TimeSlotId })
                .IsUnique()
                .HasFilter("\"Status\" <> 'Cancelled' AND \"Status\" <> 'Removed'");
            entity.HasIndex(e => new { e.Status, e.ReminderSentAt });
            entity.HasOne(s => s.TimeSlot)
                .WithMany(o => o.Signups)
                .HasForeignKey(s => s.TimeSlotId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(s => s.InviteLink)
                .WithMany(l => l.Signups)
                .HasForeignKey(s => s.InviteLinkId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.InviteLinkId);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<SignupQuestion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Label).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.Options).HasMaxLength(2500);
            entity.Property(e => e.IsDeleted).HasDefaultValue(false).IsRequired();
            entity.HasOne(q => q.Event)
                .WithMany(e => e.Questions)
                .HasForeignKey(q => q.EventId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.EventId);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<SignupAnswer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Value).HasMaxLength(500).IsRequired();
            entity.HasOne(a => a.Signup)
                .WithMany(s => s.Answers)
                .HasForeignKey(a => a.SignupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(a => a.Question)
                .WithMany(q => q.Answers)
                .HasForeignKey(a => a.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.SignupId, e.QuestionId }).IsUnique();
            entity.HasIndex(e => e.QuestionId);
        });

        modelBuilder.Entity<EmailMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.To).HasMaxLength(320).IsRequired();
            entity.Property(e => e.Subject).HasMaxLength(500).IsRequired();
            entity.Property(e => e.HtmlBody).IsRequired();
            entity.Property(e => e.AttachmentFileName).HasMaxLength(255);
            entity.Property(e => e.AttachmentContentType).HasMaxLength(100);
            entity.HasIndex(e => e.Sent);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<InviteLink>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Code).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasOne(l => l.Event)
                .WithMany()
                .HasForeignKey(l => l.EventId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.EventId);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });
    }
}
