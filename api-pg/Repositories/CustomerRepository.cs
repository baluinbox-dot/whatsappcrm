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
    Task<CustomerRow?> GetByEmailAsync(int companyId, string email);
    Task<CustomerRow> CreateFromEmailAsync(int companyId, string email, string? name);
    Task<(CustomerRow? Row, string? Error)> CreateAsync(int companyId, SaveCustomerDto dto);
    Task<(CustomerRow? Row, string? Error)> UpdateAsync(int companyId, int customerId, SaveCustomerDto dto);
    Task<bool> DeleteAsync(int companyId, int customerId);
    Task AssignAsync(int companyId, int customerId, int? toUserId, int assignedBy);
    Task<IEnumerable<AssignmentRow>> GetAssignmentHistoryAsync(int companyId, int customerId);
    Task<CustomerRow> StartChatAsync(int companyId, string mobileNo, string? whatsappName);
    Task UpdateChatAsync(int customerId, string chatState, string? customerName, string? email);
    Task SetBotLeadAsync(int customerId, string chatState, int? botLeadId);
}

public class CustomerRepository : ICustomerRepository
{
    private readonly IDbConnectionFactory _factory;
    public CustomerRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT c.*, u.full_name AS assigned_to_name
        FROM wsm_customers c
        LEFT JOIN wsm_users u ON u.user_id = c.assigned_to";

    public async Task<IEnumerable<CustomerRow>> GetAllAsync(int companyId, int? onlyUserId, string? search, string? filter)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<CustomerRow>(Select + @"
            WHERE c.company_id = @companyId
              AND (@onlyUserId IS NULL OR c.assigned_to = @onlyUserId)
              AND (@filter IS NULL OR (@filter = 'unassigned' AND c.assigned_to IS NULL)
                                   OR (@filter = 'assigned' AND c.assigned_to IS NOT NULL))
              AND (@search IS NULL OR c.mobile_no ILIKE '%' || @search || '%' OR c.customer_name ILIKE '%' || @search || '%'
                   OR c.email ILIKE '%' || @search || '%' OR c.whatsapp_name ILIKE '%' || @search || '%')
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

    // A WhatsApp customer who shared this email is the same person, so the oldest match wins.
    public async Task<CustomerRow?> GetByEmailAsync(int companyId, string email)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryFirstOrDefaultAsync<CustomerRow>(
            Select + " WHERE c.company_id = @companyId AND LOWER(c.email) = LOWER(@email) ORDER BY c.customer_id", new { companyId, email });
    }

