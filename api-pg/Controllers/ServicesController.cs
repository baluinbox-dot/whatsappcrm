using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly IServiceRepository _repo;
    public ServicesController(IServiceRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? category)
        => Ok(await _repo.GetAllAsync(User.CompanyId(), search, category));

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Create([FromBody] SaveServiceDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await _repo.CreateAsync(User.CompanyId(), Clean(dto)));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Update(int id, [FromBody] SaveServiceDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var row = await _repo.UpdateAsync(User.CompanyId(), id, Clean(dto));
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
        => await _repo.DeleteAsync(User.CompanyId(), id) ? NoContent() : NotFound();

    private static SaveServiceDto Clean(SaveServiceDto dto)
    {
        dto.ServiceName = dto.ServiceName.Trim();
        dto.Category = dto.Category.Trim();
        dto.PriceNote = string.IsNullOrWhiteSpace(dto.PriceNote) ? null : dto.PriceNote.Trim();
        dto.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        return dto;
    }
}
