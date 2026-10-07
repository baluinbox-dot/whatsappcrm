using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IDashboardRepository
{
    Task<DashboardStats> GetStatsAsync(int companyId, int? onlyUserId, DateTime todayStartUtc);
    Task<IEnumerable<StaffLoad>> GetStaffLoadAsync(int companyId, DateTime todayStartUtc, DateTime monthStartUtc);
    Task<DashboardWork> GetWorkAsync(int companyId, int? onlyUserId, DateTime todayStartUtc);
    Task<DashboardInventory> GetInventoryAsync(int companyId, DateTime monthStartUtc);
    Task<IEnumerable<DashboardActivity>> GetRecentActivityAsync(int companyId, int? onlyUserId);
}

public class DashboardRepository : IDashboardRepository
{
    private readonly IDbConnectionFactory _factory;
    public DashboardRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<DashboardStats> GetStatsAsync(int companyId, int? onlyUserId, DateTime todayStartUtc)
    {
        const string sql = @"
            SELECT
                COUNT(*)::int AS total_customers,
                COALESCE(SUM(CASE WHEN c.created_at >= @today THEN 1 ELSE 0 END)::int, 0) AS new_today,
                COALESCE(SUM(CASE WHEN c.assigned_to IS NULL THEN 1 ELSE 0 END)::int, 0) AS unassigned,
                COALESCE(SUM(CASE WHEN c.unread_count > 0 THEN 1 ELSE 0 END)::int, 0) AS unread_chats,
                COALESCE(SUM(CASE WHEN c.last_inbound_at > utc_now() - interval '24 hours' THEN 1 ELSE 0 END)::int, 0) AS open_windows,
                (SELECT COUNT(*)::int FROM wsm_messages m
                 JOIN wsm_customers mc ON mc.customer_id = m.customer_id
                 WHERE m.company_id = @companyId AND m.created_at >= @today
                   AND (@onlyUserId IS NULL OR mc.assigned_to = @onlyUserId)) AS messages_today
            FROM wsm_customers c
            WHERE c.company_id = @companyId AND (@onlyUserId IS NULL OR c.assigned_to = @onlyUserId)";

        using var db = _factory.CreateConnection();
        return await db.QuerySingleAsync<DashboardStats>(sql, new { companyId, onlyUserId, today = todayStartUtc });
    }

