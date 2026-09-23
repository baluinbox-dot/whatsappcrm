using System.Net;
using System.Net.Mail;

namespace WhatsAppCrm.Api.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string htmlBody);
}

// Gmail: Host smtp.gmail.com, Port 587, User = the Gmail address, Password = a 16-char App Password.
public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    public SmtpEmailService(IConfiguration config) => _config = config;

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var smtp = _config.GetSection("Smtp");
        var user = smtp["User"];
        var password = smtp["Password"];
        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Smtp:User / Smtp:Password are not configured.");

        var from = string.IsNullOrWhiteSpace(smtp["From"]) ? user : smtp["From"]!;

        using var message = new MailMessage
        {
            From = new MailAddress(from, smtp["FromName"] ?? "WhatsApp CRM"),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(to);

        using var client = new SmtpClient(smtp["Host"] ?? "smtp.gmail.com", smtp.GetValue("Port", 587))
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(user, password)
        };
        await client.SendMailAsync(message);
    }
}
