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
            "SELECT * FROM wsm_email_settings WHERE company_id = @companyId", new { companyId });
    }

    public async Task<IEnumerable<EmailSettings>> GetActiveVerifiedAsync()
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<EmailSettings>(@"
            SELECT s.* FROM wsm_email_settings s
            JOIN wsm_companies c ON c.company_id = s.company_id
            WHERE s.is_verified = 'T' AND c.status = 'ACTIVE'");
    }

    public async Task SaveAsync(int companyId, SaveEmailSettingsDto dto)
    {
        // A different mailbox or server needs re-verifying and starts importing from scratch.
        const string sql = @"
            INSERT INTO wsm_email_settings
                (company_id, email_address, from_name, username, password, imap_host, imap_port, smtp_host, smtp_port)
            VALUES (@companyId, @EmailAddress, @FromName, @Username, NULLIF(@Password, ''), @ImapHost, @ImapPort, @SmtpHost, @SmtpPort)
            ON CONFLICT (company_id) DO UPDATE SET
                is_verified   = CASE WHEN wsm_email_settings.username <> @Username OR wsm_email_settings.imap_host <> @ImapHost
                                       OR wsm_email_settings.imap_port <> @ImapPort
                                       OR wsm_email_settings.smtp_host <> @SmtpHost OR wsm_email_settings.smtp_port <> @SmtpPort
                                       OR NULLIF(@Password, '') IS NOT NULL
                                     THEN 'F' ELSE wsm_email_settings.is_verified END,
                uid_validity  = CASE WHEN wsm_email_settings.username <> @Username OR wsm_email_settings.imap_host <> @ImapHost
                                     THEN NULL ELSE wsm_email_settings.uid_validity END,
                last_uid      = CASE WHEN wsm_email_settings.username <> @Username OR wsm_email_settings.imap_host <> @ImapHost
                                     THEN NULL ELSE wsm_email_settings.last_uid END,
                email_address = @EmailAddress,
                from_name     = @FromName,
                username      = @Username,
                password      = COALESCE(NULLIF(@Password, ''), wsm_email_settings.password),
                imap_host     = @ImapHost,
                imap_port     = @ImapPort,
                smtp_host     = @SmtpHost,
                smtp_port     = @SmtpPort,
                updated_at    = utc_now()";

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
            "UPDATE wsm_email_settings SET is_verified = @flag, last_error = @error WHERE company_id = @companyId",
            new { companyId, flag = verified ? "T" : "F", error = Trim(error) });
    }

    public async Task SetCursorAsync(int companyId, long uidValidity, long lastUid)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE wsm_email_settings SET uid_validity = @uidValidity, last_uid = @lastUid WHERE company_id = @companyId",
            new { companyId, uidValidity, lastUid });
    }

    public async Task SetCheckedAsync(int companyId, string? error)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE wsm_email_settings SET last_checked_at = utc_now(), last_error = @error WHERE company_id = @companyId",
            new { companyId, error = Trim(error) });
    }

    private static string? Trim(string? s) => s is { Length: > 500 } ? s[..500] : s;
}
