using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface IUserRepository
{
    Task<IEnumerable<UserRow>> GetAllAsync(int companyId, string? search);
    Task<UserRow?> GetByIdAsync(int companyId, int userId);
    Task<(UserRow? Row, string? Error)> CreateAsync(int companyId, SaveUserDto dto, string? passwordHash);
    Task<(UserRow? Row, string? Error)> UpdateAsync(int companyId, int userId, SaveUserDto dto, string? passwordHash);
    Task<bool> IsActiveMemberAsync(int companyId, int userId);
}

public class UserRepository : IUserRepository
{
    private readonly IDbConnectionFactory _factory;
    public UserRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT u.user_id, u.full_name, u.email, u.mobile_no, u.role, u.is_active,
               CASE WHEN u.password_hash IS NULL THEN 'F' ELSE 'T' END AS has_password,
               (SELECT COUNT(*) FROM dbo.wsm_customers c WHERE c.assigned_to = u.user_id) AS assigned_customers,
               u.last_login_at, u.created_at
        FROM dbo.wsm_users u";

    public async Task<IEnumerable<UserRow>> GetAllAsync(int companyId, string? search)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<UserRow>(Select + @"
            WHERE u.company_id = @companyId
              AND (@search IS NULL OR u.full_name LIKE '%' + @search + '%' OR u.email LIKE '%' + @search + '%'
                   OR u.mobile_no LIKE '%' + @search + '%')
            ORDER BY u.is_active DESC, u.full_name",
            new { companyId, search = string.IsNullOrWhiteSpace(search) ? null : search.Trim() });
    }

    public async Task<UserRow?> GetByIdAsync(int companyId, int userId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<UserRow>(
            Select + " WHERE u.company_id = @companyId AND u.user_id = @userId", new { companyId, userId });
    }

    // Email is unique across all companies (admins sign in with it); mobile is unique within a company.
    private static async Task<string?> DuplicateAsync(System.Data.IDbConnection db, int companyId, int userId, SaveUserDto dto)
    {
        if (dto.Email is not null && await db.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM dbo.wsm_users WHERE email = @Email AND user_id <> @userId", new { dto.Email, userId }) > 0)
            return "That email is already registered.";
        if (dto.MobileNo is not null && await db.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM dbo.wsm_users WHERE company_id = @companyId AND mobile_no = @MobileNo AND user_id <> @userId",
                new { companyId, dto.MobileNo, userId }) > 0)
            return "Another staff member already uses that mobile number.";
        return null;
    }

    public async Task<(UserRow?, string?)> CreateAsync(int companyId, SaveUserDto dto, string? passwordHash)
    {
        using var db = _factory.CreateConnection();
        var dup = await DuplicateAsync(db, companyId, 0, dto);
        if (dup is not null) return (null, dup);

        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_users (company_id, full_name, email, mobile_no, password_hash, role, is_active)
            VALUES (@companyId, @FullName, @Email, @MobileNo, @passwordHash, @Role, @IsActive);
            SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new { companyId, dto.FullName, dto.Email, dto.MobileNo, passwordHash, dto.Role, dto.IsActive });
        return (await GetByIdAsync(companyId, id), null);
    }

    public async Task<(UserRow?, string?)> UpdateAsync(int companyId, int userId, SaveUserDto dto, string? passwordHash)
    {
        using var db = _factory.CreateConnection();
        var dup = await DuplicateAsync(db, companyId, userId, dto);
        if (dup is not null) return (null, dup);

        var n = await db.ExecuteAsync(@"
            UPDATE dbo.wsm_users
            SET full_name = @FullName, email = @Email, mobile_no = @MobileNo, role = @Role, is_active = @IsActive,
                password_hash = COALESCE(@passwordHash, password_hash)
            WHERE company_id = @companyId AND user_id = @userId",
            new { companyId, userId, dto.FullName, dto.Email, dto.MobileNo, dto.Role, dto.IsActive, passwordHash });
        return n == 0 ? (null, "Staff member not found.") : (await GetByIdAsync(companyId, userId), null);
    }

    public async Task<bool> IsActiveMemberAsync(int companyId, int userId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM dbo.wsm_users WHERE company_id = @companyId AND user_id = @userId AND is_active = 'T'",
            new { companyId, userId }) > 0;
    }
}
