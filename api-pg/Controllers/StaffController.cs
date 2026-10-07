using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = Roles.Admin)]
public class StaffController : ControllerBase
{
    private readonly IUserRepository _repo;
    public StaffController(IUserRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
        => Ok(await _repo.GetAllAsync(User.CompanyId(), search));

    // Admins sign in with email; staff sign in with the admin's email + their own mobile number.
    private static string? MissingLogin(SaveUserDto dto) =>
        dto.Role == Roles.Admin && dto.Email is null ? "Email is required for an admin."
        : dto.Role == Roles.Staff && dto.MobileNo is null ? "Mobile number is required for staff — they sign in with it."
        : null;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveUserDto dto)
    {
        dto = Clean(dto);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (MissingLogin(dto) is { } missing) return BadRequest(new { message = missing });
        if (string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Password is required for a new staff member." });

        var (row, error) = await _repo.CreateAsync(User.CompanyId(), Clean(dto), BCrypt.Net.BCrypt.HashPassword(dto.Password));
        return error is not null ? Conflict(new { message = error }) : Ok(row);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveUserDto dto)
    {
        dto = Clean(dto);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (MissingLogin(dto) is { } missing) return BadRequest(new { message = missing });
        // Stop an admin from locking themselves out.
        if (id == User.UserId() && (dto.IsActive != "T" || dto.Role != Roles.Admin))
            return BadRequest(new { message = "You can't deactivate your own account or remove your own admin role." });

        var hash = string.IsNullOrWhiteSpace(dto.Password) ? null : BCrypt.Net.BCrypt.HashPassword(dto.Password);
        var (row, error) = await _repo.UpdateAsync(User.CompanyId(), id, Clean(dto), hash);
        return error is not null ? Conflict(new { message = error }) : Ok(row);
    }

    private static SaveUserDto Clean(SaveUserDto dto)
    {
        dto.FullName = dto.FullName.Trim();
        dto.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        dto.MobileNo = string.IsNullOrWhiteSpace(dto.MobileNo) ? null : new string(dto.MobileNo.Where(char.IsDigit).ToArray());
        return dto;
    }
}
