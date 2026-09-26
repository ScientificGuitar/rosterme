namespace RosterMeApi.Entities;

/// <summary>
/// Controls whether volunteers are emailed when they are removed from a
/// slot, a slot they signed up for is deleted, or the event is deleted.
/// Ask is the default (and the CLR default) so EF inserts and the DB
/// default agree.
/// </summary>
public enum RemovalEmailPolicy
{
    Ask,
    Always,
    Never
}