    public async Task<CustomerRow> CreateFromEmailAsync(int companyId, string email, string? name)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO wsm_customers (company_id, customer_name, email, chat_state, source)
            VALUES (@companyId, @name, @email, 'DONE', 'Email')
            RETURNING customer_id;", new { companyId, email, name });
        return (await GetByIdAsync(companyId, id))!;
    }

    public async Task<(CustomerRow?, string?)> CreateAsync(int companyId, SaveCustomerDto dto)
    {
        using var db = _factory.CreateConnection();
        if (await db.ExecuteScalarAsync<int>(
                "SELECT COUNT(*)::int FROM wsm_customers WHERE company_id = @companyId AND mobile_no = @MobileNo",
                new { companyId, dto.MobileNo }) > 0)
            return (null, "A customer with that mobile number already exists.");

        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO wsm_customers (company_id, mobile_no, customer_name, email, source)
            VALUES (@companyId, @MobileNo, @CustomerName, @Email, 'Manual')
            RETURNING customer_id;", new { companyId, dto.MobileNo, dto.CustomerName, dto.Email });
        return (await GetByIdAsync(companyId, id), null);
    }

    public async Task<(CustomerRow?, string?)> UpdateAsync(int companyId, int customerId, SaveCustomerDto dto)
    {
        using var db = _factory.CreateConnection();
        if (await db.ExecuteScalarAsync<int>(@"
                SELECT COUNT(*)::int FROM wsm_customers
                WHERE company_id = @companyId AND mobile_no = @MobileNo AND customer_id <> @customerId",
                new { companyId, dto.MobileNo, customerId }) > 0)
            return (null, "A customer with that mobile number already exists.");

        var n = await db.ExecuteAsync(@"
            UPDATE wsm_customers
            SET mobile_no = @MobileNo, customer_name = @CustomerName, email = @Email, updated_at = utc_now()
            WHERE company_id = @companyId AND customer_id = @customerId",
            new { companyId, customerId, dto.MobileNo, dto.CustomerName, dto.Email });
        return n == 0 ? (null, "Customer not found.") : (await GetByIdAsync(companyId, customerId), null);
    }

    public async Task<bool> DeleteAsync(int companyId, int customerId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(
            "DELETE FROM wsm_customers WHERE company_id = @companyId AND customer_id = @customerId",
            new { companyId, customerId }) > 0;
    }

    public async Task AssignAsync(int companyId, int customerId, int? toUserId, int assignedBy)
    {
        using var db = _factory.CreateConnection();
        db.Open();
        using var tx = db.BeginTransaction();
        var from = await db.ExecuteScalarAsync<int?>(
            "SELECT assigned_to FROM wsm_customers WHERE company_id = @companyId AND customer_id = @customerId",
            new { companyId, customerId }, tx);
        if ((from ?? 0) == (toUserId ?? 0)) return;

        await db.ExecuteAsync(@"
            UPDATE wsm_customers
            SET assigned_to = @toUserId, assigned_at = CASE WHEN @toUserId IS NULL THEN NULL ELSE utc_now() END,
                updated_at = utc_now()
            WHERE company_id = @companyId AND customer_id = @customerId;

            INSERT INTO wsm_assignment_history (company_id, customer_id, from_user_id, to_user_id, assigned_by)
            VALUES (@companyId, @customerId, @from, @toUserId, @assignedBy);",
            new { companyId, customerId, toUserId, assignedBy, from }, tx);
        tx.Commit();
    }

    public async Task<IEnumerable<AssignmentRow>> GetAssignmentHistoryAsync(int companyId, int customerId)
    {
        const string sql = @"
            SELECT f.full_name AS from_name, t.full_name AS to_name, b.full_name AS assigned_by_name, h.created_at
            FROM wsm_assignment_history h
            LEFT JOIN wsm_users f ON f.user_id = h.from_user_id
            LEFT JOIN wsm_users t ON t.user_id = h.to_user_id
            LEFT JOIN wsm_users b ON b.user_id = h.assigned_by
            WHERE h.company_id = @companyId AND h.customer_id = @customerId
            ORDER BY h.created_at DESC";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<AssignmentRow>(sql, new { companyId, customerId });
    }

    public async Task<CustomerRow> StartChatAsync(int companyId, string mobileNo, string? whatsappName)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO wsm_customers (company_id, mobile_no, whatsapp_name, chat_state, source)
            VALUES (@companyId, @mobileNo, @whatsappName, 'ASK_NAME', 'WhatsApp')
            RETURNING customer_id;", new { companyId, mobileNo, whatsappName });
        return (await GetByIdAsync(companyId, id))!;
    }

    public async Task SetBotLeadAsync(int customerId, string chatState, int? botLeadId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            UPDATE wsm_customers SET chat_state = @chatState, bot_lead_id = @botLeadId, updated_at = utc_now()
            WHERE customer_id = @customerId", new { customerId, chatState, botLeadId });
    }

    public async Task UpdateChatAsync(int customerId, string chatState, string? customerName, string? email)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(@"
            UPDATE wsm_customers
            SET chat_state = @chatState, customer_name = @customerName, email = @email, updated_at = utc_now()
            WHERE customer_id = @customerId", new { customerId, chatState, customerName, email });
    }
}
