using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IFollowUpRepository
{
    // view: overdue / today / upcoming / done. Day boundaries come from the browser's timezone.
    Task<IEnumerable<FollowUpRow>> GetListAsync(int companyId, int? onlyUserId, string view, int tzOffsetMinutes, int? assignedTo);
    Task<IEnumerable<FollowUpRow>> GetForLeadAsync(int companyId, int leadId);
    Task<FollowUpRow?> GetByIdAsync(int companyId, int followUpId);
    Task<FollowUpRow?> CreateAsync(int companyId, int leadId, int? assignedTo, SaveFollowUpDto dto, int userId);
    Task CompleteAsync(int companyId, FollowUpRow f, string? result, int userId);
    Task<bool> DeleteAsync(int companyId, int followUpId);
    Task<(int Overdue, int Today)> CountsAsync(int companyId, int? onlyUserId, int tzOffsetMinutes);
}

public class FollowUpRepository : IFollowUpRepository
{
    private readonly IDbConnectionFactory _factory;
    public FollowUpRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT f.*, l.lead_seq, l.customer_id, l.status AS lead_status,
               c.customer_name, c.whatsapp_name, c.mobile_no, c.email,
               p.ref_seq AS property_seq, p.title AS property_title,
               u.full_name AS assigned_to_name, d.full_name AS done_by_name
        FROM wsm_follow_ups f
        JOIN wsm_leads l ON l.lead_id = f.lead_id
        JOIN wsm_customers c ON c.customer_id = l.customer_id
        LEFT JOIN wsm_properties p ON p.property_id = f.property_id
        LEFT JOIN wsm_users u ON u.user_id = f.assigned_to
        LEFT JOIN wsm_users d ON d.user_id = f.done_by";

    // tzOffsetMinutes is JavaScript's getTimezoneOffset(): UTC minus local, e.g. -240 for Dubai.
    // Overdue = before now, so "today" is what is still due between now and local midnight.
    private static DateTime EndOfTodayUtc(int tzOffsetMinutes)
    {
        var offset = TimeSpan.FromMinutes(Math.Clamp(tzOffsetMinutes, -840, 840));
        return (DateTime.UtcNow - offset).Date.AddDays(1) + offset;
    }

    public async Task<IEnumerable<FollowUpRow>> GetListAsync(int companyId, int? onlyUserId, string view, int tzOffsetMinutes, int? assignedTo)
    {
        var end = EndOfTodayUtc(tzOffsetMinutes);
        var where = view switch
        {
            "overdue" => "f.is_done = 'F' AND f.due_at < @now",
            "today" => "f.is_done = 'F' AND f.due_at >= @now AND f.due_at < @end",
            "upcoming" => "f.is_done = 'F' AND f.due_at >= @end",
            _ => "f.is_done = 'T'"
        };
        var order = view == "done" ? "f.done_at DESC" : "f.due_at";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<FollowUpRow>(Select + $@"
            WHERE f.company_id = @companyId AND {where}
              AND (@onlyUserId IS NULL OR f.assigned_to = @onlyUserId)
              AND (@assignedTo IS NULL OR f.assigned_to = @assignedTo)
              {(view == "done" ? "AND f.done_at >= utc_now() - interval '30 days'" : "")}
            ORDER BY {order}",
            new { companyId, onlyUserId, assignedTo, now = DateTime.UtcNow, end });
    }

    public async Task<IEnumerable<FollowUpRow>> GetForLeadAsync(int companyId, int leadId)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<FollowUpRow>(Select + @"
            WHERE f.company_id = @companyId AND f.lead_id = @leadId
            ORDER BY f.is_done, CASE WHEN f.is_done = 'F' THEN f.due_at END, f.done_at DESC", new { companyId, leadId });
    }

    public async Task<FollowUpRow?> GetByIdAsync(int companyId, int followUpId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<FollowUpRow>(
            Select + " WHERE f.company_id = @companyId AND f.follow_up_id = @followUpId", new { companyId, followUpId });
    }

    public async Task<FollowUpRow?> CreateAsync(int companyId, int leadId, int? assignedTo, SaveFollowUpDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            WITH ins AS (
                INSERT INTO wsm_follow_ups (company_id, lead_id, follow_up_type, due_at, notes, property_id, assigned_to, created_by)
                VALUES (@companyId, @leadId, @FollowUpType, @dueAt, @Notes, @PropertyId, @assignedTo, @userId)
                RETURNING follow_up_id),
            upd AS (UPDATE wsm_leads SET updated_at = utc_now() WHERE lead_id = @leadId RETURNING lead_id)
            SELECT follow_up_id FROM ins",
            new
            {
                companyId, leadId, assignedTo, userId, dto.FollowUpType, dto.PropertyId,
                dueAt = dto.DueAt.ToUniversalTime(),
                Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim()
            });
        return await GetByIdAsync(companyId, id);
    }

    // Completing a follow-up records what happened on the lead's timeline.
    public async Task CompleteAsync(int companyId, FollowUpRow f, string? result, int userId)
    {
        var activity = f.FollowUpType switch { "CALL" => "CALL", "MEETING" => "MEETING", "VIEWING" => "VIEWING", _ => "NOTE" };
        var label = f.FollowUpType switch
        {
            "WHATSAPP" => "WhatsApp follow-up done", "EMAIL" => "Email follow-up done", _ => null
        };
        var body = string.Join(": ", new[] { label, string.IsNullOrWhiteSpace(result) ? null : result.Trim() }.Where(s => s is not null));

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            WITH done AS (
                UPDATE wsm_follow_ups SET is_done = 'T', done_at = utc_now(), done_by = @userId
                WHERE company_id = @companyId AND follow_up_id = @FollowUpId AND is_done = 'F'
                RETURNING follow_up_id),
            act AS (
                INSERT INTO wsm_lead_activities (company_id, lead_id, activity_type, body, property_id, created_by)
                SELECT @companyId, @LeadId, @activity, NULLIF(@body, ''), @PropertyId, @userId FROM done
                RETURNING activity_id)
            UPDATE wsm_leads SET updated_at = utc_now() WHERE lead_id = @LeadId AND EXISTS (SELECT 1 FROM done)",
            new { companyId, userId, f.FollowUpId, f.LeadId, f.PropertyId, activity, body });
    }

    public async Task<bool> DeleteAsync(int companyId, int followUpId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync("DELETE FROM wsm_follow_ups WHERE company_id = @companyId AND follow_up_id = @followUpId",
            new { companyId, followUpId }) > 0;
    }

    public async Task<(int Overdue, int Today)> CountsAsync(int companyId, int? onlyUserId, int tzOffsetMinutes)
    {
        var end = EndOfTodayUtc(tzOffsetMinutes);
        using var db = _factory.CreateConnection();
        var row = await db.QuerySingleAsync<(int, int)>(@"
            SELECT COALESCE(SUM(CASE WHEN due_at < @now THEN 1 ELSE 0 END), 0)::int,
                   COALESCE(SUM(CASE WHEN due_at >= @now AND due_at < @end THEN 1 ELSE 0 END), 0)::int
            FROM wsm_follow_ups
            WHERE company_id = @companyId AND is_done = 'F' AND (@onlyUserId IS NULL OR assigned_to = @onlyUserId)",
            new { companyId, onlyUserId, now = DateTime.UtcNow, end });
        return row;
    }
}
