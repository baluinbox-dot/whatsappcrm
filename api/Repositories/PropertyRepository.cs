using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public class PropertyFilter
{
    public string? Search { get; set; }
    public string? Purpose { get; set; }
    public string? PropertyType { get; set; }
    public string? Emirate { get; set; }
    public string? Status { get; set; }
}

public interface IPropertyRepository
{
    Task<IEnumerable<PropertyRow>> GetAllAsync(int companyId, PropertyFilter f);
    Task<PropertyRow?> GetByIdAsync(int companyId, int propertyId);
    Task<PropertyRow?> CreateAsync(int companyId, SavePropertyDto dto, int userId);
    Task<PropertyRow?> UpdateAsync(int companyId, int propertyId, SavePropertyDto dto, int userId);
    Task<IEnumerable<PropertyFileRow>> DeleteAsync(int companyId, int propertyId);
    Task<PropertyFileRow> AddFileAsync(int companyId, int propertyId, PropertyFileRow file);
    Task<PropertyFileRow?> GetFileAsync(int companyId, int fileId);
    Task<bool> DeleteFileAsync(int companyId, int fileId);
    Task<bool> SetCoverAsync(int companyId, int fileId);
    Task<IEnumerable<MatchRow>> MatchAsync(int companyId, LeadRow lead);
    Task<PublicPropertyView?> GetPublicAsync(string publicCode);
}

public class PropertyRepository : IPropertyRepository
{
    private readonly IDbConnectionFactory _factory;
    public PropertyRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT p.*, a.full_name AS agent_name,
               (SELECT TOP 1 f.stored_name FROM dbo.wsm_property_files f
                 WHERE f.property_id = p.property_id AND f.file_kind = 'IMAGE'
                 ORDER BY CASE WHEN f.is_cover = 'T' THEN 0 ELSE 1 END, f.file_id) AS cover_file,
               (SELECT COUNT(*) FROM dbo.wsm_property_files f
                 WHERE f.property_id = p.property_id AND f.file_kind = 'IMAGE') AS image_count
        FROM dbo.wsm_properties p
        LEFT JOIN dbo.wsm_users a ON a.user_id = p.agent_id";

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public async Task<IEnumerable<PropertyRow>> GetAllAsync(int companyId, PropertyFilter f)
    {
        using var db = _factory.CreateConnection();
        var search = Blank(f.Search);
        // "PRP-00012" or "12" finds the reference number too.
        int? refSeq = search is not null && int.TryParse(search.ToUpperInvariant().Replace("PRP-", ""), out var n) ? n : null;
        return await db.QueryAsync<PropertyRow>(Select + @"
            WHERE p.company_id = @companyId
              AND (@purpose IS NULL OR p.purpose = @purpose)
              AND (@type IS NULL OR p.property_type = @type)
              AND (@emirate IS NULL OR p.emirate = @emirate)
              AND (@status IS NULL OR p.status = @status)
              AND (@search IS NULL OR p.ref_seq = @refSeq
                   OR p.title LIKE '%' + @search + '%' OR p.community LIKE '%' + @search + '%'
                   OR p.sub_community LIKE '%' + @search + '%' OR p.developer LIKE '%' + @search + '%'
                   OR p.owner_name LIKE '%' + @search + '%' OR p.owner_mobile LIKE '%' + @search + '%')
            ORDER BY p.updated_at DESC",
            new
            {
                companyId, search, refSeq,
                purpose = Blank(f.Purpose), type = Blank(f.PropertyType),
                emirate = Blank(f.Emirate), status = Blank(f.Status)
            });
    }

