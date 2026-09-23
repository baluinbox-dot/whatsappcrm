using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface ICustomerRepository
{
    // onlyUserId: when set (staff), restricts results to customers assigned to that user.
    Task<IEnumerable<CustomerRow>> GetAllAsync(int companyId, int? onlyUserId, string? search, string? filter);
    Task<CustomerRow?> GetByIdAsync(int companyId, int customerId);
    Task<CustomerRow?> GetByMobileAsync(int companyId, string mobileNo);
    Task<(CustomerRow? Row, string? Error)> CreateAsync(int companyId, SaveCustomerDto dto);
    Task<(CustomerRow? Row, string? Error)> UpdateAsync(int companyId, int customerId, SaveCustomerDto dto);
    Task<bool> DeleteAsync(int companyId, int customerId);
    Task AssignAsync(int companyId, int customerId, int? toUserId, int assignedBy);
    Task<IEnumerable<AssignmentRow>> GetAssignmentHistoryAsync(int companyId, int customerId);
    Task<CustomerRow> StartChatAsync(int companyId, string mobileNo, string? whatsappName);
    Task UpdateChatAsync(int customerId, string chatState, string? customerName, string? email);
}

public class CustomerRepository : ICustomerRepository
{
    private readonly IDbConnectionFactory _factory;
    public CustomerRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT c.*, u.full_name AS assigned_to_name
        FROM dbo.wsm_customers c
        LEFT JOIN dbo.wsm_users u ON u.user_id = c.assigned_to";

    public async Task<IEnumerable<CustomerRow>> GetAllAsync(int companyId, int? onlyUserId, string? search, string? filter)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<CustomerRow>(Select + @"
            WHERE c.company_id = @companyId
              AND (@onlyUserId IS NULL OR c.assigned_to = @onlyUserId)
              AND (@filter IS NULL OR (@filter = 'unassigned' AND c.assigned_to IS NULL)
                                   OR (@filter = 'assigned' AND c.assigned_to IS NOT NULL))
              AND (@search IS NULL OR c.mobile_no LIKE '%' + @search + '%' OR c.customer_name LIKE '%' + @search + '%'
                   OR c.email LIKE '%' + @search + '%' OR c.whatsapp_name LIKE '%' + @search + '%')
            ORDER BY c.created_at DESC",
            new { companyId, onlyUserId, filter, search = string.IsNullOrWhiteSpace(search) ? null : search.Trim() });
    }

    public async Task<CustomerRow?> GetByIdAsync(int companyId, int customerId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<CustomerRow>(
            Select + " WHERE c.company_id = @companyId AND c.customer_id = @customerId", new { companyId, customerId });
    }

    public async Task<CustomerRow?> GetByMobileAsync(int companyId, string mobileNo)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<CustomerRow>(
            Select + " WHERE c.company_id = @companyId AND c.mobile_no = @mobileNo", new { companyId, mobileNo });
    }

    public async Task<(CustomerRow?, string?)> CreateAsync(int companyId, SaveCustomerDto dto)
    {
        using var db = _factory.CreateConnection();
        if (await db.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM dbo.wsm_customers WHERE company_id = @companyId AND mobile_no = @MobileNo",
                new { companyId, dto.MobileNo }) > 0)
            return (null, "A customer with that mobile number already exists.");

        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_customers (company_id, mobile_no, customer_name, email, source)
            VALUES (@companyId, @MobileNo, @CustomerName, @Email, 'Manual');
            SELECT CAST(SCOPE_IDENTITY() AS INT);", new { companyId, dto.MobileNo, dto.CustomerName, dto.Email });
        return (await GetByIdAsync(companyId, id), null);
    }

    public async Task<(CustomerRow?, string?)> UpdateAsync(int companyId, int customerId, SaveCustomerDto dto)
    {
        using var db = _factory.CreateConnection();
        if (await db.ExecuteScalarAsync<int>(@"
                SELECT COUNT(*) FROM dbo.wsm_customers
                WHERE company_id = @companyId AND mobile_no = @MobileNo AND customer_id <> @customerId",
                new { companyId, dto.MobileNo, customerId }) > 0)
            return (null, "A customer with that mobile number already exists.");

        var n = await db.ExecuteAsync(@"
            UPDATE dbo.wsm_customers
            SET mobile_no = @MobileNo, customer_name = @CustomerName, email = @Email, updated_at = SYSUTCDATETIME()
            WHERE company_id = @companyId AND customer_id = @customerId",
            new { companyId, customerId, dto.MobileNo, dto.CustomerName, dto.Email });
        return n == 0 ? (null, "Customer not found.") : (await GetByIdAsync(companyId, customerId), null);
    }

    public async Task<bool> DeleteAsync(int companyId, int customerId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(
            "DELETE FROM dbo.wsm_customers WHERE company_id = @companyId AND customer_id = @customerId",
            new { companyId, customerId }) > 0;
    }

    public async Task AssignAsync(int companyId, int customerId, int? toUserId, int assignedBy)
    {
        const string sql = @"
            DECLARE @from INT = (SELECT assigned_to FROM dbo.wsm_customers WHERE company_id = @companyId AND customer_id = @customerId);

            IF ISNULL(@from, 0) <> ISNULL(@toUserId, 0)
            BEGIN
                UPDATE dbo.wsm_customers
                SET assigned_to = @toUserId, assigned_at = CASE WHEN @toUserId IS NULL THEN NULL ELSE SYSUTCDATETIME() END,
                    updated_at = SYSUTCDATETIME()
                WHERE company_id = @companyId AND customer_id = @customerId;

                INSERT INTO dbo.wsm_assignment_history (company_id, customer_id, from_user_id, to_user_id, assigned_by)
                VALUES (@companyId, @customerId, @from, @toUserId, @assignedBy);
            END";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new { companyId, customerId, toUserId, assignedBy });
    }

    public async Task<IEnumerable<AssignmentRow>> GetAssignmentHistoryAsync(int companyId, int customerId)
    {
        const string sql = @"
            SELECT f.full_name AS from_name, t.full_name AS to_name, b.full_name AS assigned_by_name, h.created_at
            FROM dbo.wsm_assignment_history h
            LEFT JOIN dbo.wsm_users f ON f.user_id = h.from_user_id
            LEFT JOIN dbo.wsm_users t ON t.user_id = h.to_user_id
            LEFT JOIN dbo.wsm_users b ON b.user_id = h.assigned_by
            WHERE h.company_id = @companyId AND h.customer_id = @customerId
            ORDER BY h.created_at DESC";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<AssignmentRow>(sql, new { companyId, customerId });
    }

    public async Task<CustomerRow> StartChatAsync(int companyId, string mobileNo, string? whatsappName)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_customers (company_id, mobile_no, whatsapp_name, chat_state, source)
            VALUES (@companyId, @mobileNo, @whatsappName, 'ASK_NAME', 'WhatsApp');
            SELECT CAST(SCOPE_IDENTITY() AS INT);", new { companyId, mobileNo, whatsappName });
        return (await GetByIdAsync(companyId, id))!;
    }

    public async Task UpdateChatAsync(int customerId, string chatState, string? customerName, string? email)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            UPDATE dbo.wsm_customers
            SET chat_state = @chatState, customer_name = @customerName, email = @email, updated_at = SYSUTCDATETIME()
            WHERE customer_id = @customerId", new { customerId, chatState, customerName, email });
    }
}
