using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IInboxRepository
{
    Task<bool> AddInboundAsync(int companyId, int customerId, string waMessageId, string msgType, string? body);
    Task AddOutboundAsync(int companyId, int customerId, string? waMessageId, string body, bool ok, string? error, int? sentBy, bool isBot);
    Task UpdateStatusAsync(int companyId, string waMessageId, string status, string? error);
    Task<IEnumerable<ConversationRow>> GetConversationsAsync(int companyId, int? onlyUserId, string? filter, int? staffId, string? search);
    Task<IEnumerable<MessageRow>> GetMessagesAsync(int companyId, int customerId);
    Task MarkReadAsync(int companyId, int customerId);
    Task<int> CountUnreadChatsAsync(int companyId, int? onlyUserId);
}

public class InboxRepository : IInboxRepository
{
    private readonly IDbConnectionFactory _factory;
    public InboxRepository(IDbConnectionFactory factory) => _factory = factory;

    // Returns false when Meta re-delivers a message that is already stored.
    public async Task<bool> AddInboundAsync(int companyId, int customerId, string waMessageId, string msgType, string? body)
    {
        const string sql = @"
            WITH ins AS (
                INSERT INTO wsm_messages (company_id, customer_id, wa_message_id, direction, msg_type, body, status)
                VALUES (@companyId, @customerId, @waMessageId, 'IN', @msgType, @body, 'received')
                ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
                RETURNING message_id),
            upd AS (
                UPDATE wsm_customers
                SET last_inbound_at = utc_now(), last_message_at = utc_now(), unread_count = unread_count + 1
                WHERE customer_id = @customerId AND EXISTS (SELECT 1 FROM ins)
                RETURNING customer_id)
            SELECT COUNT(*)::int FROM ins";

        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int>(sql, new { companyId, customerId, waMessageId, msgType, body }) == 1;
    }

    public async Task AddOutboundAsync(int companyId, int customerId, string? waMessageId, string body, bool ok, string? error, int? sentBy, bool isBot)
    {
        const string sql = @"
            INSERT INTO wsm_messages (company_id, customer_id, wa_message_id, direction, msg_type, body, status, error_text, is_bot, sent_by)
            VALUES (@companyId, @customerId, @waMessageId, 'OUT', 'text', @body, @status, @error, @isBotFlag, @sentBy);

            UPDATE wsm_customers SET last_message_at = utc_now() WHERE customer_id = @customerId;";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new
        {
            companyId, customerId, waMessageId, body,
            status = ok ? "sent" : "failed",
            error = error is { Length: > 500 } ? error[..500] : error,
            isBotFlag = isBot ? "T" : "F",
            sentBy
        });
    }

    public async Task UpdateStatusAsync(int companyId, string waMessageId, string status, string? error)
    {
        // Status webhooks can arrive out of order, so never move backwards (read -> delivered).
        const string sql = @"
            UPDATE wsm_messages
            SET status = @status, error_text = COALESCE(@error, error_text)
            WHERE company_id = @companyId AND wa_message_id = @waMessageId AND direction = 'OUT'
              AND (@status = 'failed'
                   OR CASE @status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END
                    > CASE status  WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END)";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new { companyId, waMessageId, status, error = error is { Length: > 500 } ? error[..500] : error });
    }

    public async Task<IEnumerable<ConversationRow>> GetConversationsAsync(int companyId, int? onlyUserId, string? filter, int? staffId, string? search)
    {
        const string sql = @"
            SELECT c.customer_id, c.mobile_no, c.customer_name, c.whatsapp_name, c.email,
                   c.assigned_to, u.full_name AS assigned_to_name,
                   c.unread_count, c.last_message_at, c.last_inbound_at,
                   m.body AS last_body, m.direction AS last_direction, m.msg_type AS last_type
            FROM wsm_customers c
            LEFT JOIN wsm_users u ON u.user_id = c.assigned_to
            LEFT JOIN LATERAL (SELECT body, direction, msg_type FROM wsm_messages
                         WHERE customer_id = c.customer_id ORDER BY created_at DESC, message_id DESC LIMIT 1) m ON TRUE
            WHERE c.company_id = @companyId AND c.last_message_at IS NOT NULL
              AND (@onlyUserId IS NULL OR c.assigned_to = @onlyUserId)
              AND (@staffId IS NULL OR c.assigned_to = @staffId)
              AND (@filter IS NULL
                   OR (@filter = 'unassigned' AND c.assigned_to IS NULL)
                   OR (@filter = 'unread' AND c.unread_count > 0))
              AND (@search IS NULL OR c.mobile_no ILIKE '%' || @search || '%' OR c.customer_name ILIKE '%' || @search || '%'
                   OR c.whatsapp_name ILIKE '%' || @search || '%')
            ORDER BY c.last_message_at DESC";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<ConversationRow>(sql, new
        {
            companyId, onlyUserId, staffId,
            filter = string.IsNullOrWhiteSpace(filter) ? null : filter,
            search = string.IsNullOrWhiteSpace(search) ? null : search.Trim()
        });
    }

    public async Task<IEnumerable<MessageRow>> GetMessagesAsync(int companyId, int customerId)
    {
        const string sql = @"
            SELECT m.message_id, m.direction, m.msg_type, m.body, m.status, m.error_text, m.is_bot,
                   u.full_name AS sent_by_name, m.created_at
            FROM wsm_messages m
            LEFT JOIN wsm_users u ON u.user_id = m.sent_by
            WHERE m.company_id = @companyId AND m.customer_id = @customerId
            ORDER BY m.created_at, m.message_id";

        using var db = _factory.CreateConnection();
        return await db.QueryAsync<MessageRow>(sql, new { companyId, customerId });
    }

    public async Task MarkReadAsync(int companyId, int customerId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE wsm_customers SET unread_count = 0 WHERE company_id = @companyId AND customer_id = @customerId AND unread_count <> 0",
            new { companyId, customerId });
    }

    public async Task<int> CountUnreadChatsAsync(int companyId, int? onlyUserId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*)::int FROM wsm_customers
            WHERE company_id = @companyId AND unread_count > 0 AND (@onlyUserId IS NULL OR assigned_to = @onlyUserId)",
            new { companyId, onlyUserId });
    }
}
