namespace RosterMeApi.Entities;

/// <summary>
/// The kind of an <see cref="EventActivity"/> row.
/// To track a new activity, add a value here and call
/// <c>ActivityLogService.Log(...)</c> at the action site — one line.
/// </summary>
public enum ActivityKind
{
    SignupCreated,
    SignupConfirmed,
    SignupCancelled,
    SignupRemoved,
    WaitlistPromoted,
    EventCreated,
    EventUpdated,
    SlotCreated,
    SlotUpdated,
    SlotDeleted,
    InviteCreated,
    InviteRenamed,
    InviteRevoked,
    ConfirmationResent
}
