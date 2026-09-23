using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardRepository _repo;
    public DashboardController(IDashboardRepository repo) => _repo = repo;

    // tzOffset: the browser's getTimezoneOffset() in minutes, so "today" means the user's local day.
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int tzOffset = 0)
    {
        var localNow = DateTime.UtcNow.AddMinutes(-tzOffset);
        var todayStartUtc = localNow.Date.AddMinutes(tzOffset);
        var companyId = User.CompanyId();
        var admin = User.IsAdmin();

        return Ok(new
        {
            stats = await _repo.GetStatsAsync(companyId, admin ? null : User.UserId(), todayStartUtc),
            staff = admin ? await _repo.GetStaffLoadAsync(companyId, todayStartUtc) : null
        });
    }
}
