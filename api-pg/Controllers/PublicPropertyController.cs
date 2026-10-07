using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

// The page customers open from a shared link. Served by the API (not the CRM app) so it works from any phone.
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
public class PublicPropertyController : ControllerBase
{
    private readonly IPropertyRepository _repo;
    private readonly PublicLinks _links;

    public PublicPropertyController(IPropertyRepository repo, PublicLinks links)
    {
        _repo = repo;
        _links = links;
    }

    private static string H(string? s) => WebUtility.HtmlEncode(s ?? "");

    [HttpGet("p/{code}")]
    public async Task<IActionResult> Page(string code)
    {
        var view = Regex.IsMatch(code, "^[a-z0-9]{6,20}$") ? await _repo.GetPublicAsync(code) : null;
        if (view is null) return Content(Shell("Not found", "", "<p class='muted'>This property link is not valid.</p>"), "text/html; charset=utf-8");

        var p = view.Property;
        p.PublicUrl = _links.Property(p.PublicCode);
        var images = p.Files.Where(f => f.FileKind == "IMAGE").ToList();
        var fileUrl = (PropertyFileRow f) => $"{UploadStorage.RequestPath}/properties/{p.PropertyId}/{f.StoredName}";
        var ogImage = images.Count > 0 ? _links.File(p.PropertyId, images[0].StoredName) : null;
        var og = $@"<meta property=""og:title"" content=""{H(p.Title)}"">
<meta property=""og:description"" content=""{H($"{PropertyText.Headline(p)} · {PropertyText.Location(p)} · {PropertyText.Price(p)}")}"">
{(ogImage is null ? "" : $@"<meta property=""og:image"" content=""{H(ogImage)}"">")}";

        var b = new StringBuilder();
        if (p.Status is not ("AVAILABLE" or "RESERVED"))
            b.Append("<div class='banner'>This property is no longer available. Message us for similar options.</div>");
        if (images.Count > 0)
        {
            b.Append("<div class='gallery'>");
            foreach (var f in images) b.Append($"<img src='{H(fileUrl(f))}' alt='{H(p.Title)}' loading='lazy'>");
            b.Append("</div>");
            if (images.Count > 1) b.Append($"<p class='muted small'>Swipe for {images.Count} photos</p>");
        }
        b.Append($"<p class='ref'>{H(p.RefNo)}{(p.Status == "RESERVED" ? " · Reserved" : "")}</p>");
        b.Append($"<h1>{H(p.Title)}</h1>");
        b.Append($"<p class='muted'>{H(PropertyText.Headline(p))} · {H(PropertyText.Location(p))}</p>");
        b.Append($"<p class='price'>{H(PropertyText.Price(p))}</p>");
        var facts = new List<(string, string?)>
        {
            ("Bedrooms", p.Bedrooms is null ? null : PropertyText.Beds(p.Bedrooms)),
            ("Bathrooms", p.Bathrooms?.ToString()),
            ("Size", PropertyText.Size(p)),
            ("Plot", p.PlotSqft is > 0 && p.BuaSqft is > 0 ? $"{p.PlotSqft:N0} sq.ft" : null),
            ("Parking", p.Parking?.ToString()),
            ("Furnishing", p.Furnishing is null ? null : PropertyText.Furnishings.GetValueOrDefault(p.Furnishing)),
            ("View", p.ViewType),
            ("Floor", p.FloorNo),
            ("Status", p.Completion == "OFFPLAN" ? "Off-plan" : "Ready"),
            ("Handover", p.HandoverDate?.ToString("MMM yyyy")),
            ("Payment Plan", p.PaymentPlan),
            ("Cheques", p.Purpose == "RENT" ? p.Cheques?.ToString() : null),
            ("Service Charge", p.ServiceCharge is null ? null : $"AED {p.ServiceCharge:0.##} / sq.ft"),
            ("Developer", p.Developer),
            ("Permit No", p.PermitNo),
        };
        b.Append("<div class='facts'>");
        foreach (var (label, value) in facts.Where(f => !string.IsNullOrWhiteSpace(f.Item2)))
            b.Append($"<div><span>{H(label)}</span><b>{H(value)}</b></div>");
        b.Append("</div>");

        var amenities = (p.Amenities ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (amenities.Length > 0)
        {
            b.Append("<h2>Amenities</h2><div class='chips'>");
            foreach (var a in amenities) b.Append($"<span>{H(a)}</span>");
            b.Append("</div>");
        }
        if (!string.IsNullOrWhiteSpace(p.Description)) b.Append($"<h2>Description</h2><p class='desc'>{H(p.Description)}</p>");

        var docs = p.Files.Where(f => f.FileKind != "IMAGE").ToList();
        if (docs.Count > 0 || p.MapUrl is not null)
        {
            b.Append("<h2>More</h2><ul class='links'>");
            foreach (var f in docs)
                b.Append($"<li><a href='{H(fileUrl(f))}' target='_blank' rel='noopener'>{(f.FileKind == "BROCHURE" ? "Brochure" : "Floor plan")}: {H(f.FileName)}</a></li>");
            if (p.MapUrl is not null && Uri.TryCreate(p.MapUrl, UriKind.Absolute, out var map) && map.Scheme is "http" or "https")
                b.Append($"<li><a href='{H(map.ToString())}' target='_blank' rel='noopener'>View on map</a></li>");
            b.Append("</ul>");
        }

        b.Append($"<p class='muted small company'>Listed by {H(view.CompanyName)}</p>");
        if (view.WhatsAppNumber is not null)
        {
            var text = Uri.EscapeDataString($"Hi, I'm interested in {p.RefNo} - {p.Title}");
            b.Append($"<a class='cta' href='https://wa.me/{view.WhatsAppNumber}?text={text}'>Chat on WhatsApp</a>");
        }
        return Content(Shell(p.Title, og, b.ToString()), "text/html; charset=utf-8");
    }

    private static string Shell(string title, string head, string body) => $@"<!doctype html>
<html lang=""en""><head><meta charset=""utf-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1"">
<meta name=""robots"" content=""noindex"">
<title>{H(title)}</title>
{head}
<style>
:root {{ --bg:#f8fafc; --card:#fff; --text:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#2563eb; --chip:#eff6ff; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#020617; --card:#0f172a; --text:#f1f5f9; --muted:#94a3b8; --line:#1e293b; --accent:#60a5fa; --chip:#1e293b; }} }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }}
main {{ max-width:760px; margin:0 auto; padding:16px 16px 96px; }}
.gallery {{ display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x mandatory; border-radius:14px; }}
.gallery img {{ flex:0 0 100%; width:100%; aspect-ratio:4/3; object-fit:cover; scroll-snap-align:start; border-radius:14px; background:var(--line); }}
h1 {{ font-size:22px; line-height:1.3; margin:4px 0; }}
h2 {{ font-size:16px; margin:24px 0 8px; }}
.ref {{ margin:16px 0 0; font:12px ui-monospace,monospace; color:var(--muted); }}
.muted {{ color:var(--muted); margin:0; }} .small {{ font-size:12px; margin-top:6px; }}
.price {{ font-size:24px; font-weight:700; color:var(--accent); margin:10px 0 0; }}
.facts {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden; margin-top:18px; }}
.facts div {{ background:var(--card); padding:10px 12px; }} .facts span {{ display:block; font-size:12px; color:var(--muted); }}
.chips {{ display:flex; flex-wrap:wrap; gap:6px; }} .chips span {{ background:var(--chip); border-radius:999px; padding:4px 10px; font-size:13px; }}
.desc {{ white-space:pre-wrap; margin:0; }}
.links {{ padding-left:18px; margin:0; }} a {{ color:var(--accent); }}
.banner {{ background:#fef3c7; color:#92400e; border-radius:10px; padding:10px 14px; margin-bottom:12px; }}
.company {{ margin-top:28px; }}
.cta {{ position:fixed; left:16px; right:16px; bottom:16px; max-width:728px; margin:0 auto; display:block; text-align:center; background:#16a34a; color:#fff; font-weight:600; padding:14px; border-radius:12px; text-decoration:none; box-shadow:0 6px 20px rgba(0,0,0,.2); }}
</style></head>
<body><main>{body}</main></body></html>";
}
