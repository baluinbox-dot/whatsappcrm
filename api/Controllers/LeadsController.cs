using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhatsAppCrm.Api.DTOs;
using WhatsAppCrm.Api.Repositories;
using WhatsAppCrm.Api.Services;

namespace WhatsAppCrm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeadsController : ControllerBase
{
    private readonly ILeadRepository _repo;
    private readonly ICustomerRepository _customers;
    private readonly IUserRepository _users;
    private readonly IPropertyRepository _properties;
    private readonly IFollowUpRepository _followUps;

    public LeadsController(ILeadRepository repo, ICustomerRepository customers, IUserRepository users,
        IPropertyRepository properties, IFollowUpRepository followUps)
    {
        _repo = repo;
        _customers = customers;
        _users = users;
        _properties = properties;
        _followUps = followUps;
    }

    // Staff only ever see leads assigned to them.
    private int? Scope => User.IsAdmin() ? null : User.UserId();

    private async Task<LeadRow?> GetAccessibleAsync(int id)
    {
        var l = await _repo.GetByIdAsync(User.CompanyId(), id);
        return l is not null && (User.IsAdmin() || l.AssignedTo == User.UserId()) ? l : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] LeadFilter filter)
        => Ok(await _repo.GetAllAsync(User.CompanyId(), Scope, filter));

    [HttpGet("counts")]
    public async Task<IActionResult> Counts()
        => Ok(await _repo.StatusCountsAsync(User.CompanyId(), Scope));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var lead = await GetAccessibleAsync(id);
        return lead is null ? NotFound() : Ok(lead);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveLeadDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (Check(dto) is { } invalid) return BadRequest(new { message = invalid });

        var assignTo = User.IsAdmin() ? dto.AssignedTo : User.UserId();
        if (assignTo is not null && !await _users.IsActiveMemberAsync(User.CompanyId(), assignTo.Value))
            return BadRequest(new { message = "Choose an active staff member." });

        var (customer, error) = await ResolveCustomerAsync(dto);
        if (customer is null) return BadRequest(new { message = error });

        var lead = await _repo.CreateAsync(User.CompanyId(), customer.CustomerId, dto, User.UserId());
        if (assignTo is not null) await AssignBothAsync(lead!, assignTo);
        return Ok(await _repo.GetByIdAsync(User.CompanyId(), lead!.LeadId));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveLeadDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (Check(dto) is { } invalid) return BadRequest(new { message = invalid });
        if (await GetAccessibleAsync(id) is null) return NotFound();
        return Ok(await _repo.UpdateAsync(User.CompanyId(), id, dto));
    }

    [HttpPut("{id:int}/assign")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignDto dto)
    {
        var lead = await _repo.GetByIdAsync(User.CompanyId(), id);
        if (lead is null) return NotFound();
        if (dto.UserId is not null && !await _users.IsActiveMemberAsync(User.CompanyId(), dto.UserId.Value))
            return BadRequest(new { message = "Choose an active staff member." });
        await AssignBothAsync(lead, dto.UserId);
        return Ok(await _repo.GetByIdAsync(User.CompanyId(), id));
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetLeadStatusDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await GetAccessibleAsync(id) is null) return NotFound();
        if (dto.Status is "LOST" or "NOT_INTERESTED" && dto.LostReason is null)
            return BadRequest(new { message = "Choose a reason." });
        if (dto.Status == "WON" && dto.WonPropertyId is not null
            && await _properties.GetByIdAsync(User.CompanyId(), dto.WonPropertyId.Value) is null)
            return BadRequest(new { message = "Property not found." });
        await _repo.SetStatusAsync(User.CompanyId(), id, dto, User.UserId());
        return Ok(await _repo.GetByIdAsync(User.CompanyId(), id));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
        => await _repo.DeleteAsync(User.CompanyId(), id) ? NoContent() : NotFound();

    [HttpGet("{id:int}/timeline")]
    public async Task<IActionResult> Timeline(int id)
    {
        var lead = await GetAccessibleAsync(id);
        if (lead is null) return NotFound();
        return Ok(await _repo.TimelineAsync(User.CompanyId(), id, lead.CustomerId));
    }

    [HttpPost("{id:int}/activities")]
    public async Task<IActionResult> AddActivity(int id, [FromBody] AddActivityDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await GetAccessibleAsync(id) is null) return NotFound();
        if (dto.ActivityType is "NOTE" && string.IsNullOrWhiteSpace(dto.Body))
            return BadRequest(new { message = "Write the note." });
        if (dto.PropertyId is not null && await _properties.GetByIdAsync(User.CompanyId(), dto.PropertyId.Value) is null)
            return BadRequest(new { message = "Property not found." });
        await _repo.AddActivityAsync(User.CompanyId(), id, dto, User.UserId());
        return NoContent();
    }

    [HttpGet("{id:int}/follow-ups")]
    public async Task<IActionResult> FollowUps(int id)
    {
        if (await GetAccessibleAsync(id) is null) return NotFound();
        return Ok(await _followUps.GetForLeadAsync(User.CompanyId(), id));
    }

    [HttpPost("{id:int}/follow-ups")]
    public async Task<IActionResult> AddFollowUp(int id, [FromBody] SaveFollowUpDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var lead = await GetAccessibleAsync(id);
        if (lead is null) return NotFound();
        if (dto.PropertyId is not null && await _properties.GetByIdAsync(User.CompanyId(), dto.PropertyId.Value) is null)
            return BadRequest(new { message = "Property not found." });
        return Ok(await _followUps.CreateAsync(User.CompanyId(), id, lead.AssignedTo ?? User.UserId(), dto, User.UserId()));
    }

    [HttpPut("bulk-assign")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> BulkAssign([FromBody] BulkAssignDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await InactiveStaffAsync(dto.UserIds)) return BadRequest(new { message = "Choose active staff members." });

        var done = 0;
        foreach (var leadId in dto.LeadIds.Distinct())
        {
            var lead = await _repo.GetByIdAsync(User.CompanyId(), leadId);
            if (lead is null) continue;
            await AssignBothAsync(lead, dto.UserIds.Count == 0 ? null : dto.UserIds[done % dto.UserIds.Count]);
            done++;
        }
        return Ok(new { assigned = done });
    }

    // Excel / CSV import. DryRun=true only reports what would happen, so the admin can check before importing.
    [HttpPost("import")]
    [Authorize(Roles = Roles.Admin)]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> Import([FromBody] ImportLeadsDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await InactiveStaffAsync(dto.AssignUserIds)) return BadRequest(new { message = "Choose active staff members." });

        var companyId = User.CompanyId();
        var result = new ImportResult { DryRun = dto.DryRun };
        // Mobile / email already seen earlier in this file -> that row's customer (null during a dry run).
        var seen = new Dictionary<string, int?>();
        var turn = 0;

        for (var i = 0; i < dto.Rows.Count; i++)
        {
            var row = dto.Rows[i];
            var mobile = LeadImportParser.Mobile(row.MobileNo);
            var email = LeadImportParser.Email(row.Email);
            var r = new ImportRowResult
            {
                Row = i + 1, MobileNo = mobile, Email = email, CustomerName = LeadImportParser.Text(row.CustomerName, 150)
            };
            result.Rows.Add(r);

            if (mobile is null && email is null)
            {
                r.Outcome = "ERROR";
                r.Message = !string.IsNullOrWhiteSpace(row.MobileNo) ? $"Mobile \"{row.MobileNo.Trim()}\" is not valid."
                    : !string.IsNullOrWhiteSpace(row.Email) ? $"Email \"{row.Email.Trim()}\" is not valid."
                    : "No mobile number or email.";
                result.Errors++;
                continue;
            }

            var lead = ToLead(row, dto);
            r.Lead = lead;

            var existing = mobile is not null ? await _customers.GetByMobileAsync(companyId, mobile) : null;
            if (existing is null && email is not null) existing = await _customers.GetByEmailAsync(companyId, email);
            var inFile = (mobile is not null && seen.ContainsKey("m" + mobile)) || (email is not null && seen.ContainsKey("e" + email));
            int? customerId = existing?.CustomerId
                ?? (inFile ? (mobile is not null && seen.TryGetValue("m" + mobile, out var a) ? a : seen.GetValueOrDefault("e" + email)) : null);

            if (dto.SkipOpenDuplicates && (inFile || (existing is not null && await _repo.HasOpenLeadAsync(companyId, existing.CustomerId))))
            {
                r.Outcome = "DUPLICATE";
                r.Message = inFile ? "Repeated in this file." : "Customer already has an open lead.";
                result.Duplicates++;
                continue;
            }

            r.Outcome = existing is not null || inFile ? "EXISTING" : "NEW";
            if (r.Outcome == "NEW") result.NewCustomers++; else result.ExistingCustomers++;
            r.AssignTo = dto.AssignUserIds.Count == 0 ? null : dto.AssignUserIds[turn++ % dto.AssignUserIds.Count];

            if (!dto.DryRun)
            {
                if (customerId is null)
                {
                    var (created, error) = await _customers.CreateAsync(companyId,
                        new SaveCustomerDto { MobileNo = mobile, CustomerName = r.CustomerName, Email = email });
                    if (created is null)
                    {
                        r.Outcome = "ERROR"; r.Message = error; result.Errors++;
                        continue;
                    }
                    customerId = created.CustomerId;
                }
                var saved = await _repo.CreateAsync(companyId, customerId.Value, lead, User.UserId());
                if (r.AssignTo is not null) await AssignBothAsync(saved!, r.AssignTo);
                r.LeadId = saved!.LeadId;
                result.LeadsCreated++;
            }

            if (mobile is not null) seen["m" + mobile] = customerId;
            if (email is not null) seen["e" + email] = customerId;
        }
        return Ok(result);
    }

    private static SaveLeadDto ToLead(ImportRowDto row, ImportLeadsDto dto)
    {
        var beds = LeadImportParser.Bedrooms(row.Bedrooms);
        var min = LeadImportParser.Amount(row.BudgetMin);
        var max = LeadImportParser.Amount(row.BudgetMax);
        if (min > max) (min, max) = (max, min);
        return new SaveLeadDto
        {
            Source = LeadImportParser.Source(row.Source) ?? dto.DefaultSource,
            Purpose = LeadImportParser.Purpose(row.Purpose) ?? dto.DefaultPurpose,
            PropertyType = LeadImportParser.PropertyType(row.PropertyType),
            Emirate = LeadImportParser.Emirate(row.Emirate) ?? LeadImportParser.Emirate(row.Communities),
            Communities = LeadImportParser.Text(row.Communities, 500),
            BedroomsMin = beds,
            BedroomsMax = beds,
            BudgetMin = min,
            BudgetMax = max,
            Nationality = LeadImportParser.Text(row.Nationality, 50),
            Priority = LeadImportParser.Priority(row.Priority) ?? "WARM",
            Requirements = LeadImportParser.Text(row.Requirements, 2000)
        };
    }

    private async Task<bool> InactiveStaffAsync(IEnumerable<int> userIds)
    {
        foreach (var id in userIds.Distinct())
            if (!await _users.IsActiveMemberAsync(User.CompanyId(), id)) return true;
        return false;
    }

    private static string? Check(SaveLeadDto dto)
    {
        static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        dto.CustomerName = Blank(dto.CustomerName);
        dto.MobileNo = Blank(dto.MobileNo);
        dto.Email = Blank(dto.Email);
        dto.Emirate = Blank(dto.Emirate);
        dto.Communities = Blank(dto.Communities);
        dto.Nationality = Blank(dto.Nationality);
        dto.Requirements = Blank(dto.Requirements);
        if (dto.BedroomsMin > dto.BedroomsMax) return "Minimum bedrooms is more than the maximum.";
        if (dto.BudgetMin > dto.BudgetMax) return "Minimum budget is more than the maximum.";
        return null;
    }

    // An existing customer, or the one already holding this mobile / email, or a new contact.
    private async Task<(CustomerRow?, string?)> ResolveCustomerAsync(SaveLeadDto dto)
    {
        var companyId = User.CompanyId();
        CustomerRow? customer = null;
        if (dto.CustomerId is not null)
        {
            customer = await _customers.GetByIdAsync(companyId, dto.CustomerId.Value);
            if (customer is null) return (null, "Customer not found.");
        }
        else
        {
            if (dto.MobileNo is null && dto.Email is null) return (null, "Choose a customer or enter a mobile number / email ID.");
            if (dto.MobileNo is not null) customer = await _customers.GetByMobileAsync(companyId, dto.MobileNo);
            if (customer is null && dto.Email is not null) customer = await _customers.GetByEmailAsync(companyId, dto.Email);
            if (customer is null)
            {
                var (row, error) = await _customers.CreateAsync(companyId,
                    new SaveCustomerDto { MobileNo = dto.MobileNo, CustomerName = dto.CustomerName, Email = dto.Email });
                return (row, error);
            }
        }

        if (!User.IsAdmin() && customer.AssignedTo is not null && customer.AssignedTo != User.UserId())
            return (null, "This customer belongs to another staff member. Ask an admin to create the lead.");
        return (customer, null);
    }

    // The lead's agent also gets the customer, so they can chat and email. The latest lead assignment wins.
    private async Task AssignBothAsync(LeadRow lead, int? toUserId)
    {
        await _repo.AssignAsync(User.CompanyId(), lead.LeadId, toUserId, User.UserId());
        if (toUserId is not null) await _customers.AssignAsync(User.CompanyId(), lead.CustomerId, toUserId, User.UserId());
    }
}
