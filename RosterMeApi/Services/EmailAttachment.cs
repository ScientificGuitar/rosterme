namespace RosterMeApi.Services;

/// <summary>
/// A single file attachment for an outgoing email.
/// </summary>
public sealed record EmailAttachment(string FileName, string ContentType, byte[] Content);
