namespace WhatsAppCrm.Api.Services;

// Links customers open from WhatsApp / email must use the API's public address (App:PublicUrl,
// e.g. the ngrok or production domain), never localhost.
public class PublicLinks
{
    public string? BaseUrl { get; }

    public PublicLinks(IConfiguration config)
    {
        var url = config["App:PublicUrl"];
        BaseUrl = string.IsNullOrWhiteSpace(url) ? null : url.Trim().TrimEnd('/');
    }

    public string? Property(string? publicCode) =>
        BaseUrl is null || publicCode is null ? null : $"{BaseUrl}/p/{publicCode}";

    public string? File(int propertyId, string? storedName) =>
        BaseUrl is null || storedName is null ? null : $"{BaseUrl}{UploadStorage.RequestPath}/properties/{propertyId}/{storedName}";
}
