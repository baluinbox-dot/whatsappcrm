using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotesController : ControllerBase
{
    private readonly INoteRepository _repo;
    public NotesController(INoteRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
        => Ok(await _repo.GetAllAsync(User.CompanyId(), search));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveNoteDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await _repo.CreateAsync(User.CompanyId(), dto, User.UserId()));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveNoteDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var row = await _repo.UpdateAsync(User.CompanyId(), id, dto, User.UserId());
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await _repo.DeleteAsync(User.CompanyId(), id) ? NoContent() : NotFound();
}
