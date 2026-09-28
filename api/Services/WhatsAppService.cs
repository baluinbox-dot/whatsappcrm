using System.Net.Http.Headers;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;

namespace WhatsAppCrm.Api.Services;

public interface IWhatsAppService
{
    Task<(bool Ok, string? VerifiedName, string? Error)> VerifyAsync(WhatsAppSettings settings);
    bool IsValidSignature(WhatsAppSettings settings, string body, string? signatureHeader);
    Task HandleWebhookAsync(WhatsAppSettings settings, string body);
    Task<(bool Ok, string? Error)> SendFromStaffAsync(WhatsAppSettings settings, CustomerRow customer, string text, int staffId);
    Task<(bool Ok, string? Error)> SendPropertyAsync(WhatsAppSettings settings, CustomerRow customer, string? imageUrl, string caption, int staffId);
}

public class WhatsAppService : IWhatsAppService
{
    private static readonly string[] Greetings = { "hi", "hii", "hello", "hey", "hai" };

    private readonly HttpClient _http;
    private readonly ICustomerRepository _customers;
    private readonly IInboxRepository _inbox;
    private readonly ILeadRepository _leads;
    private readonly ILogger<WhatsAppService> _logger;
    private readonly string _graphBase;

    public WhatsAppService(HttpClient http, ICustomerRepository customers, IInboxRepository inbox, ILeadRepository leads,
        IConfiguration config, ILogger<WhatsAppService> logger)
    {
        _http = http;
        _customers = customers;
        _inbox = inbox;
        _leads = leads;
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
                await _customers.UpdateChatAsync(customer.CustomerId, valid ? "ASK_PURPOSE" : "ASK_EMAIL",
                    customer.CustomerName, valid ? text : customer.Email);
                await BotReplyAsync(s, customer, valid
                    ? $"Thank you {customer.CustomerName}! ✅ {AskPurpose}"
                    : "That doesn't look like a valid email ID. Please try again (e.g. name@example.com).");
                return;

            // The next three questions build a lead (unassigned) for the admin to hand to an agent.
            case "ASK_PURPOSE":
                var purpose = text.Trim() switch { "1" => "BUY", "2" => "RENT", _ => LeadImportParser.Purpose(text) };
                if (purpose is null)
                {
                    await BotReplyAsync(s, customer, "Please reply *1* for Buy or *2* for Rent.");
                    return;
                }
                var lead = await _leads.CreateAsync(s.CompanyId, customer.CustomerId,
                    new SaveLeadDto { Source = "WHATSAPP", Purpose = purpose, Priority = "WARM" }, null);
                await _customers.SetBotLeadAsync(customer.CustomerId, "ASK_AREA", lead!.LeadId);
                await BotReplyAsync(s, customer, "Which *area or community* are you interested in? (e.g. Dubai Marina, JVC, Downtown)");
                return;

            case "ASK_AREA":
                var areaLead = customer.BotLeadId is null ? null : await _leads.GetByIdAsync(s.CompanyId, customer.BotLeadId.Value);
                if (areaLead is null) { await _customers.SetBotLeadAsync(customer.CustomerId, "DONE", null); return; }
                if (text.Length == 0)
                {
                    await BotReplyAsync(s, customer, "Please type the *area or community* you like (or *any*).");
                    return;
                }
                var area = text.Trim().ToLowerInvariant() is "any" or "skip" or "anywhere" ? null : LeadImportParser.Text(text, 500);
                await _leads.UpdateFromBotAsync(areaLead.LeadId, area, LeadImportParser.Emirate(area), null, null);
                await _customers.SetBotLeadAsync(customer.CustomerId, "ASK_BUDGET", areaLead.LeadId);
                await BotReplyAsync(s, customer, areaLead.Purpose == "RENT"
                    ? "What is your *yearly rent budget* in AED? (e.g. 120k)"
                    : "What is your *budget* in AED? (e.g. 1.5M)");
                return;

            case "ASK_BUDGET":
                if (customer.BotLeadId is not null)
                {
                    var amount = LeadImportParser.Amount(text);
                    await _leads.UpdateFromBotAsync(customer.BotLeadId.Value, null, null, amount,
                        amount is null && text.Length > 0 ? $"Budget (WhatsApp): {LeadImportParser.Text(text, 200)}" : null);
                }
                await _customers.SetBotLeadAsync(customer.CustomerId, "DONE", null);
                await BotReplyAsync(s, customer,
                    $"Thank you {customer.CustomerName}! ✅ Our property consultant will share matching options with you shortly.");
                return;

            default:
                // Once a staff member owns the chat, the bot stays quiet.
                if (customer.AssignedTo is not null || !Greetings.Contains(text.ToLowerInvariant().TrimEnd('!', '.', ' '))) return;
                if (await _leads.HasOpenLeadAsync(s.CompanyId, customer.CustomerId))
                {
                    await BotReplyAsync(s, customer, $"Hi {customer.CustomerName}! 👋 We already have your details. Our team will get back to you soon.");
                    return;
                }
                await _customers.SetBotLeadAsync(customer.CustomerId, "ASK_PURPOSE", null);
                await BotReplyAsync(s, customer, $"Hi {customer.CustomerName}! 👋 {AskPurpose}");
                return;
        }
    }

    private const string AskPurpose = "Are you looking to *Buy* or *Rent*? Reply *1* for Buy or *2* for Rent.";

    // One property per message: the cover photo with the details as its caption, or text when there is no photo.
    public async Task<(bool, string?)> SendPropertyAsync(WhatsAppSettings s, CustomerRow customer, string? imageUrl, string caption, int staffId)
    {
        var (ok, waId, error) = imageUrl is null
            ? await SendTextAsync(s, customer.MobileNo!, caption)
            : await SendAsync(s, customer.MobileNo!, new { type = "image", image = new { link = imageUrl, caption } });
        await _inbox.AddOutboundAsync(s.CompanyId, customer.CustomerId, waId, caption, ok, error, staffId, isBot: false);
        return (ok, error);
    }

    public async Task<(bool, string?)> SendFromStaffAsync(WhatsAppSettings s, CustomerRow customer, string text, int staffId)
    {
        var (ok, waId, error) = await SendTextAsync(s, customer.MobileNo!, text);
        await _inbox.AddOutboundAsync(s.CompanyId, customer.CustomerId, waId, text, ok, error, staffId, isBot: false);
        return (ok, error);
    }

    private async Task BotReplyAsync(WhatsAppSettings s, CustomerRow customer, string text)
    {
        var (ok, waId, error) = await SendTextAsync(s, customer.MobileNo!, text);
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

    private Task<(bool Ok, string? WaMessageId, string? Error)> SendTextAsync(WhatsAppSettings s, string to, string body)
        => SendAsync(s, to, new { type = "text", text = new { body } });

    private async Task<(bool Ok, string? WaMessageId, string? Error)> SendAsync(WhatsAppSettings s, string to, object message)
    {
        var payload = JsonSerializer.SerializeToNode(message)!.AsObject();
        payload["messaging_product"] = "whatsapp";
        payload["to"] = to;
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_graphBase}/{Uri.EscapeDataString(s.PhoneNumberId!)}/messages")
        {
            Content = JsonContent.Create(payload)
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
