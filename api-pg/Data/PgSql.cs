using System.Data;
using Dapper;

namespace WhatsAppCrm.Api.Data;

public static class PgSql
{
    // Numbers like PRP-00012 are MAX(seq) + 1 per company. SQL Server locked the table rows for that; here a
    // transaction-scoped advisory lock makes two saves for the same company take turns.
    public static Task LockAsync(IDbConnection db, IDbTransaction tx, string table, int companyId) =>
        db.ExecuteAsync("SELECT pg_advisory_xact_lock(hashtext(@table), @companyId)", new { table, companyId }, tx);
}
