using System.Net;
using System.Text.RegularExpressions;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;
using MimeKit.Utils;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;

namespace WhatsAppCrm.Api.Services;

public interface IMailboxService
{
    Task<(bool Ok, string? Error)> VerifyAsync(EmailSettings settings);
    Task<int> FetchNewAsync(EmailSettings settings, CancellationToken ct = default);
    Task<(bool Ok, string? Error)> SendAsync(EmailSettings settings, CustomerRow customer, string subject, string body, int staffId);
}

// One company mailbox: IMAP brings customer emails in, SMTP sends staff replies out.
public class MailboxService : IMailboxService
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    private readonly ICustomerRepository _customers;
    private readonly IEmailInboxRepository _emails;
    private readonly IEmailSettingsRepository _settings;
    private readonly ILeadRepository _leads;
    private readonly ILogger<MailboxService> _logger;

    public MailboxService(ICustomerRepository customers, IEmailInboxRepository emails,
        IEmailSettingsRepository settings, ILeadRepository leads, ILogger<MailboxService> logger)
    {
        _customers = customers;
        _emails = emails;
        _settings = settings;
        _leads = leads;
        _logger = logger;
    }

    private static async Task<ImapClient> OpenImapAsync(EmailSettings s, CancellationToken ct)
    {
        var imap = new ImapClient { Timeout = (int)Timeout.TotalMilliseconds };
        try
        {
            await imap.ConnectAsync(s.ImapHost, s.ImapPort, SecureSocketOptions.Auto, ct);
            await imap.AuthenticateAsync(s.Username, s.Password, ct);
            await imap.Inbox.OpenAsync(FolderAccess.ReadOnly, ct);
            return imap;
        }
        catch
        {
            imap.Dispose();
            throw;
        }
    }

    private static async Task<SmtpClient> OpenSmtpAsync(EmailSettings s, CancellationToken ct = default)
    {
        var smtp = new SmtpClient { Timeout = (int)Timeout.TotalMilliseconds };
        try
        {
            await smtp.ConnectAsync(s.SmtpHost, s.SmtpPort, SecureSocketOptions.Auto, ct);
            await smtp.AuthenticateAsync(s.Username, s.Password, ct);
            return smtp;
        }
        catch
        {
            smtp.Dispose();
            throw;
        }
    }

    public async Task<(bool, string?)> VerifyAsync(EmailSettings s)
    {
        if (string.IsNullOrEmpty(s.Password)) return (false, "Password is required.");
        try
        {
            using (var imap = await OpenImapAsync(s, default))
            {
                // Only mail that arrives after the mailbox is connected is imported.
                if (s.LastUid is null || s.UidValidity != imap.Inbox.UidValidity)
                    await _settings.SetCursorAsync(s.CompanyId, imap.Inbox.UidValidity, await HighestUidAsync(imap.Inbox, default));
                await imap.DisconnectAsync(true);
            }
            using (var smtp = await OpenSmtpAsync(s))
                await smtp.DisconnectAsync(true);
            return (true, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return (false, ex.Message);
        }
    }

    private static async Task<long> HighestUidAsync(IMailFolder folder, CancellationToken ct)
    {
        if (folder.UidNext is { } next) return next.Id - 1;
        var all = await folder.SearchAsync(SearchQuery.All, ct);
        return all.Count == 0 ? 0 : all.Max(u => u.Id);
    }

    public async Task<int> FetchNewAsync(EmailSettings s, CancellationToken ct = default)
    {
        using var imap = await OpenImapAsync(s, ct);
        var inbox = imap.Inbox;

        // UIDVALIDITY changes when the server renumbers the mailbox; old cursors are then meaningless.
        if (s.LastUid is null || s.UidValidity != inbox.UidValidity)
        {
            await _settings.SetCursorAsync(s.CompanyId, inbox.UidValidity, await HighestUidAsync(inbox, ct));
            await imap.DisconnectAsync(true, ct);
            return 0;
        }

        var from = new UniqueId((uint)s.LastUid.Value + 1);
        // "n:*" always matches the newest message even when its UID is below n, hence the filter.
        var uids = (await inbox.SearchAsync(SearchQuery.Uids(new UniqueIdRange(from, UniqueId.MaxValue)), ct))
            .Where(u => u.Id > s.LastUid.Value).OrderBy(u => u.Id).ToList();

        var imported = 0;
        foreach (var uid in uids)
        {
            var message = await inbox.GetMessageAsync(uid, ct);
            if (await ImportAsync(s, message)) imported++;
            await _settings.SetCursorAsync(s.CompanyId, inbox.UidValidity, uid.Id);
        }

        await imap.DisconnectAsync(true, ct);
        return imported;
    }

    private async Task<bool> ImportAsync(EmailSettings s, MimeMessage message)
    {
        var sender = message.From.Mailboxes.FirstOrDefault() ?? message.Sender;
        if (sender is null || string.IsNullOrWhiteSpace(sender.Address)) return false;

        var address = sender.Address.Trim().ToLowerInvariant();
        if (address.Equals(s.EmailAddress, StringComparison.OrdinalIgnoreCase)) return false;
        if (address.Length > 150) return false;

        var customer = await _customers.GetByEmailAsync(s.CompanyId, address);
        var isNew = customer is null;
        if (customer is null)
        {
            var name = string.IsNullOrWhiteSpace(sender.Name) ? address.Split('@')[0] : sender.Name.Trim();
            customer = await _customers.CreateFromEmailAsync(s.CompanyId, address, name.Length > 150 ? name[..150] : name);
        }

        var receivedAt = message.Date == DateTimeOffset.MinValue || message.Date.UtcDateTime > DateTime.UtcNow
            ? DateTime.UtcNow : message.Date.UtcDateTime;

        var body = BodyText(message);
        var added = await _emails.AddInboundAsync(s.CompanyId, customer.CustomerId, message.MessageId, message.Subject,
            address, s.EmailAddress, body, receivedAt);

        // A new sender becomes an unassigned lead. Buy / Rent is guessed from the subject (default Buy) — staff confirm it.
        if (added && isNew)
        {
            var subject = LeadImportParser.Text(message.Subject, 300);
            await _leads.CreateAsync(s.CompanyId, customer.CustomerId, new SaveLeadDto
            {
                Source = "EMAIL",
                Purpose = subject?.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Select(LeadImportParser.Purpose).FirstOrDefault(p => p is not null) ?? "BUY",
                PropertyType = LeadImportParser.PropertyType(subject),
                Emirate = LeadImportParser.Emirate(subject),
                Priority = "WARM",
                Requirements = subject is null ? null : $"Email: {subject}"
            }, null);
        }
        return added;
    }

    private static string? BodyText(MimeMessage message)
    {
        if (!string.IsNullOrWhiteSpace(message.TextBody)) return message.TextBody.Trim();
        if (string.IsNullOrWhiteSpace(message.HtmlBody)) return null;
        return HtmlToPlain(message.HtmlBody);
    }

    // Staff read emails as plain text, so HTML-only mail is flattened (no markup reaches the browser).
    private static string HtmlToPlain(string html)
    {
        var text = Regex.Replace(html, @"<(script|style|head)[^>]*>.*?</\1>", "", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<br\s*/?>|</(p|div|tr|li|h[1-6])>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", "");
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"[ \t]+\n", "\n");
        return Regex.Replace(text, @"\n{3,}", "\n\n").Trim();
    }

    public async Task<(bool, string?)> SendAsync(EmailSettings s, CustomerRow customer, string subject, string body, int staffId)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(s.FromName ?? s.EmailAddress, s.EmailAddress));
        message.To.Add(new MailboxAddress(customer.CustomerName ?? customer.Email, customer.Email));
        message.Subject = subject;
        message.MessageId = MimeUtils.GenerateMessageId(s.EmailAddress.Split('@').Last());
        message.Body = new TextPart(TextFormat.Plain) { Text = body };

        // Thread the reply under the customer's latest email in their mail app.
        var lastIn = (await _emails.GetEmailsAsync(s.CompanyId, customer.CustomerId))
            .LastOrDefault(e => e.Direction == "IN" && !string.IsNullOrEmpty(e.MessageId));
        if (lastIn is not null)
        {
            message.InReplyTo = lastIn.MessageId;
            message.References.Add(lastIn.MessageId);
        }

        string? error = null;
        try
        {
            using var smtp = await OpenSmtpAsync(s);
            await smtp.SendAsync(message);
            await smtp.DisconnectAsync(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Email to {To} failed", customer.Email);
            error = ex.Message;
        }

        await _emails.AddOutboundAsync(s.CompanyId, customer.CustomerId, message.MessageId, subject,
            s.EmailAddress, customer.Email!, body, error is null, error, staffId);
        return (error is null, error);
    }
}

public class EmailPollingService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<EmailPollingService> _logger;

    public EmailPollingService(IServiceScopeFactory scopes, ILogger<EmailPollingService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try { await PollAllAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { _logger.LogError(ex, "Email polling failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task PollAllAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var settingsRepo = scope.ServiceProvider.GetRequiredService<IEmailSettingsRepository>();
        var mailbox = scope.ServiceProvider.GetRequiredService<IMailboxService>();

        foreach (var s in await settingsRepo.GetActiveVerifiedAsync())
        {
            string? error = null;
            try { await mailbox.FetchNewAsync(s, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Email fetch failed for company {Company}", s.CompanyId);
                error = ex.Message;
            }
            await settingsRepo.SetCheckedAsync(s.CompanyId, error);
        }
    }
}
