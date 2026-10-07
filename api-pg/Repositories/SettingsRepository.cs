using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface ISettingsRepository
{
    Task<WhatsAppSettings?> GetAsync(int companyId);
    Task SaveAsync(int companyId, SaveWhatsAppSettingsDto dto);
    Task SetVerifiedAsync(int companyId, bool verified, string? verifiedName);
}

public class SettingsRepository : ISettingsRepository
{
    private readonly IDbConnectionFactory _factory;
    public SettingsRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<WhatsAppSettings?> GetAsync(int companyId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<WhatsAppSettings>(
            "SELECT * FROM wsm_whatsapp_settings WHERE company_id = @companyId", new { companyId });
    }

    public async Task SaveAsync(int companyId, SaveWhatsAppSettingsDto dto)
    {
        // Changing the number or token means the connection has to be re-verified.
        const string sql = @"
            INSERT INTO wsm_whatsapp_settings
                (company_id, waba_id, phone_number_id, display_number, access_token, verify_token, app_secret)
            VALUES (@companyId, @WabaId, @PhoneNumberId, @DisplayNumber, NULLIF(@AccessToken, ''), @VerifyToken, NULLIF(@AppSecret, ''))
            ON CONFLICT (company_id) DO UPDATE SET
                is_verified     = CASE WHEN COALESCE(wsm_whatsapp_settings.phone_number_id, '') <> @PhoneNumberId
                                         OR NULLIF(@AccessToken, '') IS NOT NULL
                                       THEN 'F' ELSE wsm_whatsapp_settings.is_verified END,
                waba_id         = @WabaId,
                phone_number_id = @PhoneNumberId,
                display_number  = @DisplayNumber,
                access_token    = COALESCE(NULLIF(@AccessToken, ''), wsm_whatsapp_settings.access_token),
                verify_token    = @VerifyToken,
                app_secret      = COALESCE(NULLIF(@AppSecret, ''), wsm_whatsapp_settings.app_secret),
                updated_at      = utc_now()";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new
        {
            companyId,
            WabaId = dto.WabaId?.Trim(),
            PhoneNumberId = dto.PhoneNumberId.Trim(),
            DisplayNumber = dto.DisplayNumber?.Trim(),
            AccessToken = dto.AccessToken?.Trim(),
            VerifyToken = dto.VerifyToken.Trim(),
            AppSecret = dto.AppSecret?.Trim()
        });
    }

    public async Task SetVerifiedAsync(int companyId, bool verified, string? verifiedName)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(
            "UPDATE wsm_whatsapp_settings SET is_verified = @flag, verified_name = @verifiedName WHERE company_id = @companyId",
            new { companyId, flag = verified ? "T" : "F", verifiedName });
    }
}
