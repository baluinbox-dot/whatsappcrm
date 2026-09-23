using Dapper;
using WhatsAppCrm.Api.Data;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Repositories;

public interface INoteRepository
{
    Task<IEnumerable<NoteRow>> GetAllAsync(int companyId, string? search);
    Task<NoteRow?> GetByIdAsync(int companyId, int noteId);
    Task<NoteRow?> CreateAsync(int companyId, SaveNoteDto dto, int userId);
    Task<NoteRow?> UpdateAsync(int companyId, int noteId, SaveNoteDto dto, int userId);
    Task<bool> DeleteAsync(int companyId, int noteId);
}

public class NoteRepository : INoteRepository
{
    private readonly IDbConnectionFactory _factory;
    public NoteRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Select = @"
        SELECT n.note_id, n.title, n.content, n.created_at, n.updated_at,
               c.full_name AS created_by_name, u.full_name AS updated_by_name
        FROM dbo.wsm_notes n
        LEFT JOIN dbo.wsm_users c ON c.user_id = n.created_by
        LEFT JOIN dbo.wsm_users u ON u.user_id = n.updated_by";

    public async Task<IEnumerable<NoteRow>> GetAllAsync(int companyId, string? search)
    {
        using var db = _factory.CreateConnection();
        return await db.QueryAsync<NoteRow>(Select + @"
            WHERE n.company_id = @companyId
              AND (@search IS NULL OR n.title LIKE '%' + @search + '%' OR n.content LIKE '%' + @search + '%')
            ORDER BY n.updated_at DESC",
            new { companyId, search = string.IsNullOrWhiteSpace(search) ? null : search.Trim() });
    }

    public async Task<NoteRow?> GetByIdAsync(int companyId, int noteId)
    {
        using var db = _factory.CreateConnection();
        return await db.QuerySingleOrDefaultAsync<NoteRow>(
            Select + " WHERE n.company_id = @companyId AND n.note_id = @noteId", new { companyId, noteId });
    }

    public async Task<NoteRow?> CreateAsync(int companyId, SaveNoteDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        var id = await db.ExecuteScalarAsync<int>(@"
            INSERT INTO dbo.wsm_notes (company_id, title, content, created_by, updated_by)
            VALUES (@companyId, @Title, @Content, @userId, @userId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);", new { companyId, dto.Title, dto.Content, userId });
        return await GetByIdAsync(companyId, id);
    }

    public async Task<NoteRow?> UpdateAsync(int companyId, int noteId, SaveNoteDto dto, int userId)
    {
        using var db = _factory.CreateConnection();
        var n = await db.ExecuteAsync(@"
            UPDATE dbo.wsm_notes SET title = @Title, content = @Content, updated_by = @userId, updated_at = SYSUTCDATETIME()
            WHERE company_id = @companyId AND note_id = @noteId", new { companyId, noteId, dto.Title, dto.Content, userId });
        return n == 0 ? null : await GetByIdAsync(companyId, noteId);
    }

    public async Task<bool> DeleteAsync(int companyId, int noteId)
    {
        using var db = _factory.CreateConnection();
        return await db.ExecuteAsync("DELETE FROM dbo.wsm_notes WHERE company_id = @companyId AND note_id = @noteId",
            new { companyId, noteId }) > 0;
    }
}
