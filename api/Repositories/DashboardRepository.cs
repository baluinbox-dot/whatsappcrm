using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IDashboardRepository
{
    Task<DashboardStats> GetStatsAsync(int companyId, int? onlyUserId, DateTime todayStartUtc);
    Task<IEnumerable<StaffLoad>> GetStaffLoadAsync(int companyId, DateTime todayStartUtc);
}

public class DashboardRepository : IDashboardRepository
{
    private readonly IDbConnectionFactory _factory;
    public DashboardRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<DashboardStats> GetStatsAsync(int companyId, int? onlyUserId, DateTime todayStartUtc)
    {
        const string sql = @"
            SELECT
                COUNT(*) AS total_customers,
                ISNULL(SUM(CASE WHEN c.created_at >= @today THEN 1 ELSE 0 END), 0) AS new_today,
                ISNULL(SUM(CASE WHEN c.assigned_to IS NULL THEN 1 ELSE 0 END), 0) AS unassigned,
                ISNULL(SUM(CASE WHEN c.unread_count > 0 THEN 1 ELSE 0 END), 0) AS unread_chats,
                ISNULL(SUM(CASE WHEN c.last_inbound_at > DATEADD(HOUR, -24, SYSUTCDATETIME()) THEN 1 ELSE 0 END), 0) AS open_windows,
                (SELECT COUNT(*) FROM dbo.wsm_messages m
                 JOIN dbo.wsm_customers mc ON mc.customer_id = m.customer_id
                 WHERE m.company_id = @companyId AND m.created_at >= @today
                   AND (@onlyUserId IS NULL OR mc.assigned_to = @onlyUserId)) AS messages_today
            FROM dbo.wsm_customers c
            WHERE c.company_id = @companyId AND (@onlyUserId IS NULL OR c.assigned_to = @onlyUserId)";

        using var db = _factory.CreateConnection();
        return await db.QuerySingleAsync<DashboardStats>(sql, new { companyId, onlyUserId, today = todayStartUtc });
    }

    public async Task<IEnumerable<StaffLoad>> GetStaffLoadAsync(int companyId, DateTime todayStartUtc)
    {
        const string sql = @"
            SELECT u.user_id, u.full_name, u.is_active,
                   (SELECT COUNT(*) FROM dbo.wsm_customers c WHERE c.assigned_to = u.user_id) AS customers,
                   (SELECT COUNT(*) FROM dbo.wsm_customers c WHERE c.assigned_to = u.user_id AND c.unread_count > 0) AS unread_chats,
                   (SELECT COUNT(*) FROM dbo.wsm_messages m WHERE m.sent_by = u.user_id AND m.created_at >= @today) AS replies_today
            FROM dbo.wsm_users u
            WHERE u.company_id = @companyId
            ORDER BY u.is_active DESC, u.full_name";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<StaffLoad>(sql, new { companyId, today = todayStartUtc });
    }
}
