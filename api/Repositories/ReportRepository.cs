using Dapper;
using WhatsAppCrm.Api.Data;

namespace WhatsAppCrm.Api.Repositories;

public class ReportSummary
{
    public int NewLeads { get; set; }
    public int NewLeadsWon { get; set; }
    public int DealsWon { get; set; }
    public int DealsLost { get; set; }
    public decimal DealValue { get; set; }
    public decimal Commission { get; set; }
    public int OpenLeads { get; set; }
    public int OverdueFollowUps { get; set; }
}

public class ReportCount
{
    public string Key { get; set; } = string.Empty;
    public int Leads { get; set; }
    public int Won { get; set; }
}

public class ReportAgentRow
{
    public int? UserId { get; set; }
    public string? FullName { get; set; }
    public int Leads { get; set; }
    public int Open { get; set; }
    public int Won { get; set; }
    public int Lost { get; set; }
    public int DealsWon { get; set; }
    public decimal DealValue { get; set; }
    public decimal Commission { get; set; }
    public int FollowUpsDone { get; set; }
    public int OverdueFollowUps { get; set; }
}

public class ReportDay
{
    public DateTime Day { get; set; }
    public int Leads { get; set; }
}

public class LeadReport
{
    public ReportSummary Summary { get; set; } = new();
    public IEnumerable<ReportCount> ByStatus { get; set; } = Enumerable.Empty<ReportCount>();
    public IEnumerable<ReportCount> BySource { get; set; } = Enumerable.Empty<ReportCount>();
    public IEnumerable<ReportAgentRow> ByAgent { get; set; } = Enumerable.Empty<ReportAgentRow>();
    public IEnumerable<ReportDay> ByDay { get; set; } = Enumerable.Empty<ReportDay>();
}

public interface IReportRepository
{
    // fromUtc / toUtc: the period's boundaries (end exclusive). agentId: one agent's leads (staff always see only theirs).
    Task<LeadReport> LeadsAsync(int companyId, DateTime fromUtc, DateTime toUtc, int tzOffsetMinutes, int? agentId);
}

