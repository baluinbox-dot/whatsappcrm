using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/superadmin")]
[Authorize(Policy = "SuperAdmin")]
public class SuperAdminController : ControllerBase
{
    private readonly ICompanyRepository _repo;
    public SuperAdminController(ICompanyRepository repo) => _repo = repo;

    [HttpGet("companies")]
    public async Task<IActionResult> GetCompanies([FromQuery] string? search, [FromQuery] string? status)
        => Ok(await _repo.GetAllAsync(search, status));

    [HttpPut("companies/{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetCompanyStatusDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return await _repo.SetStatusAsync(id, dto.Status) ? NoContent() : NotFound();
    }
}
