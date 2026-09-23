using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/whatsapp")]
public class WhatsAppController : ControllerBase
{
    private readonly ISettingsRepository _settings;
    private readonly ICompanyRepository _companies;
    private readonly IWhatsAppService _whatsApp;
    private readonly ILogger<WhatsAppController> _logger;

    public WhatsAppController(ISettingsRepository settings, ICompanyRepository companies,
        IWhatsAppService whatsApp, ILogger<WhatsAppController> logger)
    {
        _settings = settings;
        _companies = companies;
        _whatsApp = whatsApp;
        _logger = logger;
    }

    private async Task<WhatsAppSettingsView> ViewAsync()
    {
        var companyId = User.CompanyId();
        return WhatsAppSettingsView.From(await _companies.GetCodeAsync(companyId) ?? "", await _settings.GetAsync(companyId));
    }

    [HttpGet("settings")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetSettings() => Ok(await ViewAsync());

    [HttpPut("settings")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> SaveSettings([FromBody] SaveWhatsAppSettingsDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var existing = await _settings.GetAsync(User.CompanyId());
        if (string.IsNullOrWhiteSpace(dto.AccessToken) && string.IsNullOrEmpty(existing?.AccessToken))
            return BadRequest(new { message = "Access Token is required." });

        await _settings.SaveAsync(User.CompanyId(), dto);
        return Ok(await ViewAsync());
    }

    [HttpPost("settings/verify")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Verify()
    {
        var settings = await _settings.GetAsync(User.CompanyId());
        if (settings is null) return BadRequest(new { message = "Save the WhatsApp settings first." });

        var (ok, verifiedName, error) = await _whatsApp.VerifyAsync(settings);
        await _settings.SetVerifiedAsync(User.CompanyId(), ok, ok ? verifiedName : null);
        if (!ok) return BadRequest(new { message = $"Verification failed: {error}" });
        return Ok(await ViewAsync());
    }

    // Each company has its own webhook URL, so incoming messages are routed by company code.
    private async Task<WhatsAppSettings?> SettingsForCodeAsync(string companyCode)
    {
        var companyId = await _companies.GetActiveIdByCodeAsync(companyCode);
        return companyId is null ? null : await _settings.GetAsync(companyId.Value);
    }

    // Meta calls this once when the webhook is registered in the App Dashboard.
    [AllowAnonymous]
    [HttpGet("webhook/{companyCode}")]
    public async Task<IActionResult> VerifyWebhook(string companyCode,
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? token,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        var settings = await SettingsForCodeAsync(companyCode);
        if (mode == "subscribe" && !string.IsNullOrEmpty(settings?.VerifyToken) && token == settings.VerifyToken)
            return Content(challenge ?? "", "text/plain");
        return StatusCode(StatusCodes.Status403Forbidden);
    }

    [AllowAnonymous]
    [HttpPost("webhook/{companyCode}")]
    public async Task<IActionResult> ReceiveWebhook(string companyCode)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var settings = await SettingsForCodeAsync(companyCode);
        if (settings is null || string.IsNullOrEmpty(settings.AccessToken)) return Ok();

        if (!_whatsApp.IsValidSignature(settings, body, Request.Headers["X-Hub-Signature-256"]))
            return Unauthorized();

        // Always answer 200 so Meta doesn't keep retrying a payload we can't handle.
        try { await _whatsApp.HandleWebhookAsync(settings, body); }
        catch (Exception ex) { _logger.LogError(ex, "WhatsApp webhook processing failed for {Company}", companyCode); }
        return Ok();
    }
}