// "New" figures count leads created in the period; "deals" count leads closed (Won / Lost) in the period.
public class ReportRepository : IReportRepository
{
    private readonly IDbConnectionFactory _factory;
    public ReportRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<LeadReport> LeadsAsync(int companyId, DateTime fromUtc, DateTime toUtc, int tzOffsetMinutes, int? agentId)
    {
        const string created = "l.company_id = @companyId AND l.created_at >= @fromUtc AND l.created_at < @toUtc AND (@agentId IS NULL OR l.assigned_to = @agentId)";
        const string closed = "l.company_id = @companyId AND l.closed_at >= @fromUtc AND l.closed_at < @toUtc AND (@agentId IS NULL OR l.assigned_to = @agentId)";
        var sql = $@"
            SELECT
                (SELECT COUNT(*) FROM dbo.wsm_leads l WHERE {created}) AS new_leads,
                (SELECT COUNT(*) FROM dbo.wsm_leads l WHERE {created} AND l.status = 'WON') AS new_leads_won,
                (SELECT COUNT(*) FROM dbo.wsm_leads l WHERE {closed} AND l.status = 'WON') AS deals_won,
                (SELECT COUNT(*) FROM dbo.wsm_leads l WHERE {closed} AND l.status IN ('LOST', 'NOT_INTERESTED')) AS deals_lost,
                (SELECT ISNULL(SUM(l.deal_value), 0) FROM dbo.wsm_leads l WHERE {closed} AND l.status = 'WON') AS deal_value,
                (SELECT ISNULL(SUM(l.commission_amount), 0) FROM dbo.wsm_leads l WHERE {closed} AND l.status = 'WON') AS commission,
                (SELECT COUNT(*) FROM dbo.wsm_leads l WHERE l.company_id = @companyId AND (@agentId IS NULL OR l.assigned_to = @agentId)
                    AND l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST')) AS open_leads,
                (SELECT COUNT(*) FROM dbo.wsm_follow_ups f WHERE f.company_id = @companyId AND f.is_done = 'F' AND f.due_at < SYSUTCDATETIME()
                    AND (@agentId IS NULL OR f.assigned_to = @agentId)) AS overdue_follow_ups;

            SELECT l.status AS [key], COUNT(*) AS leads, 0 AS won FROM dbo.wsm_leads l WHERE {created} GROUP BY l.status;

            SELECT l.source AS [key], COUNT(*) AS leads, SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END) AS won
            FROM dbo.wsm_leads l WHERE {created} GROUP BY l.source ORDER BY COUNT(*) DESC;

            SELECT l.assigned_to AS user_id, COUNT(*) AS leads,
                   SUM(CASE WHEN l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST') THEN 1 ELSE 0 END) AS [open],
                   SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END) AS won,
                   SUM(CASE WHEN l.status IN ('LOST', 'NOT_INTERESTED') THEN 1 ELSE 0 END) AS lost
            FROM dbo.wsm_leads l WHERE {created} GROUP BY l.assigned_to;

            SELECT l.assigned_to AS user_id, COUNT(*) AS deals_won, ISNULL(SUM(l.deal_value), 0) AS deal_value,
                   ISNULL(SUM(l.commission_amount), 0) AS commission
            FROM dbo.wsm_leads l WHERE {closed} AND l.status = 'WON' GROUP BY l.assigned_to;

            SELECT f.assigned_to AS user_id,
                   SUM(CASE WHEN f.is_done = 'T' AND f.done_at >= @fromUtc AND f.done_at < @toUtc THEN 1 ELSE 0 END) AS follow_ups_done,
                   SUM(CASE WHEN f.is_done = 'F' AND f.due_at < SYSUTCDATETIME() THEN 1 ELSE 0 END) AS overdue_follow_ups
            FROM dbo.wsm_follow_ups f
            WHERE f.company_id = @companyId AND (@agentId IS NULL OR f.assigned_to = @agentId)
            GROUP BY f.assigned_to;

            SELECT user_id, full_name FROM dbo.wsm_users WHERE company_id = @companyId;

            SELECT CAST(DATEADD(MINUTE, -@tzOffsetMinutes, l.created_at) AS DATE) AS day, COUNT(*) AS leads
            FROM dbo.wsm_leads l WHERE {created}
            GROUP BY CAST(DATEADD(MINUTE, -@tzOffsetMinutes, l.created_at) AS DATE) ORDER BY day;";

        using var db = _factory.CreateConnection();
        using var grid = await db.QueryMultipleAsync(sql, new { companyId, fromUtc, toUtc, tzOffsetMinutes, agentId });
        var report = new LeadReport
        {
            Summary = await grid.ReadSingleAsync<ReportSummary>(),
            ByStatus = (await grid.ReadAsync<ReportCount>()).ToList(),
            BySource = (await grid.ReadAsync<ReportCount>()).ToList(),
        };
        var created_ = (await grid.ReadAsync<ReportAgentRow>()).ToDictionary(r => r.UserId ?? 0);
        var deals = (await grid.ReadAsync<ReportAgentRow>()).ToList();
        var followUps = (await grid.ReadAsync<ReportAgentRow>()).ToList();
        var names = (await grid.ReadAsync<(int UserId, string FullName)>()).ToDictionary(u => u.UserId, u => u.FullName);
        report.ByDay = (await grid.ReadAsync<ReportDay>()).ToList();

        // One row per agent (0 = unassigned) across the three agent queries.
        ReportAgentRow Row(int? userId) =>
            created_.TryGetValue(userId ?? 0, out var r) ? r : created_[userId ?? 0] = new ReportAgentRow { UserId = userId };
        foreach (var d in deals) { var r = Row(d.UserId); r.DealsWon = d.DealsWon; r.DealValue = d.DealValue; r.Commission = d.Commission; }
        foreach (var f in followUps) { var r = Row(f.UserId); r.FollowUpsDone = f.FollowUpsDone; r.OverdueFollowUps = f.OverdueFollowUps; }
        foreach (var r in created_.Values)
            r.FullName = r.UserId is null ? null : names.GetValueOrDefault(r.UserId.Value);
        report.ByAgent = created_.Values
            .Where(r => r.Leads + r.DealsWon + r.FollowUpsDone + r.OverdueFollowUps > 0)
            .OrderByDescending(r => r.DealValue).ThenByDescending(r => r.Won).ThenByDescending(r => r.Leads)
            .ToList();
        return report;
    }
}
