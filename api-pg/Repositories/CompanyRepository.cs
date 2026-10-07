using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface ICompanyRepository
{
    Task<IEnumerable<CompanyRow>> GetAllAsync(string? search, string? status);
    Task<string?> GetCodeAsync(int companyId);
    Task<int?> GetActiveIdByCodeAsync(string companyCode);
    Task<bool> SetStatusAsync(int companyId, string status);
}

public class CompanyRepository : ICompanyRepository
{
    private readonly IDbConnectionFactory _factory;
    public CompanyRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IEnumerable<CompanyRow>> GetAllAsync(string? search, string? status)
    {
        const string sql = @"
            SELECT c.company_id, c.company_code, c.company_name, c.status, c.created_at, c.approved_at,
                   a.full_name AS admin_name, a.email AS admin_email, s.display_number,
                   (SELECT COUNT(*)::int FROM wsm_users     WHERE company_id = c.company_id) AS users,
                   (SELECT COUNT(*)::int FROM wsm_customers WHERE company_id = c.company_id) AS customers,
                   (SELECT COUNT(*)::int FROM wsm_messages  WHERE company_id = c.company_id) AS messages
            FROM wsm_companies c
            LEFT JOIN LATERAL (SELECT full_name, email FROM wsm_users
                         WHERE company_id = c.company_id AND role = 'ADMIN' ORDER BY user_id LIMIT 1) a ON TRUE
            LEFT JOIN wsm_whatsapp_settings s ON s.company_id = c.company_id
            WHERE (@status IS NULL OR c.status = @status)
              AND (@search IS NULL OR c.company_name ILIKE '%' || @search || '%' OR a.email ILIKE '%' || @search || '%')
            ORDER BY CASE c.status WHEN 'PENDING' THEN 0 ELSE 1 END, c.created_at DESC";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<CompanyRow>(sql, new
        {
            search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            status = string.IsNullOrWhiteSpace(status) ? null : status
        });
    }

    public async Task<string?> GetCodeAsync(int companyId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<string?>(
            "SELECT company_code FROM wsm_companies WHERE company_id = @companyId", new { companyId });
    }

    public async Task<int?> GetActiveIdByCodeAsync(string companyCode)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int?>(
            "SELECT company_id FROM wsm_companies WHERE LOWER(company_code) = LOWER(@companyCode) AND status = 'ACTIVE'", new { companyCode });
    }

    public async Task<bool> SetStatusAsync(int companyId, string status)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(@"
            UPDATE wsm_companies
            SET status = @status, approved_at = CASE WHEN @status = 'ACTIVE' THEN COALESCE(approved_at, utc_now()) ELSE approved_at END
            WHERE company_id = @companyId", new { companyId, status }) > 0;
    }
}
