using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public class LeadFilter
{
    public string? Search { get; set; }
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public string? Source { get; set; }
    public int? AssignedTo { get; set; }
    public string? View { get; set; }        // open / closed / unassigned / overdue / cold
    public int? CustomerId { get; set; }
}

public interface ILeadRepository
{
    // onlyUserId: when set (staff), restricts results to leads assigned to that user.
    Task<IEnumerable<LeadRow>> GetAllAsync(int companyId, int? onlyUserId, LeadFilter f);
    Task<IEnumerable<LeadStatusCount>> StatusCountsAsync(int companyId, int? onlyUserId);
    Task<LeadRow?> GetByIdAsync(int companyId, int leadId);
    // userId is null when the WhatsApp bot or the mailbox creates the lead.
    Task<LeadRow?> CreateAsync(int companyId, int customerId, SaveLeadDto dto, int? userId);
    Task<LeadRow?> UpdateAsync(int companyId, int leadId, SaveLeadDto dto);
    Task AssignAsync(int companyId, int leadId, int? toUserId, int byUserId);
    Task SetStatusAsync(int companyId, int leadId, SetLeadStatusDto dto, int userId);
    Task<bool> DeleteAsync(int companyId, int leadId);
    Task<IEnumerable<TimelineRow>> TimelineAsync(int companyId, int leadId, int customerId);
    Task AddActivityAsync(int companyId, int leadId, AddActivityDto dto, int userId);
    Task<bool> HasOpenLeadAsync(int companyId, int customerId);
    Task AddSharesAsync(int companyId, int leadId, IEnumerable<PropertyRow> properties, string channel, int userId);
    Task UpdateFromBotAsync(int leadId, string? communities, string? emirate, decimal? budgetMax, string? requirements);
}

