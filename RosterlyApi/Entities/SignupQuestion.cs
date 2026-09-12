namespace RosterlyApi.Entities;

public class SignupQuestion
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string Label { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public bool Required { get; set; }
    public string? Options { get; set; }
    public bool IsDeleted { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public Event Event { get; set; } = null!;
    public ICollection<SignupAnswer> Answers { get; set; } = [];
}
