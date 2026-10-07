using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Services;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) Create(AuthUser user);
}

public class TokenService : ITokenService
{
    public const string CompanyClaim = "companyId";
    public const string SuperAdminClaim = "superAdmin";

    private readonly IConfiguration _config;
    public TokenService(IConfiguration config) => _config = config;

    public (string, DateTime) Create(AuthUser user)
    {
        var key = _config["Jwt:Key"];
        var minutes = int.TryParse(_config["Jwt:ExpiryMinutes"], out var m) ? m : 480;
        var expires = DateTime.UtcNow.AddMinutes(minutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email ?? ""),
            new(ClaimTypes.Role, user.Role),
            new(CompanyClaim, user.CompanyId.ToString()),
            new(SuperAdminClaim, user.IsSuperAdmin),
        };

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key!)), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
