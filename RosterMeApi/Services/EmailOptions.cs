namespace RosterMeApi.Services;

public class EmailOptions
{
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "RosterMe";
    public string BaseUrl { get; set; } = string.Empty;
    public int PollIntervalSeconds { get; set; } = 5;
    public int BatchSize { get; set; } = 20;
}