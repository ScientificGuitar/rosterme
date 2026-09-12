using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace RosterMeApi.Validation;

public static class DbConflictDetector
{
    public static bool IsConflict(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg
            && pg.SqlState is "23505" or "23514";

    public static bool IsClientReferenceError(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg
            && pg.SqlState == "23503";
}
