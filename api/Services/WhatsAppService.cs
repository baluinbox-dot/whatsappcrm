using System.Net.Http.Headers;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;

namespace WhatsAppCrm.Api.Services;

public interface IWhatsAppService
{
    Task<(bool Ok, string? VerifiedName, string? Error)> VerifyAsync(WhatsAppSettings settings);
    bool IsValidSignature(WhatsAppSettings settings, string body, string? signatureHeader);
    Task HandleWebhookAsync(WhatsAppSettings settings, string body);
    Task<(bool Ok, string? Error)> SendFromStaffAsync(WhatsAppSettings settings, CustomerRow customer, string text, int staffId);
}

public class WhatsAppService : IWhatsAppService
{
    private static readonly string[] Greetings = { "hi", "hii", "hello", "hey", "hai" };

    private readonly HttpClient _http;
    private readonly ICustomerRepository _customers;
    private readonly IInboxRepository _inbox;
    private readonly ILogger<WhatsAppService> _logger;
    private readonly string _graphBase;

    public WhatsAppService(HttpClient http, ICustomerRepository customers, IInboxRepository inbox,
        IConfiguration config, ILogger<WhatsAppService> logger)
    {
        _http = http;
        _customers = customers;
        _inbox = inbox;
        _logger = logger;
        _graphBase = $"https://graph.facebook.com/{config["WhatsApp:GraphVersion"] ?? "v23.0"}";
    }

    public async Task<(bool, string?, string?)> VerifyAsync(WhatsAppSettings s)
    {
        if (string.IsNullOrWhiteSpace(s.PhoneNumberId) || string.IsNullOrWhiteSpace(s.AccessToken))
            return (false, null, "Phone Number ID and Access Token are required.");

        using var req = new HttpRequestMessage(HttpMethod.Get,
            $"{_graphBase}/{Uri.EscapeDataString(s.PhoneNumberId)}?fields=display_phone_number,verified_name");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", s.AccessToken);

        using var res = await _http.SendAsync(req);
        var root = Parse(await res.Content.ReadAsStringAsync());
        if (!res.IsSuccessStatusCode) return (false, null, ErrorMessage(root) ?? res.ReasonPhrase);

        var name = root.TryGetProperty("verified_name", out var vn) ? vn.GetString() : null;
        var number = root.TryGetProperty("display_phone_number", out var dn) ? dn.GetString() : null;
        return (true, string.Join(" · ", new[] { name, number }.Where(x => !string.IsNullOrEmpty(x))), null);
    }

