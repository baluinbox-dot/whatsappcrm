using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly ICustomerRepository _repo;
    private readonly IUserRepository _users;

    public CustomersController(ICustomerRepository repo, IUserRepository users)
    {
        _repo = repo;
        _users = users;
    }

    // Staff only ever see customers assigned to them.
    private int? Scope => User.IsAdmin() ? null : User.UserId();

    private async Task<CustomerRow?> GetAccessibleAsync(int id)
    {
        var c = await _repo.GetByIdAsync(User.CompanyId(), id);
        return c is not null && (User.IsAdmin() || c.AssignedTo == User.UserId()) ? c : null;
    }

    private static string? Check(SaveCustomerDto dto)
    {
        dto.MobileNo = string.IsNullOrWhiteSpace(dto.MobileNo) ? null : dto.MobileNo.Trim();
        dto.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        return dto.MobileNo is null && dto.Email is null ? "Enter a mobile number or an email ID." : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? filter)
        => Ok(await _repo.GetAllAsync(User.CompanyId(), Scope, search, filter is "unassigned" or "assigned" ? filter : null));

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Create([FromBody] SaveCustomerDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (Check(dto) is { } invalid) return BadRequest(new { message = invalid });
        var (row, error) = await _repo.CreateAsync(User.CompanyId(), dto);
        return error is not null ? Conflict(new { message = error }) : Ok(row);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveCustomerDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (Check(dto) is { } invalid) return BadRequest(new { message = invalid });
        if (await GetAccessibleAsync(id) is null) return NotFound();
        var (row, error) = await _repo.UpdateAsync(User.CompanyId(), id, dto);
        return error is not null ? Conflict(new { message = error }) : Ok(row);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
        => await _repo.DeleteAsync(User.CompanyId(), id) ? NoContent() : NotFound();

    [HttpPut("{id:int}/assign")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignDto dto)
    {
        if (await _repo.GetByIdAsync(User.CompanyId(), id) is null) return NotFound();
        if (dto.UserId is not null && !await _users.IsActiveMemberAsync(User.CompanyId(), dto.UserId.Value))
            return BadRequest(new { message = "Choose an active staff member of your company." });

        await _repo.AssignAsync(User.CompanyId(), id, dto.UserId, User.UserId());
        return Ok(await _repo.GetByIdAsync(User.CompanyId(), id));
    }

    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> History(int id)
    {
        if (await GetAccessibleAsync(id) is null) return NotFound();
        return Ok(await _repo.GetAssignmentHistoryAsync(User.CompanyId(), id));
    }
}
