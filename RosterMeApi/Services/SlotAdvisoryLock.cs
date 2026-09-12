using System.Data;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

using RosterMeApi.Data;

namespace RosterMeApi.Services;

public static class SlotAdvisoryLock
{
    /// <summary>
    /// Takes a transaction-scoped advisory lock keyed by the time slot id.
    /// Serializes capacity-sensitive operations (signup, cancel, removal,
    /// promotion) so they cannot race each other. Must be called inside an
    /// active transaction; the lock is released when that transaction ends.
    /// </summary>
    public static async Task AcquireAsync(AppDbContext db, Guid slotId, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        var dbTx = db.Database.CurrentTransaction?.GetDbTransaction();

        await using var cmd = conn.CreateCommand();
        if (dbTx is not null) cmd.Transaction = dbTx;
        cmd.CommandText = """
            SELECT pg_advisory_xact_lock(
                ('x' || left(replace(@slotId::text, '-', ''), 16))::bit(64)::bigint
            )
            """;
        var slotParam = cmd.CreateParameter();
        slotParam.ParameterName = "slotId";
        slotParam.Value = slotId;
        cmd.Parameters.Add(slotParam);
        await cmd.ExecuteScalarAsync(ct);
    }
}
