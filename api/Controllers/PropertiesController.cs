using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private const long MaxImageBytes = 10 * 1024 * 1024;
    private const long MaxPdfBytes = 20 * 1024 * 1024;
    private const int MaxImages = 40;

    private static readonly Dictionary<string, string> ImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".webp"] = "image/webp"
    };

    private readonly IPropertyRepository _repo;
    private readonly IProjectRepository _projects;
    private readonly IUserRepository _users;
    private readonly UploadStorage _storage;
    private readonly PublicLinks _links;

    public PropertiesController(IPropertyRepository repo, IProjectRepository projects, IUserRepository users, UploadStorage storage, PublicLinks links)
    {
        _repo = repo;
        _projects = projects;
        _users = users;
        _storage = storage;
        _links = links;
    }

    private PropertyRow? WithLink(PropertyRow? row)
    {
        if (row is not null) row.PublicUrl = _links.Property(row.PublicCode);
        return row;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PropertyFilter filter)
        => Ok((await _repo.GetAllAsync(User.CompanyId(), filter)).Select(WithLink));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var row = WithLink(await _repo.GetByIdAsync(User.CompanyId(), id));
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SavePropertyDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (!User.IsAdmin()) dto.AgentId = User.UserId();
        var error = await CheckAsync(dto);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(WithLink(await _repo.CreateAsync(User.CompanyId(), dto, User.UserId())));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SavePropertyDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var existing = await _repo.GetByIdAsync(User.CompanyId(), id);
        if (existing is null) return NotFound();
        // Only admins move a listing to another agent.
        if (!User.IsAdmin()) dto.AgentId = existing.AgentId;
        var error = await CheckAsync(dto, existing.AgentId);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(WithLink(await _repo.UpdateAsync(User.CompanyId(), id, dto, User.UserId())));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
    {
        if (await _repo.GetByIdAsync(User.CompanyId(), id) is null) return NotFound();
        foreach (var f in await _repo.DeleteAsync(User.CompanyId(), id))
            _storage.Delete(f.PropertyId, f.StoredName);
        return NoContent();
    }

    [HttpPost("{id:int}/files")]
    [RequestSizeLimit(200 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 200 * 1024 * 1024)]
    public async Task<IActionResult> Upload(int id, [FromForm] string kind, [FromForm] List<IFormFile> files)
    {
        var property = await _repo.GetByIdAsync(User.CompanyId(), id);
        if (property is null) return NotFound();
        if (kind is not ("IMAGE" or "FLOORPLAN" or "BROCHURE")) return BadRequest(new { message = "Unknown file type." });
        if (files.Count == 0) return BadRequest(new { message = "Choose at least one file." });

        var images = property.Files.Count(f => f.FileKind == "IMAGE");
        if (kind == "IMAGE" && images + files.Count > MaxImages)
            return BadRequest(new { message = $"A property can have at most {MaxImages} images ({images} already uploaded)." });

        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName);
            var isPdf = ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase);
            var allowed = kind switch
            {
                "IMAGE" => ImageTypes.ContainsKey(ext),
                "FLOORPLAN" => ImageTypes.ContainsKey(ext) || isPdf,
                _ => isPdf
            };
            if (!allowed)
                return BadRequest(new { message = kind == "BROCHURE"
                    ? $"{file.FileName}: brochures must be PDF."
                    : $"{file.FileName}: use JPG, PNG or WEBP{(kind == "FLOORPLAN" ? " or PDF" : "")}." });
            if (file.Length > (isPdf ? MaxPdfBytes : MaxImageBytes))
                return BadRequest(new { message = $"{file.FileName} is larger than {(isPdf ? 20 : 10)} MB." });
        }

        var saved = new List<PropertyFileRow>();
        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var storedName = await _storage.SaveAsync(id, ext, file);
            saved.Add(await _repo.AddFileAsync(User.CompanyId(), id, new PropertyFileRow
            {
                FileKind = kind,
                FileName = Path.GetFileName(file.FileName),
                StoredName = storedName,
                ContentType = ext == ".pdf" ? "application/pdf" : ImageTypes[ext],
                SizeBytes = file.Length
            }));
        }
        return Ok(saved);
    }

    [HttpPut("files/{fileId:int}/cover")]
    public async Task<IActionResult> SetCover(int fileId)
        => await _repo.SetCoverAsync(User.CompanyId(), fileId) ? NoContent() : NotFound();

    [HttpDelete("files/{fileId:int}")]
    public async Task<IActionResult> DeleteFile(int fileId)
    {
        var file = await _repo.GetFileAsync(User.CompanyId(), fileId);
        if (file is null || !await _repo.DeleteFileAsync(User.CompanyId(), fileId)) return NotFound();
        _storage.Delete(file.PropertyId, file.StoredName);
        return NoContent();
    }

    private async Task<string?> CheckAsync(SavePropertyDto dto, int? currentAgentId = null)
    {
        static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        dto.Title = dto.Title.Trim();
        dto.Emirate = dto.Emirate.Trim();
        dto.Community = Blank(dto.Community);
        dto.SubCommunity = Blank(dto.SubCommunity);
        dto.Developer = Blank(dto.Developer);
        dto.MapUrl = Blank(dto.MapUrl);
        dto.ViewType = Blank(dto.ViewType);
        dto.FloorNo = Blank(dto.FloorNo);
        dto.PaymentPlan = Blank(dto.PaymentPlan);
        dto.PermitNo = Blank(dto.PermitNo);
        dto.TitleDeedNo = Blank(dto.TitleDeedNo);
        dto.OwnerName = Blank(dto.OwnerName);
        dto.OwnerMobile = Blank(dto.OwnerMobile);
        dto.OwnerEmail = Blank(dto.OwnerEmail);
        dto.Amenities = Blank(dto.Amenities);
        dto.Description = Blank(dto.Description);

        if (dto.Purpose == "RENT")
        {
            dto.RentFrequency ??= "YEARLY";
        }
        else
        {
            dto.RentFrequency = null;
            dto.Cheques = null;
        }
        if (dto.Completion == "READY")
        {
            dto.PaymentPlan = null;
            dto.CompletionPct = null;
        }

        if (dto.ProjectId is not null)
        {
            var project = await _projects.GetByIdAsync(User.CompanyId(), dto.ProjectId.Value);
            if (project is null) return "Project not found.";
            dto.Emirate = project.Emirate;
            dto.Completion = project.Completion;
        }

        if (dto.Price <= 0) return "Enter the price in AED.";
        if (dto.AgentId is not null && dto.AgentId != currentAgentId
            && !await _users.IsActiveMemberAsync(User.CompanyId(), dto.AgentId.Value))
            return "Choose an active staff member as the agent.";
        return null;
    }
}
