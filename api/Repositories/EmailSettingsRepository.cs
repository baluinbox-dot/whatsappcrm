using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IEmailSettingsRepository
{
    Task<EmailSettings?> GetAsync(int companyId);
    Task<IEnumerable<EmailSettings>> GetActiveVerifiedAsync();
    Task SaveAsync(int companyId, SaveEmailSettingsDto dto);
    Task SetVerifiedAsync(int companyId, bool verified, string? error);
    Task SetCursorAsync(int companyId, long uidValidity, long lastUid);
    Task SetCheckedAsync(int companyId, string? error);
}

public class EmailSettingsRepository : IEmailSettingsRepository
{
    private readonly IDbConnectionFactory _factory;
    public EmailSettingsRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<EmailSettings?> GetAsync(int companyId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<EmailSettings>(
            "SELECT * FROM dbo.wsm_email_settings WHERE company_id = @companyId", new { companyId });
    }

    public async Task<IEnumerable<EmailSettings>> GetActiveVerifiedAsync()
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<EmailSettings>(@"
            SELECT s.* FROM dbo.wsm_email_settings s
            JOIN dbo.wsm_companies c ON c.company_id = s.company_id
            WHERE s.is_verified = 'T' AND c.status = 'ACTIVE'");
    }

    public async Task SaveAsync(int companyId, SaveEmailSettingsDto dto)
    {
        // A different mailbox or server needs re-verifying and starts importing from scratch.
        const string sql = @"
            MERGE dbo.wsm_email_settings AS t
            USING (SELECT @companyId AS company_id) AS s ON t.company_id = s.company_id
            WHEN MATCHED THEN UPDATE SET
                is_verified   = CASE WHEN t.username <> @Username OR t.imap_host <> @ImapHost OR t.imap_port <> @ImapPort
                                       OR t.smtp_host <> @SmtpHost OR t.smtp_port <> @SmtpPort
                                       OR NULLIF(@Password, '') IS NOT NULL
                                     THEN 'F' ELSE t.is_verified END,
                uid_validity  = CASE WHEN t.username <> @Username OR t.imap_host <> @ImapHost THEN NULL ELSE t.uid_validity END,
                last_uid      = CASE WHEN t.username <> @Username OR t.imap_host <> @ImapHost THEN NULL ELSE t.last_uid END,
                email_address = @EmailAddress,
                from_name     = @FromName,
                username      = @Username,
                password      = COALESCE(NULLIF(@Password, ''), t.password),
                imap_host     = @ImapHost,
                imap_port     = @ImapPort,
                smtp_host     = @SmtpHost,
                smtp_port     = @SmtpPort,
                updated_at    = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT
                (company_id, email_address, from_name, username, password, imap_host, imap_port, smtp_host, smtp_port)
                VALUES (@companyId, @EmailAddress, @FromName, @Username, NULLIF(@Password, ''), @ImapHost, @ImapPort, @SmtpHost, @SmtpPort);";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new
        {
            companyId,
            EmailAddress = dto.EmailAddress.Trim(),
            FromName = string.IsNullOrWhiteSpace(dto.FromName) ? null : dto.FromName.Trim(),
            Username = dto.Username.Trim(),
            // Gmail shows App Passwords in groups of four; the spaces are not part of it.
            Password = dto.Password?.Replace(" ", ""),
            ImapHost = dto.ImapHost.Trim(),
            dto.ImapPort,
            SmtpHost = dto.SmtpHost.Trim(),
            dto.SmtpPort
        });
    }

    public async Task SetVerifiedAsync(int companyId, bool verified, string? error)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE dbo.wsm_email_settings SET is_verified = @flag, last_error = @error WHERE company_id = @companyId",
            new { companyId, flag = verified ? "T" : "F", error = Trim(error) });
    }

    public async Task SetCursorAsync(int companyId, long uidValidity, long lastUid)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE dbo.wsm_email_settings SET uid_validity = @uidValidity, last_uid = @lastUid WHERE company_id = @companyId",
            new { companyId, uidValidity, lastUid });
    }

    public async Task SetCheckedAsync(int companyId, string? error)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE dbo.wsm_email_settings SET last_checked_at = SYSUTCDATETIME(), last_error = @error WHERE company_id = @companyId",
            new { companyId, error = Trim(error) });
    }

    private static string? Trim(string? s) => s is { Length: > 500 } ? s[..500] : s;
}
