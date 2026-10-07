using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IEmailInboxRepository
{
    Task<bool> AddInboundAsync(int companyId, int customerId, string? messageId, string? subject, string from, string to, string? body, DateTime receivedAt);
    Task AddOutboundAsync(int companyId, int customerId, string? messageId, string subject, string from, string to, string body, bool ok, string? error, int sentBy);
    Task<IEnumerable<EmailConversationRow>> GetConversationsAsync(int companyId, int? onlyUserId, string? filter, int? staffId, string? search);
    Task<IEnumerable<EmailRow>> GetEmailsAsync(int companyId, int customerId);
    Task MarkReadAsync(int companyId, int customerId);
    Task<int> CountUnreadAsync(int companyId, int? onlyUserId);
}

public class EmailInboxRepository : IEmailInboxRepository
{
    private readonly IDbConnectionFactory _factory;
    public EmailInboxRepository(IDbConnectionFactory factory) => _factory = factory;

    private static string? Cut(string? s, int max) => s is not null && s.Length > max ? s[..max] : s;

    // Returns false when the same email (by Message-ID) was already imported.
    public async Task<bool> AddInboundAsync(int companyId, int customerId, string? messageId, string? subject, string from, string to, string? body, DateTime receivedAt)
    {
        const string sql = @"
            WITH ins AS (
                INSERT INTO wsm_emails (company_id, customer_id, direction, message_id, subject, from_address, to_address, body, status, created_at)
                SELECT @companyId, @customerId, 'IN', @messageId, @subject, @from, @to, @body, 'received', @receivedAt
                WHERE @messageId IS NULL
                   OR NOT EXISTS (SELECT 1 FROM wsm_emails WHERE company_id = @companyId AND message_id = @messageId)
                RETURNING email_id),
            upd AS (
                UPDATE wsm_customers
                SET last_email_at = CASE WHEN last_email_at > @receivedAt THEN last_email_at ELSE @receivedAt END,
                    email_unread_count = email_unread_count + 1
                WHERE customer_id = @customerId AND EXISTS (SELECT 1 FROM ins)
                RETURNING customer_id)
            SELECT COUNT(*)::int FROM ins";

        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int>(sql, new
        {
            companyId, customerId, messageId = Cut(messageId, 500), subject = Cut(subject, 500),
            from = Cut(from, 150), to = Cut(to, 150), body, receivedAt
        }) == 1;
    }

    public async Task AddOutboundAsync(int companyId, int customerId, string? messageId, string subject, string from, string to, string body, bool ok, string? error, int sentBy)
    {
        const string sql = @"
            INSERT INTO wsm_emails (company_id, customer_id, direction, message_id, subject, from_address, to_address, body, status, error_text, sent_by)
            VALUES (@companyId, @customerId, 'OUT', @messageId, @subject, @from, @to, @body, @status, @error, @sentBy);

            UPDATE wsm_customers SET last_email_at = utc_now() WHERE customer_id = @customerId;";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new
        {
            companyId, customerId, messageId = Cut(messageId, 500), subject = Cut(subject, 500),
            from = Cut(from, 150), to = Cut(to, 150), body,
            status = ok ? "sent" : "failed", error = Cut(error, 500), sentBy
        });
    }

    public async Task<IEnumerable<EmailConversationRow>> GetConversationsAsync(int companyId, int? onlyUserId, string? filter, int? staffId, string? search)
    {
        const string sql = @"
            SELECT c.customer_id, c.mobile_no, c.customer_name, c.whatsapp_name, c.email,
                   c.assigned_to, u.full_name AS assigned_to_name,
                   c.email_unread_count, c.last_email_at,
                   e.subject AS last_subject, LEFT(e.body, 200) AS last_body, e.direction AS last_direction
            FROM wsm_customers c
            LEFT JOIN wsm_users u ON u.user_id = c.assigned_to
            LEFT JOIN LATERAL (SELECT subject, body, direction FROM wsm_emails
                         WHERE customer_id = c.customer_id ORDER BY created_at DESC, email_id DESC LIMIT 1) e ON TRUE
            WHERE c.company_id = @companyId AND c.last_email_at IS NOT NULL
              AND (@onlyUserId IS NULL OR c.assigned_to = @onlyUserId)
              AND (@staffId IS NULL OR c.assigned_to = @staffId)
              AND (@filter IS NULL
                   OR (@filter = 'unassigned' AND c.assigned_to IS NULL)
                   OR (@filter = 'unread' AND c.email_unread_count > 0))
              AND (@search IS NULL OR c.email ILIKE '%' || @search || '%' OR c.customer_name ILIKE '%' || @search || '%'
                   OR c.mobile_no ILIKE '%' || @search || '%')
            ORDER BY c.last_email_at DESC";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<EmailConversationRow>(sql, new
        {
            companyId, onlyUserId, staffId,
            filter = string.IsNullOrWhiteSpace(filter) ? null : filter,
            search = string.IsNullOrWhiteSpace(search) ? null : search.Trim()
        });
    }

    public async Task<IEnumerable<EmailRow>> GetEmailsAsync(int companyId, int customerId)
    {
        const string sql = @"
            SELECT e.email_id, e.direction, e.message_id, e.subject, e.from_address, e.to_address, e.body,
                   e.status, e.error_text, u.full_name AS sent_by_name, e.created_at
            FROM wsm_emails e
            LEFT JOIN wsm_users u ON u.user_id = e.sent_by
            WHERE e.company_id = @companyId AND e.customer_id = @customerId
            ORDER BY e.created_at, e.email_id";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<EmailRow>(sql, new { companyId, customerId });
    }

    public async Task MarkReadAsync(int companyId, int customerId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE wsm_customers SET email_unread_count = 0 WHERE company_id = @companyId AND customer_id = @customerId AND email_unread_count <> 0",
            new { companyId, customerId });
    }

    public async Task<int> CountUnreadAsync(int companyId, int? onlyUserId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*)::int FROM wsm_customers
            WHERE company_id = @companyId AND email_unread_count > 0 AND (@onlyUserId IS NULL OR assigned_to = @onlyUserId)",
            new { companyId, onlyUserId });
    }
}
