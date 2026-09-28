using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/follow-ups")]
public class FollowUpsController : ControllerBase
{
    private readonly IFollowUpRepository _repo;
    private readonly ILeadRepository _leads;

    public FollowUpsController(IFollowUpRepository repo, ILeadRepository leads)
    {
        _repo = repo;
        _leads = leads;
    }

    private int? Scope => User.IsAdmin() ? null : User.UserId();

    private async Task<FollowUpRow?> GetAccessibleAsync(int id)
    {
        var f = await _repo.GetByIdAsync(User.CompanyId(), id);
        if (f is null || User.IsAdmin() || f.AssignedTo == User.UserId()) return f;
        var lead = await _leads.GetByIdAsync(User.CompanyId(), f.LeadId);
        return lead?.AssignedTo == User.UserId() ? f : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? view, [FromQuery] int tzOffset, [FromQuery] int? assignedTo)
        => Ok(await _repo.GetListAsync(User.CompanyId(), Scope,
            view is "overdue" or "today" or "upcoming" or "done" ? view : "today", tzOffset, assignedTo));

    [HttpGet("counts")]
    public async Task<IActionResult> Counts([FromQuery] int tzOffset)
    {
        var (overdue, today) = await _repo.CountsAsync(User.CompanyId(), Scope, tzOffset);
        return Ok(new { overdue, today });
    }

    [HttpPut("{id:int}/done")]
    public async Task<IActionResult> Complete(int id, [FromBody] CompleteFollowUpDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var f = await GetAccessibleAsync(id);
        if (f is null) return NotFound();
        await _repo.CompleteAsync(User.CompanyId(), f, dto.Result, User.UserId());
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await GetAccessibleAsync(id) is null) return NotFound();
        await _repo.DeleteAsync(User.CompanyId(), id);
        return NoContent();
    }
}
