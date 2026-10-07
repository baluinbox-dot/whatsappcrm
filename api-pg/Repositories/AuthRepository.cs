using System.Security.Cryptography;
using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IAuthRepository
{
    Task<AuthUser?> GetByIdAsync(int userId);
    Task<(AuthUser? User, string? PasswordHash)> GetByEmailAsync(string email);
    Task<(AuthUser? User, string? PasswordHash)> GetByCompanyMobileAsync(string adminEmail, string mobileNo);
    Task<string?> SignupAsync(SignupDto dto, string passwordHash);
    Task TouchLoginAsync(int userId);
    Task CreateResetTokenAsync(int userId, string tokenHash, DateTime expiresAt);
    Task<bool> ResetPasswordAsync(string tokenHash, string passwordHash);
}

public class AuthRepository : IAuthRepository
{
    private readonly IDbConnectionFactory _factory;
    public AuthRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string SelectUser = @"
        SELECT u.user_id, u.company_id, c.company_name, c.status AS company_status,
               u.full_name, u.email, u.mobile_no, u.role, u.is_super_admin, u.is_active, u.password_hash
        FROM wsm_users u
        JOIN wsm_companies c ON c.company_id = u.company_id";

    public async Task<AuthUser?> GetByIdAsync(int userId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<AuthUser>(SelectUser + " WHERE u.user_id = @userId", new { userId });
    }

    public async Task<(AuthUser?, string?)> GetByEmailAsync(string email)
    {
        using var db = _factory.CreateConnection();
        return Map(await db.QuerySingleOrDefaultAsync<dynamic>(SelectUser + " WHERE LOWER(u.email) = LOWER(@email)", new { email }));
    }

    public async Task<(AuthUser?, string?)> GetByCompanyMobileAsync(string adminEmail, string mobileNo)
    {
        const string where = @"
            WHERE u.mobile_no = @mobileNo
              AND u.company_id = (SELECT a.company_id FROM wsm_users a WHERE LOWER(a.email) = LOWER(@adminEmail) AND a.role = 'ADMIN' ORDER BY a.user_id LIMIT 1)";

        using var db = _factory.CreateConnection();
        return Map(await db.QuerySingleOrDefaultAsync<dynamic>(SelectUser + where, new { adminEmail, mobileNo }));
    }

    private static (AuthUser?, string?) Map(dynamic? row)
    {
        if (row is null) return (null, null);

        var user = new AuthUser
        {
            UserId = row.user_id,
            CompanyId = row.company_id,
            CompanyName = row.company_name,
            CompanyStatus = row.company_status,
            FullName = row.full_name,
            Email = row.email,
            MobileNo = row.mobile_no,
            Role = row.role,
            IsSuperAdmin = row.is_super_admin,
            IsActive = row.is_active
        };
        return (user, (string?)row.password_hash);
    }

    // Creates a PENDING company plus its first admin. Returns an error message or null.
    public async Task<string?> SignupAsync(SignupDto dto, string passwordHash)
    {
        using var db = _factory.CreateConnection();
        db.Open();
        using var tx = db.BeginTransaction();

        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*)::int FROM wsm_users WHERE LOWER(email) = LOWER(@Email)", new { dto.Email }, tx) > 0)
            return "That email is already registered.";

        var companyId = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO wsm_companies (company_code, company_name, status) VALUES (@code, @name, 'PENDING')
            RETURNING company_id;",
            new { code = Convert.ToHexString(RandomNumberGenerator.GetBytes(6)).ToLowerInvariant(), name = dto.CompanyName.Trim() }, tx);

        await db.ExecuteAsync(@"
            INSERT INTO wsm_users (company_id, full_name, email, mobile_no, password_hash, role)
            VALUES (@companyId, @FullName, @Email, @MobileNo, @passwordHash, 'ADMIN');",
            new { companyId, FullName = dto.FullName.Trim(), Email = dto.Email.Trim(), dto.MobileNo, passwordHash }, tx);

        tx.Commit();
        return null;
    }

    public async Task TouchLoginAsync(int userId)
    {
        using var db = _factory.CreateConnection();
        await db.ExecuteAsync("UPDATE wsm_users SET last_login_at = utc_now() WHERE user_id = @userId", new { userId });
    }

    public async Task CreateResetTokenAsync(int userId, string tokenHash, DateTime expiresAt)
    {
        // A new link invalidates any earlier unused ones.
        const string sql = @"
            UPDATE wsm_password_resets SET used_at = utc_now() WHERE user_id = @userId AND used_at IS NULL;
            INSERT INTO wsm_password_resets (user_id, token_hash, expires_at) VALUES (@userId, @tokenHash, @expiresAt);";

        using var db = _factory.CreateConnection();
        await db.ExecuteAsync(sql, new { userId, tokenHash, expiresAt });
    }

    public async Task<bool> ResetPasswordAsync(string tokenHash, string passwordHash)
    {
        // Claim the token atomically so it can only be used once.
        const string sql = @"
            WITH claimed AS (
                UPDATE wsm_password_resets SET used_at = utc_now()
                WHERE token_hash = @tokenHash AND used_at IS NULL AND expires_at > utc_now()
                RETURNING user_id)
            UPDATE wsm_users SET password_hash = @passwordHash
            WHERE user_id IN (SELECT user_id FROM claimed) AND is_active = 'T'";

        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync(sql, new { tokenHash, passwordHash }) > 0;
    }
}
