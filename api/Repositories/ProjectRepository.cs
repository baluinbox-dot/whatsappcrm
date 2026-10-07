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
               (SELECT COUNT(*) FROM dbo.wsm_properties p WHERE p.project_id = pr.project_id) AS property_count,
               (SELECT MIN(p.price) FROM dbo.wsm_properties p WHERE p.project_id = pr.project_id AND p.purpose = 'SALE') AS min_price,
               (SELECT MAX(p.price) FROM dbo.wsm_properties p WHERE p.project_id = pr.project_id AND p.purpose = 'SALE') AS max_price
        FROM dbo.wsm_projects pr";

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
                   OR pr.project_name LIKE '%' + @search + '%' OR pr.community LIKE '%' + @search + '%'
                   OR pr.developer LIKE '%' + @search + '%')
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
            "SELECT step_no, label, percent_due, due_note FROM dbo.wsm_project_payments WHERE project_id = @projectId ORDER BY step_no",
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
        UPDATE p SET p.emirate = pr.emirate, p.community = pr.community, p.sub_community = pr.project_name,
                     p.developer = pr.developer, p.map_url = pr.map_url, p.completion = pr.completion,
                     p.handover_date = pr.handover_date, p.completion_pct = pr.completion_pct, p.payment_plan = pr.payment_plan
        FROM dbo.wsm_properties p
        JOIN dbo.wsm_projects pr ON pr.project_id = p.project_id";

    public async Task<ProjectRow> CreateAsync(int companyId, SaveProjectDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        db.Open();
        using var tx = db.BeginTransaction();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_projects (company_id, project_seq, project_name, emirate, created_by)
            SELECT @companyId, ISNULL(MAX(project_seq), 0) + 1, @ProjectName, @Emirate, @userId
            FROM dbo.wsm_projects WITH (UPDLOCK, HOLDLOCK) WHERE company_id = @companyId;
            SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new { companyId, userId, dto.ProjectName, dto.Emirate }, tx);
        await db.ExecuteAsync($"UPDATE dbo.wsm_projects SET {Columns} WHERE project_id = @id", Params(dto, new { id }), tx);
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
            UPDATE dbo.wsm_projects SET {Columns}, updated_at = SYSUTCDATETIME()
            WHERE company_id = @companyId AND project_id = @projectId",
            Params(dto, new { companyId, projectId }), tx);
        if (n == 0) return null;
        await SavePaymentsAsync(db, tx, projectId, dto);
        await db.ExecuteAsync(SyncProperties + " WHERE pr.project_id = @projectId", new { projectId }, tx);
        tx.Commit();
        return await GetByIdAsync(companyId, projectId);
    }

    public async Task<bool> DeleteAsync(int companyId, int projectId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(@"
            UPDATE dbo.wsm_properties SET project_id = NULL WHERE company_id = @companyId AND project_id = @projectId;
            DELETE FROM dbo.wsm_projects WHERE company_id = @companyId AND project_id = @projectId;",
            new { companyId, projectId }) > 0;
    }

    private static async Task SavePaymentsAsync(System.Data.IDbConnection db, System.Data.IDbTransaction tx, int projectId, SaveProjectDto dto)
    {
        await db.ExecuteAsync("DELETE FROM dbo.wsm_project_payments WHERE project_id = @projectId", new { projectId }, tx);
        var step = 0;
        await db.ExecuteAsync(@"
            INSERT INTO dbo.wsm_project_payments (project_id, step_no, label, percent_due, due_note)
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