    public async Task<PropertyRow?> GetByIdAsync(int companyId, int propertyId)
    {
        using var db = _factory.CreateConnection();
        var row = await db.QuerySingleOrDefaultAsync<PropertyRow>(
            Select + " WHERE p.company_id = @companyId AND p.property_id = @propertyId", new { companyId, propertyId });
        if (row is null) return null;
        row.Files = (await db.QueryAsync<PropertyFileRow>(@"
            SELECT * FROM dbo.wsm_property_files WHERE property_id = @propertyId
            ORDER BY file_kind, CASE WHEN is_cover = 'T' THEN 0 ELSE 1 END, file_id", new { propertyId })).ToList();
        return row;
    }

    private const string Columns = @"
        title = @Title, purpose = @Purpose, property_type = @PropertyType, completion = @Completion, status = @Status,
        emirate = @Emirate, community = @Community, sub_community = @SubCommunity, developer = @Developer, map_url = @MapUrl,
        bedrooms = @Bedrooms, bathrooms = @Bathrooms, bua_sqft = @BuaSqft, plot_sqft = @PlotSqft, parking = @Parking,
        view_type = @ViewType, floor_no = @FloorNo, price = @Price, rent_frequency = @RentFrequency, cheques = @Cheques,
        service_charge = @ServiceCharge, commission_pct = @CommissionPct, handover_date = @HandoverDate,
        payment_plan = @PaymentPlan, completion_pct = @CompletionPct, permit_no = @PermitNo, title_deed_no = @TitleDeedNo,
        owner_name = @OwnerName, owner_mobile = @OwnerMobile, owner_email = @OwnerEmail, furnishing = @Furnishing,
        amenities = @Amenities, description = @Description, is_featured = @IsFeatured, agent_id = @AgentId";

    public async Task<PropertyRow?> CreateAsync(int companyId, SavePropertyDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        // Insert a stub with the next per-company reference number (locked so two saves can't take the same one), then fill it.
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_properties (company_id, ref_seq, public_code, title, purpose, property_type, emirate, price, created_by, updated_by)
            SELECT @companyId, ISNULL(MAX(ref_seq), 0) + 1, @publicCode, @Title, @Purpose, @PropertyType, @Emirate, @Price, @userId, @userId
            FROM dbo.wsm_properties WITH (UPDLOCK, HOLDLOCK) WHERE company_id = @companyId;
            SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new
            {
                companyId, userId, dto.Title, dto.Purpose, dto.PropertyType, dto.Emirate, dto.Price,
                publicCode = Guid.NewGuid().ToString("N")[..12]
            });
        await db.ExecuteAsync($"UPDATE dbo.wsm_properties SET {Columns} WHERE property_id = @id", Params(dto, new { id }));
        return await GetByIdAsync(companyId, id);
    }

    public async Task<PropertyRow?> UpdateAsync(int companyId, int propertyId, SavePropertyDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        var n = await db.ExecuteAsync($@"
            UPDATE dbo.wsm_properties SET {Columns}, updated_by = @userId, updated_at = SYSUTCDATETIME()
            WHERE company_id = @companyId AND property_id = @propertyId",
            Params(dto, new { companyId, propertyId, userId }));
        return n == 0 ? null : await GetByIdAsync(companyId, propertyId);
    }

    private static DynamicParameters Params(SavePropertyDto dto, object extra)
    {
        var p = new DynamicParameters(dto);
        p.AddDynamicParams(extra);
        return p;
    }

    // Returns the deleted property's files so the caller can remove them from disk.
    public async Task<IEnumerable<PropertyFileRow>> DeleteAsync(int companyId, int propertyId)
    {
        using var db = _factory.CreateConnection();
        var files = (await db.QueryAsync<PropertyFileRow>(
            "SELECT * FROM dbo.wsm_property_files WHERE company_id = @companyId AND property_id = @propertyId",
            new { companyId, propertyId })).ToList();
        var n = await db.ExecuteAsync(@"
            UPDATE dbo.wsm_leads SET won_property_id = NULL WHERE company_id = @companyId AND won_property_id = @propertyId;
            UPDATE dbo.wsm_lead_activities SET property_id = NULL WHERE company_id = @companyId AND property_id = @propertyId;
            UPDATE dbo.wsm_follow_ups SET property_id = NULL WHERE company_id = @companyId AND property_id = @propertyId;
            DELETE FROM dbo.wsm_lead_shares WHERE company_id = @companyId AND property_id = @propertyId;
            DELETE FROM dbo.wsm_properties WHERE company_id = @companyId AND property_id = @propertyId;",
            new { companyId, propertyId });
        return n == 0 ? Enumerable.Empty<PropertyFileRow>() : files;
    }

    public async Task<PropertyFileRow> AddFileAsync(int companyId, int propertyId, PropertyFileRow file)
    {
        using var db = _factory.CreateConnection();
        // The first image of a property becomes its cover.
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_property_files (company_id, property_id, file_kind, file_name, stored_name, content_type, size_bytes, is_cover)
            VALUES (@companyId, @propertyId, @FileKind, @FileName, @StoredName, @ContentType, @SizeBytes,
                    CASE WHEN @FileKind = 'IMAGE' AND NOT EXISTS (SELECT 1 FROM dbo.wsm_property_files
                         WHERE property_id = @propertyId AND file_kind = 'IMAGE') THEN 'T' ELSE 'F' END);
            SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new { companyId, propertyId, file.FileKind, file.FileName, file.StoredName, file.ContentType, file.SizeBytes });
        return (await GetFileAsync(companyId, id))!;
    }

    public async Task<PropertyFileRow?> GetFileAsync(int companyId, int fileId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<PropertyFileRow>(
            "SELECT * FROM dbo.wsm_property_files WHERE company_id = @companyId AND file_id = @fileId", new { companyId, fileId });
    }

    public async Task<bool> DeleteFileAsync(int companyId, int fileId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync("DELETE FROM dbo.wsm_property_files WHERE company_id = @companyId AND file_id = @fileId",
            new { companyId, fileId }) > 0;
    }

