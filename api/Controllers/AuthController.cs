using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthRepository _repo;
    private readonly ITokenService _tokens;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthRepository repo, ITokenService tokens, IEmailService email,
        IConfiguration config, ILogger<AuthController> logger)
    {
        _repo = repo;
        _tokens = tokens;
        _email = email;
        _config = config;
        _logger = logger;
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    // Super admins can always get in so they can re-activate companies.
    private static string? BlockReason(AuthUser user)
    {
        if (user.IsActive != "T") return "Your account is inactive. Contact your admin.";
        if (user.IsSuperAdmin == "T") return null;
        return user.CompanyStatus switch
        {
            "ACTIVE" => null,
            "PENDING" => "Your company is waiting for approval. You will be able to sign in once it is approved.",
            _ => "Your company account is suspended. Contact support."
        };
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (user, hash) = await _repo.GetByEmailAsync(dto.Email.Trim());
        return await SignInAsync(user, hash, dto.Password, "Invalid email or password.");
    }

    [AllowAnonymous]
    [HttpPost("staff-login")]
    public async Task<IActionResult> StaffLogin([FromBody] StaffLoginDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var mobile = new string(dto.MobileNo.Where(char.IsDigit).ToArray());
        var (user, hash) = await _repo.GetByCompanyMobileAsync(dto.AdminEmail.Trim(), mobile);
        return await SignInAsync(user, hash, dto.Password, "Invalid admin email, mobile number or password.");
    }

    // One generic failure message so we don't reveal which accounts exist.
    private async Task<IActionResult> SignInAsync(AuthUser? user, string? hash, string password, string failure)
    {
        if (user is null || string.IsNullOrEmpty(hash) || !BCrypt.Net.BCrypt.Verify(password, hash))
            return Unauthorized(new { message = failure });

        var blocked = BlockReason(user);
        if (blocked is not null) return StatusCode(StatusCodes.Status403Forbidden, new { message = blocked });

        await _repo.TouchLoginAsync(user.UserId);
        var (token, expires) = _tokens.Create(user);
        return Ok(new AuthResponse { Token = token, ExpiresAt = expires, User = user });
    }

    [AllowAnonymous]
    [HttpPost("signup")]
    public async Task<IActionResult> Signup([FromBody] SignupDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var error = await _repo.SignupAsync(dto, BCrypt.Net.BCrypt.HashPassword(dto.Password));
        if (error is not null) return Conflict(new { message = error });
        return Ok(new { message = "Your company has been registered and is waiting for approval." });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _repo.GetByIdAsync(User.UserId());
        if (user is null || BlockReason(user) is not null) return Unauthorized();
        return Ok(user);
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (user, _) = await _repo.GetByEmailAsync(dto.Email.Trim());
        // Same response either way so we don't reveal which emails exist.
        if (user is null || user.IsActive != "T" || user.Email is null) return Ok();

        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        await _repo.CreateResetTokenAsync(user.UserId, HashToken(token), DateTime.UtcNow.AddMinutes(30));

        var baseUrl = (_config["App:FrontendUrl"] ?? "http://localhost:5098").TrimEnd('/');
        var link = $"{baseUrl}/login?reset={token}";
        var body = $@"
            <p>Hi {WebUtility.HtmlEncode(user.FullName)},</p>
            <p>We received a request to reset your iStreams CRM password. Click the link below to choose a new one:</p>
            <p><a href=""{link}"">Reset my password</a></p>
            <p>This link expires in 30 minutes. If you didn't ask for this, you can ignore this email.</p>";

        try
        {
            await _email.SendAsync(user.Email, "Reset your iStreams CRM password", body);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Password reset email to {Email} failed", user.Email);
            return Problem("Could not send the reset email. Please try again later or contact your admin.");
        }
        return Ok();
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var ok = await _repo.ResetPasswordAsync(HashToken(dto.Token), BCrypt.Net.BCrypt.HashPassword(dto.Password));
        return ok ? Ok() : BadRequest(new { message = "This reset link is invalid or has expired." });
    }
}
