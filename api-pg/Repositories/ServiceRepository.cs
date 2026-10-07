using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IServiceRepository
{
    Task<IEnumerable<ServiceRow>> GetAllAsync(int companyId, string? search, string? category);
    Task<ServiceRow?> GetByIdAsync(int companyId, int serviceId);
    Task<ServiceRow?> CreateAsync(int companyId, SaveServiceDto dto);
    Task<ServiceRow?> UpdateAsync(int companyId, int serviceId, SaveServiceDto dto);
    Task<bool> DeleteAsync(int companyId, int serviceId);
}

public class ServiceRepository : IServiceRepository
{
    private readonly IDbConnectionFactory _factory;
    public ServiceRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IEnumerable<ServiceRow>> GetAllAsync(int companyId, string? search, string? category)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<ServiceRow>(@"
            SELECT * FROM wsm_services
            WHERE company_id = @companyId
              AND (@category IS NULL OR category = @category)
              AND (@search IS NULL OR service_name ILIKE '%' || @search || '%' OR description ILIKE '%' || @search || '%')
            ORDER BY category, service_name",
            new
            {
                companyId,
                search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                category = string.IsNullOrWhiteSpace(category) ? null : category.Trim()
            });
    }

    public async Task<ServiceRow?> GetByIdAsync(int companyId, int serviceId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<ServiceRow>(
            "SELECT * FROM wsm_services WHERE company_id = @companyId AND service_id = @serviceId", new { companyId, serviceId });
    }

    public async Task<ServiceRow?> CreateAsync(int companyId, SaveServiceDto dto)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO wsm_services (company_id, service_name, category, price, price_note, description, is_active)
            VALUES (@companyId, @ServiceName, @Category, @Price, @PriceNote, @Description, @IsActive)
            RETURNING service_id;",
            new { companyId, dto.ServiceName, dto.Category, dto.Price, dto.PriceNote, dto.Description, dto.IsActive });
        return await GetByIdAsync(companyId, id);
    }

    public async Task<ServiceRow?> UpdateAsync(int companyId, int serviceId, SaveServiceDto dto)
    {
        using var db = _factory.CreateConnection();
        var n = await db.ExecuteAsync(@"
            UPDATE wsm_services SET service_name = @ServiceName, category = @Category, price = @Price,
                   price_note = @PriceNote, description = @Description, is_active = @IsActive, updated_at = utc_now()
            WHERE company_id = @companyId AND service_id = @serviceId",
            new { companyId, serviceId, dto.ServiceName, dto.Category, dto.Price, dto.PriceNote, dto.Description, dto.IsActive });
        return n == 0 ? null : await GetByIdAsync(companyId, serviceId);
    }

    public async Task<bool> DeleteAsync(int companyId, int serviceId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync("DELETE FROM wsm_services WHERE company_id = @companyId AND service_id = @serviceId",
            new { companyId, serviceId }) > 0;
    }
}