    public bool IsValidSignature(WhatsAppSettings s, string body, string? signatureHeader)
    {
        if (string.IsNullOrEmpty(s.AppSecret)) return true;
        if (string.IsNullOrEmpty(signatureHeader) || !signatureHeader.StartsWith("sha256=")) return false;

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(s.AppSecret), Encoding.UTF8.GetBytes(body));
        byte[] given;
        try { given = Convert.FromHexString(signatureHeader["sha256=".Length..]); }
        catch (FormatException) { return false; }
        return CryptographicOperations.FixedTimeEquals(expected, given);
    }

    public async Task HandleWebhookAsync(WhatsAppSettings settings, string body)
    {
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("entry", out var entries)) return;

        foreach (var entry in entries.EnumerateArray())
        foreach (var change in entry.GetProperty("changes").EnumerateArray())
        {
            var value = change.GetProperty("value");

            // Only handle events for this company's number.
            if (value.TryGetProperty("metadata", out var meta)
                && meta.TryGetProperty("phone_number_id", out var pid)
                && pid.GetString() != settings.PhoneNumberId) continue;

            if (value.TryGetProperty("statuses", out var statuses))
                foreach (var st in statuses.EnumerateArray())
                    await HandleStatusAsync(settings.CompanyId, st);

            if (!value.TryGetProperty("messages", out var messages)) continue;

            string? profileName = null;
            if (value.TryGetProperty("contacts", out var contacts) && contacts.GetArrayLength() > 0
                && contacts[0].TryGetProperty("profile", out var profile)
                && profile.TryGetProperty("name", out var pn))
                profileName = pn.GetString();

            foreach (var msg in messages.EnumerateArray())
            {
                var from = msg.GetProperty("from").GetString()!;
                var id = msg.GetProperty("id").GetString()!;
                var type = msg.GetProperty("type").GetString() ?? "unknown";
                var text = type == "text"
                    ? msg.GetProperty("text").GetProperty("body").GetString()?.Trim() ?? ""
                    : "";
                await HandleMessageAsync(settings, from, profileName, id, type, text);
            }
        }
    }

    private async Task HandleStatusAsync(int companyId, JsonElement st)
    {
        var id = st.GetProperty("id").GetString();
        var status = st.GetProperty("status").GetString();
        if (id is null || status is null) return;

        string? error = null;
        if (st.TryGetProperty("errors", out var errors) && errors.GetArrayLength() > 0)
        {
            var e = errors[0];
            error = e.TryGetProperty("message", out var m) ? m.GetString()
                  : e.TryGetProperty("title", out var t) ? t.GetString() : null;
        }
        await _inbox.UpdateStatusAsync(companyId, id, status, error);
    }

    private async Task HandleMessageAsync(WhatsAppSettings s, string from, string? profileName, string messageId, string type, string text)
    {
        var customer = await _customers.GetByMobileAsync(s.CompanyId, from);
        var isNew = customer is null;
        customer ??= await _customers.StartChatAsync(s.CompanyId, from, profileName);

        // Meta retries webhooks, so a message already stored is ignored.
        if (!await _inbox.AddInboundAsync(s.CompanyId, customer.CustomerId, messageId, type, type == "text" ? text : null)) return;

        if (isNew)
        {
            await BotReplyAsync(s, customer, "Welcome! 👋 Please share your *name*.");
            return;
        }

        switch (customer.ChatState)
        {
            case "ASK_NAME":
                if (text.Length == 0)
                {
                    await BotReplyAsync(s, customer, "Please type your *name*.");
                    return;
                }
                var name = text.Length > 150 ? text[..150] : text;
                await _customers.UpdateChatAsync(customer.CustomerId, "ASK_EMAIL", name, customer.Email);
                await BotReplyAsync(s, customer, $"Thanks {name}! Please share your *email ID*.");
                return;

            case "ASK_EMAIL":
                var valid = IsEmail(text);
                await _customers.UpdateChatAsync(customer.CustomerId, valid ? "DONE" : "ASK_EMAIL",
                    customer.CustomerName, valid ? text : customer.Email);
                await BotReplyAsync(s, customer, valid
                    ? $"Thank you {customer.CustomerName}! ✅ Your details are saved. Our team will contact you soon."
                    : "That doesn't look like a valid email ID. Please try again (e.g. name@example.com).");
                return;

            default:
                // Once a staff member owns the chat, the bot stays quiet.
                if (customer.AssignedTo is null && Greetings.Contains(text.ToLowerInvariant().TrimEnd('!', '.', ' ')))
                    await BotReplyAsync(s, customer, $"Hi {customer.CustomerName}! 👋 We already have your details. Our team will get back to you soon.");
                return;
        }
    }

    public async Task<(bool, string?)> SendFromStaffAsync(WhatsAppSettings s, CustomerRow customer, string text, int staffId)
    {
        var (ok, waId, error) = await SendTextAsync(s, customer.MobileNo, text);
        await _inbox.AddOutboundAsync(s.CompanyId, customer.CustomerId, waId, text, ok, error, staffId, isBot: false);
        return (ok, error);
    }

    private async Task BotReplyAsync(WhatsAppSettings s, CustomerRow customer, string text)
    {
        var (ok, waId, error) = await SendTextAsync(s, customer.MobileNo, text);
        await _inbox.AddOutboundAsync(s.CompanyId, customer.CustomerId, waId, text, ok, error, null, isBot: true);
    }

    private static bool IsEmail(string text)
    {
        if (text.Length > 150 || text.Contains(' ')) return false;
        try { return new MailAddress(text).Address == text && text.Contains('.'); }
        catch (FormatException) { return false; }
    }

    private static JsonElement Parse(string json)
    {
        try { return JsonDocument.Parse(json).RootElement; }
        catch (JsonException) { return default; }
    }

    private static string? ErrorMessage(JsonElement root) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var err)
        && err.TryGetProperty("message", out var m) ? m.GetString() : null;

    private async Task<(bool Ok, string? WaMessageId, string? Error)> SendTextAsync(WhatsAppSettings s, string to, string body)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_graphBase}/{Uri.EscapeDataString(s.PhoneNumberId!)}/messages")
        {
            Content = JsonContent.Create(new { messaging_product = "whatsapp", to, type = "text", text = new { body } })
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", s.AccessToken);

        using var res = await _http.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();
        var root = Parse(json);

        if (!res.IsSuccessStatusCode)
        {
            _logger.LogError("WhatsApp send to {To} failed: {Status} {Body}", to, (int)res.StatusCode, json);
            return (false, null, ErrorMessage(root) ?? res.ReasonPhrase);
        }

        var waId = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("messages", out var msgs) && msgs.GetArrayLength() > 0
            ? msgs[0].GetProperty("id").GetString() : null;
        return (true, waId, null);
    }
}
