using System.Globalization;
using System.Text;
using WhatsAppCrm.Api.DTOs;

namespace WhatsAppCrm.Api.Services;

// How a property reads to a customer (WhatsApp caption, email, public page). Owner details never appear here.
public static class PropertyText
{
    private static readonly CultureInfo En = CultureInfo.GetCultureInfo("en-US");

    public static readonly Dictionary<string, string> Types = new()
    {
        ["APARTMENT"] = "Apartment", ["VILLA"] = "Villa", ["TOWNHOUSE"] = "Townhouse", ["PENTHOUSE"] = "Penthouse",
        ["DUPLEX"] = "Duplex", ["HOTEL_APT"] = "Hotel Apartment", ["OFFICE"] = "Office", ["SHOP"] = "Shop",
        ["WAREHOUSE"] = "Warehouse", ["LAND"] = "Plot", ["BUILDING"] = "Building",
        ["INDEPENDENT_HOUSE"] = "Independent House", ["COMMUNITY"] = "Community", ["VILLAGE"] = "Village", ["GATED_COMMUNITY"] = "Gated Community"
    };

    public static readonly Dictionary<string, string> Furnishings = new()
    {
        ["FURNISHED"] = "Furnished", ["SEMI"] = "Semi-furnished", ["UNFURNISHED"] = "Unfurnished"
    };

    public static string Aed(decimal n) => "AED " + n.ToString("N0", En);

    public static string Price(PropertyRow p) =>
        Aed(p.Price) + (p.Purpose == "RENT" ? (p.RentFrequency == "MONTHLY" ? " / month" : " / year") : "");

    public static string Beds(int? n) => n is null ? "" : n == 0 ? "Studio" : n >= 7 ? "7+ BR" : $"{n} BR";

    // "2 BR Apartment for Rent"
    public static string Headline(PropertyRow p) =>
        string.Join(" ", new[] { Beds(p.Bedrooms), Types.GetValueOrDefault(p.PropertyType, p.PropertyType) }.Where(s => s.Length > 0))
        + (p.Purpose == "RENT" ? " for Rent" : " for Sale");

    public static string Location(PropertyRow p) =>
        string.Join(", ", new[] { p.SubCommunity, p.Community, p.Emirate }.Where(s => !string.IsNullOrWhiteSpace(s)));

    public static string? Size(PropertyRow p) =>
        p.BuaSqft is > 0 ? $"{p.BuaSqft.Value.ToString("N0", En)} sq.ft"
        : p.PlotSqft is > 0 ? $"{p.PlotSqft.Value.ToString("N0", En)} sq.ft plot" : null;

    public static string? OffPlan(PropertyRow p, string sep) => p.Completion != "OFFPLAN" ? null
        : "Off-plan" + (p.HandoverDate is not null ? $"{sep}handover {p.HandoverDate:MMM yyyy}" : "")
                     + (p.PaymentPlan is not null ? $"{sep}payment plan {p.PaymentPlan}" : "");

    public static string? PricePlan(PropertyRow p, string sep)
    {
        var parts = new List<string>();
        if (p.DownPaymentPct is > 0) parts.Add($"{p.DownPaymentPct.Value.ToString("0.##", En)}% down payment ({Aed(Math.Round(p.Price * p.DownPaymentPct.Value / 100m))})");
        parts.AddRange(p.ProjectPayments.Select(s => $"{s.PercentDue.ToString("0.##", En)}% {s.Label}{(string.IsNullOrWhiteSpace(s.DueNote) ? "" : $" ({s.DueNote})")}"));
        return parts.Count == 0 ? null : string.Join(sep, parts);
    }

    public static string WhatsAppCaption(PropertyRow p)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"*{p.Title}*");
        sb.AppendLine(Headline(p));
        sb.AppendLine($"Location: {Location(p)}");
        sb.AppendLine($"Price: *{Price(p)}*{(p.Purpose == "RENT" && p.Cheques is not null ? $" ({p.Cheques} cheques)" : "")}");
        if (Size(p) is { } size) sb.AppendLine($"Size: {size}{(p.Bathrooms is not null ? $" | {p.Bathrooms} bath" : "")}");
        if (OffPlan(p, " | ") is { } offPlan) sb.AppendLine(offPlan);
        if (p.ProjectName is not null) sb.AppendLine($"Project: {p.ProjectName}");
        if (p.DownPaymentPct is > 0) sb.AppendLine($"Down payment: {p.DownPaymentPct.Value.ToString("0.##", En)}%");
        if (p.Furnishing is not null) sb.AppendLine(Furnishings.GetValueOrDefault(p.Furnishing, p.Furnishing));
        sb.AppendLine($"Ref: {p.RefNo}");
        if (p.PublicUrl is not null) sb.Append($"Photos & details: {p.PublicUrl}");
        return sb.ToString().TrimEnd();
    }

    public static string EmailBody(string? customerName, string? intro, IReadOnlyList<PropertyRow> properties, string? staffName)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Dear {(string.IsNullOrWhiteSpace(customerName) ? "Sir / Madam" : customerName)},");
        sb.AppendLine();
        sb.AppendLine(intro ?? (properties.Count == 1
            ? "Please find below a property that matches your requirements."
            : "Please find below properties that match your requirements."));
        for (var i = 0; i < properties.Count; i++)
        {
            var p = properties[i];
            sb.AppendLine();
            sb.AppendLine($"{i + 1}. {p.Title} ({p.RefNo})");
            sb.AppendLine($"   {Headline(p)} - {Location(p)}");
            sb.AppendLine($"   Price: {Price(p)}");
            if (Size(p) is { } size) sb.AppendLine($"   Size: {size}");
            if (OffPlan(p, ", ") is { } offPlan) sb.AppendLine($"   {offPlan}");
            if (p.ProjectName is not null)
            {
                sb.AppendLine($"   Project: {p.ProjectName} ({p.ProjectNo}){(p.Developer is not null ? $" by {p.Developer}" : "")}");
                if (!string.IsNullOrWhiteSpace(p.ProjectDescription))
                    sb.AppendLine($"   {(p.ProjectDescription.Length > 300 ? p.ProjectDescription[..300].TrimEnd() + "..." : p.ProjectDescription).ReplaceLineEndings(" ")}");
            }
            var amenities = string.Join(", ", new[] { p.ProjectAmenities, p.Amenities }.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (amenities.Length > 0) sb.AppendLine($"   Amenities: {amenities}");
            if (PricePlan(p, "; ") is { } plan) sb.AppendLine($"   Payment plan: {plan}");
            if (p.PublicUrl is not null) sb.AppendLine($"   Photos & details: {p.PublicUrl}");
        }
        sb.AppendLine();
        sb.AppendLine("Reply to this email or message us on WhatsApp to arrange a viewing.");
        sb.AppendLine();
        sb.AppendLine("Kind regards,");
        if (!string.IsNullOrWhiteSpace(staffName)) sb.AppendLine(staffName);
        return sb.ToString().TrimEnd();
    }
}