    // Hard filters: available, sale/rent, and (when the lead set them) type, emirate, ready/off-plan, bedrooms,
    // and price within 10% of the budget. Preferred communities only rank results, so nearby areas still show.
    public async Task<IEnumerable<MatchRow>> MatchAsync(int companyId, LeadRow lead)
    {
        using var db = _factory.CreateConnection();
        var rows = (await db.QueryAsync<MatchRow>(Select.Replace("SELECT p.*,", @"
            SELECT p.*,
                   (SELECT TOP 1 s.shared_at FROM dbo.wsm_lead_shares s WHERE s.lead_id = @leadId AND s.property_id = p.property_id ORDER BY s.shared_at DESC) AS last_shared_at,
                   (SELECT TOP 1 s.channel FROM dbo.wsm_lead_shares s WHERE s.lead_id = @leadId AND s.property_id = p.property_id ORDER BY s.shared_at DESC) AS last_shared_channel,") + @"
            CROSS APPLY (SELECT CASE WHEN p.purpose = 'RENT' AND p.rent_frequency = 'MONTHLY' THEN p.price * 12 ELSE p.price END AS yearly) y
            WHERE p.company_id = @companyId AND p.status = 'AVAILABLE' AND p.purpose = @purpose
              AND (@type IS NULL OR p.property_type = @type)
              AND (@emirate IS NULL OR p.emirate = @emirate)
              AND (@completion IS NULL OR p.completion = @completion)
              AND (@bedsMin IS NULL OR p.bedrooms IS NULL OR p.bedrooms >= @bedsMin)
              AND (@bedsMax IS NULL OR p.bedrooms IS NULL OR p.bedrooms <= @bedsMax)
              AND (@budgetMin IS NULL OR y.yearly >= @budgetMin * 0.9)
              AND (@budgetMax IS NULL OR y.yearly <= @budgetMax * 1.1)",
            new
            {
                companyId, leadId = lead.LeadId,
                purpose = lead.Purpose == "RENT" ? "RENT" : "SALE",
                type = lead.PropertyType, emirate = lead.Emirate,
                completion = lead.Completion is "READY" or "OFFPLAN" ? lead.Completion : null,
                bedsMin = lead.BedroomsMin, bedsMax = lead.BedroomsMax,
                budgetMin = lead.BudgetMin, budgetMax = lead.BudgetMax
            })).ToList();

        var areas = (lead.Communities ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var r in rows)
            r.InPreferredArea = areas.Any(a =>
                (r.Community?.Contains(a, StringComparison.OrdinalIgnoreCase) ?? false)
                || (r.SubCommunity?.Contains(a, StringComparison.OrdinalIgnoreCase) ?? false)
                || (r.Community is not null && a.Contains(r.Community, StringComparison.OrdinalIgnoreCase)));

        var target = lead.BudgetMax ?? lead.BudgetMin;
        return rows
            .OrderByDescending(r => r.InPreferredArea)
            .ThenBy(r => r.LastSharedAt is not null)
            .ThenBy(r => target is null ? 0 : Math.Abs((r.Purpose == "RENT" && r.RentFrequency == "MONTHLY" ? r.Price * 12 : r.Price) - target.Value))
            .Take(50)
            .ToList();
    }

    public async Task<PublicPropertyView?> GetPublicAsync(string publicCode)
    {
        using var db = _factory.CreateConnection();
        var ids = await db.QuerySingleOrDefaultAsync<(int PropertyId, int CompanyId)?>(
            "SELECT property_id, company_id FROM dbo.wsm_properties WHERE public_code = @publicCode", new { publicCode });
        if (ids is null) return null;
        var property = await GetByIdAsync(ids.Value.CompanyId, ids.Value.PropertyId);
        var company = await db.QuerySingleAsync<(string CompanyName, string? DisplayNumber, string? VerifiedName)>(@"
            SELECT c.company_name, w.display_number, w.verified_name FROM dbo.wsm_companies c
            LEFT JOIN dbo.wsm_whatsapp_settings w ON w.company_id = c.company_id
            WHERE c.company_id = @companyId", new { companyId = ids.Value.CompanyId });
        // Meta's verified "Name · +91 63824 44214" has the full international number; the typed display number may not.
        var verifiedNumber = company.VerifiedName?.Split('·').LastOrDefault();
        var digits = System.Text.RegularExpressions.Regex.Replace(
            verifiedNumber is not null && verifiedNumber.Contains('+') ? verifiedNumber : company.DisplayNumber ?? "", @"\D", "");
        return new PublicPropertyView
        {
            Property = property!, CompanyName = company.CompanyName, WhatsAppNumber = digits.Length >= 8 ? digits : null
        };
    }

    public async Task<bool> SetCoverAsync(int companyId, int fileId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(@"
            UPDATE f SET is_cover = CASE WHEN f.file_id = @fileId THEN 'T' ELSE 'F' END
            FROM dbo.wsm_property_files f
            JOIN dbo.wsm_property_files t ON t.property_id = f.property_id
            WHERE t.company_id = @companyId AND t.file_id = @fileId AND t.file_kind = 'IMAGE' AND f.file_kind = 'IMAGE'",
            new { companyId, fileId }) > 0;
    }
}
