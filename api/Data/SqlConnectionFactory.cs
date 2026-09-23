using System.Data;
using Microsoft.Data.SqlClient;

namespace WhatsAppCrm.Api.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqlConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");
    }

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
