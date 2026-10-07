using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public class ProjectFilter
{
    public string? Search { get; set; }
    public string? Emirate { get; set; }
    public string? Completion { get; set; }
}

public interface IProjectRepository
{
    Task<IEnumerable<ProjectRow>> GetAllAsync(int companyId, ProjectFilter f);
    Task<ProjectRow?> GetByIdAsync(int companyId, int projectId);
    Task<ProjectRow> CreateAsync(int companyId, SaveProjectDto dto, int userId);
    Task<ProjectRow?> UpdateAsync(int companyId, int projectId, SaveProjectDto dto);
    Task<bool> DeleteAsync(int companyId, int projectId);
}

public class ProjectRepository : IProjectRepository
{
    private readonly IDbConnectionFactory _factory;
    public ProjectRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT pr.*,
               (SELECT COUNT(*)::int FROM wsm_properties p WHERE p.project_id = pr.project_id) AS property_count,
               (SELECT MIN(p.price) FROM wsm_properties p WHERE p.project_id = pr.project_id AND p.purpose = 'SALE') AS min_price,
               (SELECT MAX(p.price) FROM wsm_properties p WHERE p.project_id = pr.project_id AND p.purpose = 'SALE') AS max_price
        FROM wsm_projects pr";

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public async Task<IEnumerable<ProjectRow>> GetAllAsync(int companyId, ProjectFilter f)
    {
        using var db = _factory.CreateConnection();
        var search = Blank(f.Search);
        int? seq = search is not null && int.TryParse(search.ToUpperInvariant().Replace("PRJ-", ""), out var n) ? n : null;
        return await db.QueryAsync<ProjectRow>(Select + @"
            WHERE pr.company_id = @companyId
              AND (@emirate IS NULL OR pr.emirate = @emirate)
              AND (@completion IS NULL OR pr.completion = @completion)
              AND (@search IS NULL OR pr.project_seq = @seq
                   OR pr.project_name ILIKE '%' || @search || '%' OR pr.community ILIKE '%' || @search || '%'
                   OR pr.developer ILIKE '%' || @search || '%')
            ORDER BY pr.updated_at DESC",
            new { companyId, search, seq, emirate = Blank(f.Emirate), completion = Blank(f.Completion) });
    }

    public async Task<ProjectRow?> GetByIdAsync(int companyId, int projectId)
    {
        using var db = _factory.CreateConnection();
        var row = await db.QuerySingleOrDefaultAsync<ProjectRow>(
            Select + " WHERE pr.company_id = @companyId AND pr.project_id = @projectId", new { companyId, projectId });
        if (row is null) return null;
        row.Payments = (await db.QueryAsync<ProjectPaymentRow>(
            "SELECT step_no, label, percent_due, due_note FROM wsm_project_payments WHERE project_id = @projectId ORDER BY step_no",
            new { projectId })).ToList();
        return row;
    }

    private const string Columns = @"
        project_name = @ProjectName, description = @Description, project_type = @ProjectType, developer = @Developer,
        emirate = @Emirate, community = @Community, map_url = @MapUrl, completion = @Completion,
        handover_date = @HandoverDate, completion_pct = @CompletionPct, amenities = @Amenities,
        down_payment_pct = @DownPaymentPct, payment_plan = @PaymentPlan, is_active = @IsActive";

    // Keeps the properties of a project in step with it, so searching and matching can read the property row alone.
    public const string SyncProperties = @"
        UPDATE wsm_properties p SET emirate = pr.emirate, community = pr.community, sub_community = pr.project_name,
                     developer = pr.developer, map_url = pr.map_url, completion = pr.completion,
                     handover_date = pr.handover_date, completion_pct = pr.completion_pct, payment_plan = pr.payment_plan
        FROM wsm_projects pr
        WHERE pr.project_id = p.project_id";

    public async Task<ProjectRow> CreateAsync(int companyId, SaveProjectDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        db.Open();
        using var tx = db.BeginTransaction();
        await PgSql.LockAsync(db, tx, "wsm_projects", companyId);
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO wsm_projects (company_id, project_seq, project_name, emirate, created_by)
            SELECT @companyId, COALESCE(MAX(project_seq), 0) + 1, @ProjectName, @Emirate, @userId
            FROM wsm_projects WHERE company_id = @companyId
            RETURNING project_id",
            new { companyId, userId, dto.ProjectName, dto.Emirate }, tx);
        await db.ExecuteAsync($"UPDATE wsm_projects SET {Columns} WHERE project_id = @id", Params(dto, new { id }), tx);
        await SavePaymentsAsync(db, tx, id, dto);
        tx.Commit();
        return (await GetByIdAsync(companyId, id))!;
    }

    public async Task<ProjectRow?> UpdateAsync(int companyId, int projectId, SaveProjectDto dto)
    {
        using var db = _factory.CreateConnection();
        db.Open();
        using var tx = db.BeginTransaction();
        var n = await db.ExecuteAsync($@"
            UPDATE wsm_projects SET {Columns}, updated_at = utc_now()
            WHERE company_id = @companyId AND project_id = @projectId",
            Params(dto, new { companyId, projectId }), tx);
        if (n == 0) return null;
        await SavePaymentsAsync(db, tx, projectId, dto);
        await db.ExecuteAsync(SyncProperties + " AND pr.project_id = @projectId", new { projectId }, tx);
        tx.Commit();
        return await GetByIdAsync(companyId, projectId);
    }

    public async Task<bool> DeleteAsync(int companyId, int projectId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(@"
            UPDATE wsm_properties SET project_id = NULL WHERE company_id = @companyId AND project_id = @projectId;
            DELETE FROM wsm_projects WHERE company_id = @companyId AND project_id = @projectId;",
            new { companyId, projectId }) > 0;
    }

    private static async Task SavePaymentsAsync(System.Data.IDbConnection db, System.Data.IDbTransaction tx, int projectId, SaveProjectDto dto)
    {
        await db.ExecuteAsync("DELETE FROM wsm_project_payments WHERE project_id = @projectId", new { projectId }, tx);
        var step = 0;
        await db.ExecuteAsync(@"
            INSERT INTO wsm_project_payments (project_id, step_no, label, percent_due, due_note)
            VALUES (@projectId, @step, @Label, @PercentDue, @DueNote)",
            dto.Payments.Select(p => new { projectId, step = ++step, p.Label, p.PercentDue, p.DueNote }), tx);
    }

    private static DynamicParameters Params(SaveProjectDto dto, object extra)
    {
        var p = new DynamicParameters(dto);
        p.AddDynamicParams(extra);
        return p;
    }
}