    public async Task<IEnumerable<StaffLoad>> GetStaffLoadAsync(int companyId, DateTime todayStartUtc, DateTime monthStartUtc)
    {
        const string sql = @"
            SELECT u.user_id, u.full_name, u.is_active,
                   (SELECT COUNT(*)::int FROM wsm_customers c WHERE c.assigned_to = u.user_id) AS customers,
                   (SELECT COUNT(*)::int FROM wsm_customers c WHERE c.assigned_to = u.user_id AND c.unread_count > 0) AS unread_chats,
                   (SELECT COUNT(*)::int FROM wsm_messages m WHERE m.sent_by = u.user_id AND m.created_at >= @today) AS replies_today,
                   (SELECT COUNT(*)::int FROM wsm_leads l WHERE l.assigned_to = u.user_id
                        AND l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST')) AS open_leads,
                   (SELECT COUNT(*)::int FROM wsm_follow_ups f WHERE f.assigned_to = u.user_id AND f.is_done = 'F'
                        AND f.due_at < utc_now()) AS overdue_follow_ups,
                   (SELECT COUNT(*)::int FROM wsm_leads l WHERE l.assigned_to = u.user_id AND l.status = 'WON'
                        AND l.closed_at >= @month) AS deals_won_month,
                   (SELECT COALESCE(SUM(l.deal_value), 0) FROM wsm_leads l WHERE l.assigned_to = u.user_id AND l.status = 'WON'
                        AND l.closed_at >= @month) AS deal_value_month
            FROM wsm_users u
            WHERE u.company_id = @companyId
            ORDER BY u.is_active DESC, u.full_name";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<StaffLoad>(sql, new { companyId, today = todayStartUtc, month = monthStartUtc });
    }

    public async Task<DashboardWork> GetWorkAsync(int companyId, int? onlyUserId, DateTime todayStartUtc)
    {
        const string sql = @"
            SELECT
                (SELECT COUNT(*)::int FROM wsm_follow_ups f WHERE f.company_id = @companyId AND f.is_done = 'F'
                    AND f.due_at < utc_now() AND (@onlyUserId IS NULL OR f.assigned_to = @onlyUserId)) AS overdue_follow_ups,
                (SELECT COUNT(*)::int FROM wsm_follow_ups f WHERE f.company_id = @companyId AND f.is_done = 'F'
                    AND f.due_at >= utc_now() AND f.due_at < @tomorrow AND (@onlyUserId IS NULL OR f.assigned_to = @onlyUserId)) AS due_today,
                (SELECT COUNT(*)::int FROM wsm_follow_ups f WHERE f.company_id = @companyId AND f.is_done = 'F' AND f.follow_up_type = 'VIEWING'
                    AND f.due_at >= @today AND f.due_at < @tomorrow AND (@onlyUserId IS NULL OR f.assigned_to = @onlyUserId)) AS viewings_today,
                (SELECT COUNT(*)::int FROM wsm_follow_ups f WHERE f.company_id = @companyId AND f.is_done = 'F' AND f.follow_up_type = 'VIEWING'
                    AND f.due_at >= @tomorrow AND f.due_at < @dayAfter AND (@onlyUserId IS NULL OR f.assigned_to = @onlyUserId)) AS viewings_tomorrow,
                (SELECT COUNT(*)::int FROM wsm_leads l WHERE l.company_id = @companyId AND l.created_at >= @today
                    AND (@onlyUserId IS NULL OR l.assigned_to = @onlyUserId)) AS new_leads_today,
                (SELECT COUNT(*)::int FROM wsm_leads l WHERE l.company_id = @companyId AND l.assigned_to IS NULL
                    AND l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST')) AS unassigned_leads,
                -- Open leads with no activity (and no follow-up scheduled) for 7 days.
                (SELECT COUNT(*)::int FROM wsm_leads l WHERE l.company_id = @companyId
                    AND l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST') AND (@onlyUserId IS NULL OR l.assigned_to = @onlyUserId)
                    AND l.updated_at < utc_now() - interval '7 days'
                    AND NOT EXISTS (SELECT 1 FROM wsm_follow_ups f WHERE f.lead_id = l.lead_id AND f.is_done = 'F')) AS cold_leads";

        using var db = _factory.CreateConnection();
        return await db.QuerySingleAsync<DashboardWork>(sql, new { companyId, onlyUserId, today = todayStartUtc, tomorrow = todayStartUtc.AddDays(1), dayAfter = todayStartUtc.AddDays(2) });
    }

    public async Task<DashboardInventory> GetInventoryAsync(int companyId, DateTime monthStartUtc)
    {
        // Sold / Rented "this month" uses the listing's last update, which is when it was marked.
        const string sql = @"
            SELECT
                COALESCE(SUM(CASE WHEN status = 'AVAILABLE' AND purpose = 'SALE' THEN 1 ELSE 0 END)::int, 0) AS available_sale,
                COALESCE(SUM(CASE WHEN status = 'AVAILABLE' AND purpose = 'RENT' THEN 1 ELSE 0 END)::int, 0) AS available_rent,
                COALESCE(SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END)::int, 0) AS reserved,
                COALESCE(SUM(CASE WHEN status = 'SOLD' AND updated_at >= @month THEN 1 ELSE 0 END)::int, 0) AS sold_month,
                COALESCE(SUM(CASE WHEN status = 'RENTED' AND updated_at >= @month THEN 1 ELSE 0 END)::int, 0) AS rented_month,
                COALESCE(SUM(CASE WHEN status = 'AVAILABLE' AND ph.images = 0 THEN 1 ELSE 0 END)::int, 0) AS missing_photos
            FROM wsm_properties p
            LEFT JOIN LATERAL (SELECT COUNT(*)::int AS images FROM wsm_property_files f
                         WHERE f.property_id = p.property_id AND f.file_kind = 'IMAGE') ph ON TRUE
            WHERE p.company_id = @companyId";

        using var db = _factory.CreateConnection();
        return await db.QuerySingleAsync<DashboardInventory>(sql, new { companyId, month = monthStartUtc });
    }

    public async Task<IEnumerable<DashboardActivity>> GetRecentActivityAsync(int companyId, int? onlyUserId)
    {
        const string sql = @"
            SELECT a.activity_id, a.lead_id, l.lead_seq, c.customer_name, c.whatsapp_name, c.mobile_no, c.email,
                   a.activity_type, a.body, a.outcome, a.status_to, l.source AS lead_source, u.full_name AS by_name, a.created_at
            FROM wsm_lead_activities a
            JOIN wsm_leads l ON l.lead_id = a.lead_id
            JOIN wsm_customers c ON c.customer_id = l.customer_id
            LEFT JOIN wsm_users u ON u.user_id = a.created_by
            WHERE a.company_id = @companyId AND a.activity_type IN ('CREATED', 'SHARE', 'STATUS', 'VIEWING', 'MEETING', 'CALL')
              AND (@onlyUserId IS NULL OR l.assigned_to = @onlyUserId)
            ORDER BY a.created_at DESC, a.activity_id DESC
            LIMIT 10";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<DashboardActivity>(sql, new { companyId, onlyUserId });
    }
}
