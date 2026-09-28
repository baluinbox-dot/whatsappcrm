namespace WhatsAppCrm.Api.Services;

// Property files live on the server disk under <Uploads:Path>/properties/<propertyId>/<random name>
// and are served publicly at /uploads/... — the random name is what keeps them unguessable.
public class UploadStorage
{
    public const string RequestPath = "/uploads";

    public string Root { get; }

    public UploadStorage(IConfiguration config, IWebHostEnvironment env)
    {
        Root = Path.GetFullPath(config["Uploads:Path"] is { Length: > 0 } p ? p : Path.Combine(env.ContentRootPath, "uploads"));
        Directory.CreateDirectory(Root);
    }

    private string Folder(int propertyId) => Path.Combine(Root, "properties", propertyId.ToString());

    public async Task<string> SaveAsync(int propertyId, string extension, IFormFile file)
    {
        var folder = Folder(propertyId);
        Directory.CreateDirectory(folder);
        var name = $"{Guid.NewGuid():N}{extension}";
        await using var stream = File.Create(Path.Combine(folder, name));
        await file.CopyToAsync(stream);
        return name;
    }

    public void Delete(int propertyId, string storedName)
    {
        var path = Path.Combine(Folder(propertyId), Path.GetFileName(storedName));
        if (File.Exists(path)) File.Delete(path);
    }
}
