using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/email")]
public class EmailController : ControllerBase
{
    private readonly IEmailSettingsRepository _settings;
    private readonly IEmailInboxRepository _inbox;
    private readonly ICustomerRepository _customers;
    private readonly IMailboxService _mailbox;

    public EmailController(IEmailSettingsRepository settings, IEmailInboxRepository inbox,
        ICustomerRepository customers, IMailboxService mailbox)
    {
        _settings = settings;
        _inbox = inbox;
        _customers = customers;
        _mailbox = mailbox;
    }

    private async Task<CustomerRow?> GetAccessibleAsync(int customerId)
    {
        var c = await _customers.GetByIdAsync(User.CompanyId(), customerId);
        return c is not null && (User.IsAdmin() || c.AssignedTo == User.UserId()) ? c : null;
    }

    [HttpGet("settings")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetSettings() => Ok(EmailSettingsView.From(await _settings.GetAsync(User.CompanyId())));

    [HttpPut("settings")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> SaveSettings([FromBody] SaveEmailSettingsDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var existing = await _settings.GetAsync(User.CompanyId());
        if (string.IsNullOrWhiteSpace(dto.Password) && string.IsNullOrEmpty(existing?.Password))
            return BadRequest(new { message = "Password is required." });

        await _settings.SaveAsync(User.CompanyId(), dto);
        return Ok(EmailSettingsView.From(await _settings.GetAsync(User.CompanyId())));
    }

    [HttpPost("settings/verify")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Verify()
    {
        var settings = await _settings.GetAsync(User.CompanyId());
        if (settings is null) return BadRequest(new { message = "Save the email settings first." });

        var (ok, error) = await _mailbox.VerifyAsync(settings);
        await _settings.SetVerifiedAsync(User.CompanyId(), ok, error);
        if (!ok) return BadRequest(new { message = $"Connection failed: {error}" });
        return Ok(EmailSettingsView.From(await _settings.GetAsync(User.CompanyId())));
    }

    // filter: unassigned / unread (admin), staffId: one staff member's mail (admin).
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations([FromQuery] string? filter, [FromQuery] int? staffId, [FromQuery] string? search)
    {
        var admin = User.IsAdmin();
        var f = filter is "unassigned" or "unread" ? filter : null;
        if (!admin && f == "unassigned") f = null;
        return Ok(await _inbox.GetConversationsAsync(User.CompanyId(), admin ? null : User.UserId(), f, admin ? staffId : null, search));
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
        => Ok(await _inbox.CountUnreadAsync(User.CompanyId(), User.IsAdmin() ? null : User.UserId()));

    [HttpGet("conversations/{customerId:int}/emails")]
    public async Task<IActionResult> GetEmails(int customerId)
    {
        var customer = await GetAccessibleAsync(customerId);
        if (customer is null) return NotFound();

        await _inbox.MarkReadAsync(User.CompanyId(), customerId);
        customer.EmailUnreadCount = 0;
        return Ok(new { customer, emails = await _inbox.GetEmailsAsync(User.CompanyId(), customerId) });
    }

    [HttpPost("conversations/{customerId:int}/emails")]
    public async Task<IActionResult> Send(int customerId, [FromBody] SendEmailDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var subject = dto.Subject.Trim();
        var body = dto.Body.Trim();
        if (subject.Length == 0 || body.Length == 0) return BadRequest(new { message = "Subject and message are required." });

        var customer = await GetAccessibleAsync(customerId);
        if (customer is null) return NotFound();
        if (string.IsNullOrWhiteSpace(customer.Email)) return BadRequest(new { message = "This customer has no email ID." });

        var settings = await _settings.GetAsync(User.CompanyId());
        if (settings is null || settings.IsVerified != "T")
            return BadRequest(new { message = "Email is not connected. Ask your admin to set up Email Settings." });

        var (ok, error) = await _mailbox.SendAsync(settings, customer, subject, body, User.UserId());
        return ok ? Ok() : BadRequest(new { message = $"Email was not sent: {error}" });
    }
}
