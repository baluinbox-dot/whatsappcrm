using System.Data;
using Npgsql;

namespace WhatsAppCrm.Api.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class PgConnectionFactory : IDbConnectionFactory
{
    private readonly NpgsqlDataSource _source;

    public PgConnectionFactory(IConfiguration configuration)
    {
        var cs = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");
        _source = NpgsqlDataSource.Create(cs);
    }

    public IDbConnection CreateConnection() => _source.CreateConnection();
}
