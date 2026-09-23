using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InboxController : ControllerBase
{
    // Meta only allows free-form replies within 24 hours of the customer's last message.
    private static readonly TimeSpan ReplyWindow = TimeSpan.FromHours(24);

    private readonly IInboxRepository _inbox;
    private readonly ICustomerRepository _customers;
    private readonly ISettingsRepository _settings;
    private readonly IWhatsAppService _whatsApp;

    public InboxController(IInboxRepository inbox, ICustomerRepository customers,
        ISettingsRepository settings, IWhatsAppService whatsApp)
    {
        _inbox = inbox;
        _customers = customers;
        _settings = settings;
        _whatsApp = whatsApp;
    }

    private async Task<CustomerRow?> GetAccessibleAsync(int customerId)
    {
        var c = await _customers.GetByIdAsync(User.CompanyId(), customerId);
        return c is not null && (User.IsAdmin() || c.AssignedTo == User.UserId()) ? c : null;
    }

    private static bool WindowOpen(CustomerRow c) =>
        c.LastInboundAt is not null && DateTime.UtcNow - c.LastInboundAt < ReplyWindow;

    // filter: unassigned / unread (admin), staffId: one staff member's chats (admin).
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
        => Ok(await _inbox.CountUnreadChatsAsync(User.CompanyId(), User.IsAdmin() ? null : User.UserId()));

    [HttpGet("conversations/{customerId:int}/messages")]
    public async Task<IActionResult> GetMessages(int customerId)
    {
        var customer = await GetAccessibleAsync(customerId);
        if (customer is null) return NotFound();

        await _inbox.MarkReadAsync(User.CompanyId(), customerId);
        customer.UnreadCount = 0;
        return Ok(new
        {
            customer,
            canReply = WindowOpen(customer),
            messages = await _inbox.GetMessagesAsync(User.CompanyId(), customerId)
        });
    }

    [HttpPost("conversations/{customerId:int}/messages")]
    public async Task<IActionResult> Send(int customerId, [FromBody] SendMessageDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var text = dto.Text.Trim();
        if (text.Length == 0) return BadRequest(new { message = "Message is empty." });

        var customer = await GetAccessibleAsync(customerId);
        if (customer is null) return NotFound();
        if (!WindowOpen(customer))
            return BadRequest(new { message = "The 24-hour reply window has closed. The customer must message you first." });

        var settings = await _settings.GetAsync(User.CompanyId());
        if (settings is null || string.IsNullOrEmpty(settings.AccessToken) || string.IsNullOrEmpty(settings.PhoneNumberId))
            return BadRequest(new { message = "WhatsApp is not configured. Ask your admin to fill in WhatsApp Settings." });

        var (ok, error) = await _whatsApp.SendFromStaffAsync(settings, customer, text, User.UserId());
        return ok ? Ok() : BadRequest(new { message = $"WhatsApp did not accept the message: {error}" });
    }
}