public class LeadRepository : ILeadRepository
{
    private readonly IDbConnectionFactory _factory;
    public LeadRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT l.*, c.customer_name, c.whatsapp_name, c.mobile_no, c.email,
               u.full_name AS assigned_to_name, p.ref_seq AS won_property_seq, p.title AS won_property_title,
               (SELECT MIN(f.due_at) FROM dbo.wsm_follow_ups f WHERE f.lead_id = l.lead_id AND f.is_done = 'F') AS next_follow_up_at,
               (SELECT MAX(a.created_at) FROM dbo.wsm_lead_activities a WHERE a.lead_id = l.lead_id) AS last_activity_at
        FROM dbo.wsm_leads l
        JOIN dbo.wsm_customers c ON c.customer_id = l.customer_id
        LEFT JOIN dbo.wsm_users u ON u.user_id = l.assigned_to
        LEFT JOIN dbo.wsm_properties p ON p.property_id = l.won_property_id";

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public async Task<IEnumerable<LeadRow>> GetAllAsync(int companyId, int? onlyUserId, LeadFilter f)
    {
        using var db = _factory.CreateConnection();
        var search = Blank(f.Search);
        int? leadSeq = search is not null && int.TryParse(search.ToUpperInvariant().Replace("LD-", ""), out var n) ? n : null;
        return await db.QueryAsync<LeadRow>(Select + @"
            WHERE l.company_id = @companyId
              AND (@onlyUserId IS NULL OR l.assigned_to = @onlyUserId)
              AND (@customerId IS NULL OR l.customer_id = @customerId)
              AND (@status IS NULL OR l.status = @status)
              AND (@priority IS NULL OR l.priority = @priority)
              AND (@source IS NULL OR l.source = @source)
              AND (@assignedTo IS NULL OR l.assigned_to = @assignedTo)
              AND (@view IS NULL
                   OR (@view = 'open' AND l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST'))
                   OR (@view = 'closed' AND l.status IN ('WON', 'NOT_INTERESTED', 'LOST'))
                   OR (@view = 'unassigned' AND l.assigned_to IS NULL)
                   OR (@view = 'cold' AND l.status NOT IN ('WON', 'NOT_INTERESTED', 'LOST')
                       AND l.updated_at < DATEADD(DAY, -7, SYSUTCDATETIME())
                       AND NOT EXISTS (SELECT 1 FROM dbo.wsm_follow_ups f WHERE f.lead_id = l.lead_id AND f.is_done = 'F'))
                   OR (@view = 'overdue' AND EXISTS (SELECT 1 FROM dbo.wsm_follow_ups f
                        WHERE f.lead_id = l.lead_id AND f.is_done = 'F' AND f.due_at < SYSUTCDATETIME())))
              AND (@search IS NULL OR l.lead_seq = @leadSeq
                   OR c.customer_name LIKE '%' + @search + '%' OR c.whatsapp_name LIKE '%' + @search + '%'
                   OR c.mobile_no LIKE '%' + @search + '%' OR c.email LIKE '%' + @search + '%'
                   OR l.communities LIKE '%' + @search + '%' OR l.requirements LIKE '%' + @search + '%')
            ORDER BY l.updated_at DESC",
            new
            {
                companyId, onlyUserId, search, leadSeq, f.CustomerId, f.AssignedTo,
                status = Blank(f.Status), priority = Blank(f.Priority), source = Blank(f.Source), view = Blank(f.View)
            });
    }

    public async Task<IEnumerable<LeadStatusCount>> StatusCountsAsync(int companyId, int? onlyUserId)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<LeadStatusCount>(@"
            SELECT status, COUNT(*) AS leads FROM dbo.wsm_leads
            WHERE company_id = @companyId AND (@onlyUserId IS NULL OR assigned_to = @onlyUserId)
            GROUP BY status", new { companyId, onlyUserId });
    }

    public async Task<LeadRow?> GetByIdAsync(int companyId, int leadId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<LeadRow>(
            Select + " WHERE l.company_id = @companyId AND l.lead_id = @leadId", new { companyId, leadId });
    }

    private const string RequirementColumns = @"
        source = @Source, purpose = @Purpose, property_type = @PropertyType, emirate = @Emirate, communities = @Communities,
        bedrooms_min = @BedroomsMin, bedrooms_max = @BedroomsMax, budget_min = @BudgetMin, budget_max = @BudgetMax,
        finance = @Finance, down_payment_max = @DownPaymentMax, monthly_emi_max = @MonthlyEmiMax, buy_plan = @BuyPlan,
        min_amenities = @MinAmenities, completion = @Completion, move_timeline = @MoveTimeline, nationality = @Nationality,
        buyer_type = @BuyerType, requirements = @Requirements, priority = @Priority";

    private static DynamicParameters Params(SaveLeadDto dto, object extra)
    {
        var p = new DynamicParameters(dto);
        p.AddDynamicParams(extra);
        return p;
    }

    public async Task<LeadRow?> CreateAsync(int companyId, int customerId, SaveLeadDto dto, int? userId)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_leads (company_id, lead_seq, customer_id, source, purpose, created_by)
            SELECT @companyId, ISNULL(MAX(lead_seq), 0) + 1, @customerId, @Source, @Purpose, @userId
            FROM dbo.wsm_leads WITH (UPDLOCK, HOLDLOCK) WHERE company_id = @companyId;
            DECLARE @id INT = CAST(SCOPE_IDENTITY() AS INT);
            INSERT INTO dbo.wsm_lead_activities (company_id, lead_id, activity_type, created_by)
            VALUES (@companyId, @id, 'CREATED', @userId);
            SELECT @id;",
            new { companyId, customerId, userId, dto.Source, dto.Purpose });
        await db.ExecuteAsync($"UPDATE dbo.wsm_leads SET {RequirementColumns} WHERE lead_id = @id", Params(dto, new { id }));
        return await GetByIdAsync(companyId, id);
    }

    public async Task<LeadRow?> UpdateAsync(int companyId, int leadId, SaveLeadDto dto)
    {
        using var db = _factory.CreateConnection();
        var n = await db.ExecuteAsync($@"
            UPDATE dbo.wsm_leads SET {RequirementColumns}, updated_at = SYSUTCDATETIME()
            WHERE company_id = @companyId AND lead_id = @leadId", Params(dto, new { companyId, leadId }));
        return n == 0 ? null : await GetByIdAsync(companyId, leadId);
    }

    public async Task AssignAsync(int companyId, int leadId, int? toUserId, int byUserId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            DECLARE @from INT = (SELECT assigned_to FROM dbo.wsm_leads WHERE company_id = @companyId AND lead_id = @leadId);
            IF ISNULL(@from, 0) <> ISNULL(@toUserId, 0)
            BEGIN
                UPDATE dbo.wsm_leads
                SET assigned_to = @toUserId, assigned_at = CASE WHEN @toUserId IS NULL THEN NULL ELSE SYSUTCDATETIME() END,
                    updated_at = SYSUTCDATETIME()
                WHERE company_id = @companyId AND lead_id = @leadId;

                -- Open follow-ups move with the lead.
                UPDATE dbo.wsm_follow_ups SET assigned_to = @toUserId
                WHERE company_id = @companyId AND lead_id = @leadId AND is_done = 'F';

                INSERT INTO dbo.wsm_lead_activities (company_id, lead_id, activity_type, body, created_by)
                VALUES (@companyId, @leadId, 'ASSIGN',
                        ISNULL((SELECT full_name FROM dbo.wsm_users WHERE user_id = @toUserId), 'Unassigned'), @byUserId);
            END", new { companyId, leadId, toUserId, byUserId });
    }

    public async Task SetStatusAsync(int companyId, int leadId, SetLeadStatusDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            DECLARE @from VARCHAR(20) = (SELECT status FROM dbo.wsm_leads WHERE company_id = @companyId AND lead_id = @leadId);
            DECLARE @closed BIT = CASE WHEN @Status IN ('WON', 'NOT_INTERESTED', 'LOST') THEN 1 ELSE 0 END;

            UPDATE dbo.wsm_leads
            SET status = @Status,
                lost_reason = CASE WHEN @Status IN ('NOT_INTERESTED', 'LOST') THEN @LostReason END,
                won_property_id = CASE WHEN @Status = 'WON' THEN @WonPropertyId END,
                deal_value = CASE WHEN @Status = 'WON' THEN @DealValue END,
                commission_amount = CASE WHEN @Status = 'WON' THEN @CommissionAmount END,
                closed_at = CASE WHEN @closed = 0 THEN NULL
                                 WHEN @from IN ('WON', 'NOT_INTERESTED', 'LOST') THEN ISNULL(closed_at, SYSUTCDATETIME())
                                 ELSE SYSUTCDATETIME() END,
                updated_at = SYSUTCDATETIME()
            WHERE company_id = @companyId AND lead_id = @leadId;

            INSERT INTO dbo.wsm_lead_activities (company_id, lead_id, activity_type, body, status_from, status_to, property_id, created_by)
            VALUES (@companyId, @leadId, 'STATUS', @Note, @from, @Status, CASE WHEN @Status = 'WON' THEN @WonPropertyId END, @userId);",
            new
            {
                companyId, leadId, userId, dto.Status, dto.LostReason, dto.WonPropertyId, dto.DealValue, dto.CommissionAmount,
                Note = Blank(dto.Note)
            });
    }

    public async Task<bool> DeleteAsync(int companyId, int leadId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync("DELETE FROM dbo.wsm_leads WHERE company_id = @companyId AND lead_id = @leadId",
            new { companyId, leadId }) > 0;
    }

    public async Task<IEnumerable<TimelineRow>> TimelineAsync(int companyId, int leadId, int customerId)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<TimelineRow>(@"
            SELECT 'ACTIVITY' AS kind, a.activity_id AS id, a.activity_type, CAST(NULL AS VARCHAR(3)) AS direction,
                   CAST(NULL AS NVARCHAR(500)) AS subject, CAST(a.body AS NVARCHAR(MAX)) AS body, a.outcome,
                   a.status_from, a.status_to, a.property_id, p.ref_seq AS property_seq, p.title AS property_title,
                   u.full_name AS by_name, a.created_at
            FROM dbo.wsm_lead_activities a
            LEFT JOIN dbo.wsm_properties p ON p.property_id = a.property_id
            LEFT JOIN dbo.wsm_users u ON u.user_id = a.created_by
            WHERE a.company_id = @companyId AND a.lead_id = @leadId
            UNION ALL
            SELECT 'WHATSAPP', m.message_id, m.msg_type, m.direction, NULL, m.body, NULL, NULL, NULL, NULL, NULL, NULL,
                   CASE WHEN m.is_bot = 'T' THEN 'Bot' ELSE u.full_name END, m.created_at
            FROM dbo.wsm_messages m
            LEFT JOIN dbo.wsm_users u ON u.user_id = m.sent_by
            WHERE m.company_id = @companyId AND m.customer_id = @customerId
            UNION ALL
            SELECT 'EMAIL', e.email_id, NULL, e.direction, e.subject, LEFT(e.body, 1000), NULL, NULL, NULL, NULL, NULL, NULL,
                   u.full_name, e.created_at
            FROM dbo.wsm_emails e
            LEFT JOIN dbo.wsm_users u ON u.user_id = e.sent_by
            WHERE e.company_id = @companyId AND e.customer_id = @customerId
            ORDER BY created_at DESC", new { companyId, leadId, customerId });
    }

    public async Task AddSharesAsync(int companyId, int leadId, IEnumerable<PropertyRow> properties, string channel, int userId)
    {
        var list = properties.ToList();
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            INSERT INTO dbo.wsm_lead_shares (company_id, lead_id, property_id, channel, shared_by)
            VALUES (@companyId, @leadId, @PropertyId, @channel, @userId)",
            list.Select(p => new { companyId, leadId, p.PropertyId, channel, userId }));
        await db.ExecuteAsync(@"
            INSERT INTO dbo.wsm_lead_activities (company_id, lead_id, activity_type, body, property_id, created_by)
            VALUES (@companyId, @leadId, 'SHARE', @body, @propertyId, @userId);
            UPDATE dbo.wsm_leads SET updated_at = SYSUTCDATETIME() WHERE lead_id = @leadId;",
            new
            {
                companyId, leadId, userId,
                body = $"{(channel == "EMAIL" ? "Email" : "WhatsApp")}: " + string.Join(", ", list.Select(p => $"{p.RefNo} {p.Title}")),
                propertyId = list.Count == 1 ? list[0].PropertyId : (int?)null
            });
    }

    public async Task UpdateFromBotAsync(int leadId, string? communities, string? emirate, decimal? budgetMax, string? requirements)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            UPDATE dbo.wsm_leads
            SET communities = ISNULL(@communities, communities), emirate = ISNULL(@emirate, emirate),
                budget_max = ISNULL(@budgetMax, budget_max),
                requirements = CASE WHEN @requirements IS NULL THEN requirements
                                    WHEN requirements IS NULL THEN @requirements
                                    ELSE LEFT(requirements + CHAR(10) + @requirements, 2000) END,
                updated_at = SYSUTCDATETIME()
            WHERE lead_id = @leadId", new { leadId, communities, emirate, budgetMax, requirements });
    }

    public async Task<bool> HasOpenLeadAsync(int companyId, int customerId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM dbo.wsm_leads
            WHERE company_id = @companyId AND customer_id = @customerId AND status NOT IN ('WON', 'NOT_INTERESTED', 'LOST')",
            new { companyId, customerId }) > 0;
    }

    public async Task AddActivityAsync(int companyId, int leadId, AddActivityDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            INSERT INTO dbo.wsm_lead_activities (company_id, lead_id, activity_type, body, outcome, property_id, created_by)
            VALUES (@companyId, @leadId, @ActivityType, @Body, @Outcome, @PropertyId, @userId);
            UPDATE dbo.wsm_leads SET updated_at = SYSUTCDATETIME() WHERE lead_id = @leadId;",
            new
            {
                companyId, leadId, userId, dto.ActivityType, Body = Blank(dto.Body),
                Outcome = dto.ActivityType == "CALL" ? dto.Outcome : null,
                PropertyId = dto.ActivityType == "VIEWING" ? dto.PropertyId : null
            });
    }
}
