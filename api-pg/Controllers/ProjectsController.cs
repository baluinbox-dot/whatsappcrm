using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository _repo;
    public ProjectsController(IProjectRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProjectFilter filter)
        => Ok(await _repo.GetAllAsync(User.CompanyId(), filter));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var row = await _repo.GetByIdAsync(User.CompanyId(), id);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Create([FromBody] SaveProjectDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var error = Clean(dto);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(await _repo.CreateAsync(User.CompanyId(), dto, User.UserId()));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Update(int id, [FromBody] SaveProjectDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var error = Clean(dto);
        if (error is not null) return BadRequest(new { message = error });
        var row = await _repo.UpdateAsync(User.CompanyId(), id, dto);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
        => await _repo.DeleteAsync(User.CompanyId(), id) ? NoContent() : NotFound();

    private static string? Clean(SaveProjectDto dto)
    {
        static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        dto.ProjectName = dto.ProjectName.Trim();
        dto.Emirate = dto.Emirate.Trim();
        dto.Description = Blank(dto.Description);
        dto.Developer = Blank(dto.Developer);
        dto.Community = Blank(dto.Community);
        dto.MapUrl = Blank(dto.MapUrl);
        dto.Amenities = Blank(dto.Amenities);
        dto.PaymentPlan = Blank(dto.PaymentPlan);
        dto.Payments = dto.Payments.Where(p => !string.IsNullOrWhiteSpace(p.Label)).ToList();
        foreach (var p in dto.Payments)
        {
            p.Label = p.Label.Trim();
            p.DueNote = Blank(p.DueNote);
        }
        if (dto.Completion == "READY") dto.CompletionPct = null;
        if (dto.Payments.Count > 0 && dto.Payments.Sum(p => p.PercentDue) != 100)
            return "The payment schedule must add up to 100%.";
        return null;
    }
}
