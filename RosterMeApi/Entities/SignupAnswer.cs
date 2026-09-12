namespace RosterMeApi.Entities;

public class SignupAnswer
{
    public Guid Id { get; set; }
    public Guid SignupId { get; set; }
    public Guid QuestionId { get; set; }
    public string Value { get; set; } = string.Empty;

    public Signup Signup { get; set; } = null!;
    public SignupQuestion Question { get; set; } = null!;
}
