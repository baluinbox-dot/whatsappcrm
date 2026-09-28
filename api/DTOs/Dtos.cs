using System.ComponentModel.DataAnnotations;

namespace WhatsAppCrm.Api.DTOs;

public static class Roles
{
    public const string Admin = "ADMIN";
    public const string Staff = "STAFF";
}

// ---------- Auth ----------

public class LoginDto
{
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}

// Staff have no email of their own: the company is found by its admin's email.
public class StaffLoginDto
{
    [Required, EmailAddress] public string AdminEmail { get; set; } = string.Empty;
    [Required, MaxLength(20)] public string MobileNo { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}

public class SignupDto
{
    [Required, MaxLength(150)] public string CompanyName { get; set; } = string.Empty;
    [Required, MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [Required, EmailAddress, MaxLength(150)] public string Email { get; set; } = string.Empty;
    [MaxLength(20)] public string? MobileNo { get; set; }
    [Required, MinLength(6), MaxLength(100)] public string Password { get; set; } = string.Empty;
}

public class ForgotPasswordDto
{
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    [Required] public string Token { get; set; } = string.Empty;
    [Required, MinLength(6), MaxLength(100)] public string Password { get; set; } = string.Empty;
}

public class AuthUser
{
    public int UserId { get; set; }
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string CompanyStatus { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? MobileNo { get; set; }
    public string Role { get; set; } = Roles.Staff;
    public string IsSuperAdmin { get; set; } = "F";
    public string IsActive { get; set; } = "T";
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public AuthUser User { get; set; } = new();
}

// ---------- Staff (users of a company) ----------

public class UserRow
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? MobileNo { get; set; }
    public string Role { get; set; } = Roles.Staff;
    public string IsActive { get; set; } = "T";
    public string HasPassword { get; set; } = "F";
    public int AssignedCustomers { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Admins sign in with email; staff sign in with the admin's email + their mobile number.
public class SaveUserDto
{
    [Required, MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [EmailAddress, MaxLength(150)] public string? Email { get; set; }
    [RegularExpression(@"^\d{8,15}$", ErrorMessage = "Mobile number must be 8-15 digits with country code.")]
    public string? MobileNo { get; set; }
    [Required, RegularExpression("ADMIN|STAFF")] public string Role { get; set; } = Roles.Staff;
    [Required, RegularExpression("T|F")] public string IsActive { get; set; } = "T";
    // Blank on update = keep the current password.
    [MinLength(6), MaxLength(100)] public string? Password { get; set; }
}

// ---------- Companies (super admin) ----------

public class CompanyRow
{
    public int CompanyId { get; set; }
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? AdminName { get; set; }
    public string? AdminEmail { get; set; }
    public string? DisplayNumber { get; set; }
    public int Users { get; set; }
    public int Customers { get; set; }
    public int Messages { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

public class SetCompanyStatusDto
{
    [Required, RegularExpression("PENDING|ACTIVE|SUSPENDED")] public string Status { get; set; } = string.Empty;
}

// ---------- WhatsApp settings ----------

public class WhatsAppSettings
{
    public int CompanyId { get; set; }
    public string? WabaId { get; set; }
    public string? PhoneNumberId { get; set; }
    public string? DisplayNumber { get; set; }
    public string? AccessToken { get; set; }
    public string? VerifyToken { get; set; }
    public string? AppSecret { get; set; }
    public string IsVerified { get; set; } = "F";
    public string? VerifiedName { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// Secrets are never sent to the browser, only whether they are set.
public class WhatsAppSettingsView
{
    public string CompanyCode { get; set; } = string.Empty;
    public string? WabaId { get; set; }
    public string? PhoneNumberId { get; set; }
    public string? DisplayNumber { get; set; }
    public string? VerifyToken { get; set; }
    public string HasAccessToken { get; set; } = "F";
    public string HasAppSecret { get; set; } = "F";
    public string IsVerified { get; set; } = "F";
    public string? VerifiedName { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public static WhatsAppSettingsView From(string companyCode, WhatsAppSettings? s) => new()
    {
        CompanyCode = companyCode,
        WabaId = s?.WabaId,
        PhoneNumberId = s?.PhoneNumberId,
        DisplayNumber = s?.DisplayNumber,
        VerifyToken = s?.VerifyToken,
        HasAccessToken = string.IsNullOrEmpty(s?.AccessToken) ? "F" : "T",
        HasAppSecret = string.IsNullOrEmpty(s?.AppSecret) ? "F" : "T",
        IsVerified = s?.IsVerified ?? "F",
        VerifiedName = s?.VerifiedName,
        UpdatedAt = s?.UpdatedAt
    };
}

public class SaveWhatsAppSettingsDto
{
    [MaxLength(50)] public string? WabaId { get; set; }
    [Required, MaxLength(50)] public string PhoneNumberId { get; set; } = string.Empty;
    [MaxLength(30)] public string? DisplayNumber { get; set; }
    [MaxLength(1000)] public string? AccessToken { get; set; }
    [Required, MaxLength(200)] public string VerifyToken { get; set; } = string.Empty;
    [MaxLength(200)] public string? AppSecret { get; set; }
}

// ---------- Customers / inbox ----------

public class CustomerRow
{
    public int CustomerId { get; set; }
    public int CompanyId { get; set; }
    public string? MobileNo { get; set; }
    public string? CustomerName { get; set; }
    public string? Email { get; set; }
    public string? WhatsappName { get; set; }
    public string ChatState { get; set; } = "DONE";
    public string Source { get; set; } = "WhatsApp";
    public int? AssignedTo { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime? AssignedAt { get; set; }
    public int UnreadCount { get; set; }
    public DateTime? LastInboundAt { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int EmailUnreadCount { get; set; }
    public DateTime? LastEmailAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SaveCustomerDto
{
    // Email-only customers have no mobile; at least one of mobile / email is required.
    [MaxLength(20), RegularExpression(@"^\d{8,15}$", ErrorMessage = "Mobile number must be 8-15 digits with country code.")]
    public string? MobileNo { get; set; }
    [MaxLength(150)] public string? CustomerName { get; set; }
    [EmailAddress, MaxLength(150)] public string? Email { get; set; }
}

public class AssignDto
{
    public int? UserId { get; set; }
}

public class ConversationRow
{
    public int CustomerId { get; set; }
    public string? MobileNo { get; set; }
    public string? CustomerName { get; set; }
    public string? WhatsappName { get; set; }
    public string? Email { get; set; }
    public int? AssignedTo { get; set; }
    public string? AssignedToName { get; set; }
    public int UnreadCount { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime? LastInboundAt { get; set; }
    public string? LastBody { get; set; }
    public string? LastDirection { get; set; }
    public string? LastType { get; set; }
}

public class MessageRow
{
    public int MessageId { get; set; }
    public string Direction { get; set; } = "IN";
    public string MsgType { get; set; } = "text";
    public string? Body { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorText { get; set; }
    public string IsBot { get; set; } = "F";
    public string? SentByName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AssignmentRow
{
    public string? FromName { get; set; }
    public string? ToName { get; set; }
    public string? AssignedByName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SendMessageDto
{
    [Required, MaxLength(4096)] public string Text { get; set; } = string.Empty;
}

// ---------- Email ----------

public class EmailSettings
{
    public int CompanyId { get; set; }
    public string EmailAddress { get; set; } = string.Empty;
    public string? FromName { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Password { get; set; }
    public string ImapHost { get; set; } = string.Empty;
    public int ImapPort { get; set; } = 993;
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string IsVerified { get; set; } = "F";
    public long? UidValidity { get; set; }
    public long? LastUid { get; set; }
    public DateTime? LastCheckedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class EmailSettingsView
{
    public string? EmailAddress { get; set; }
    public string? FromName { get; set; }
    public string? Username { get; set; }
    public string HasPassword { get; set; } = "F";
    public string? ImapHost { get; set; }
    public int ImapPort { get; set; } = 993;
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string IsVerified { get; set; } = "F";
    public DateTime? LastCheckedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public static EmailSettingsView From(EmailSettings? s) => s is null ? new() : new()
    {
        EmailAddress = s.EmailAddress,
        FromName = s.FromName,
        Username = s.Username,
        HasPassword = string.IsNullOrEmpty(s.Password) ? "F" : "T",
        ImapHost = s.ImapHost,
        ImapPort = s.ImapPort,
        SmtpHost = s.SmtpHost,
        SmtpPort = s.SmtpPort,
        IsVerified = s.IsVerified,
        LastCheckedAt = s.LastCheckedAt,
        LastError = s.LastError,
        UpdatedAt = s.UpdatedAt
    };
}

public class SaveEmailSettingsDto
{
    [Required, EmailAddress, MaxLength(150)] public string EmailAddress { get; set; } = string.Empty;
    [MaxLength(150)] public string? FromName { get; set; }
    [Required, MaxLength(150)] public string Username { get; set; } = string.Empty;
    // Blank = keep the saved password.
    [MaxLength(500)] public string? Password { get; set; }
    [Required, MaxLength(150)] public string ImapHost { get; set; } = string.Empty;
    [Range(1, 65535)] public int ImapPort { get; set; } = 993;
    [Required, MaxLength(150)] public string SmtpHost { get; set; } = string.Empty;
    [Range(1, 65535)] public int SmtpPort { get; set; } = 587;
}

public class EmailConversationRow
{
    public int CustomerId { get; set; }
    public string? MobileNo { get; set; }
    public string? CustomerName { get; set; }
    public string? WhatsappName { get; set; }
    public string? Email { get; set; }
    public int? AssignedTo { get; set; }
    public string? AssignedToName { get; set; }
    public int EmailUnreadCount { get; set; }
    public DateTime? LastEmailAt { get; set; }
    public string? LastSubject { get; set; }
    public string? LastBody { get; set; }
    public string? LastDirection { get; set; }
}

public class EmailRow
{
    public int EmailId { get; set; }
    public string Direction { get; set; } = "IN";
    public string? MessageId { get; set; }
    public string? Subject { get; set; }
    public string? FromAddress { get; set; }
    public string? ToAddress { get; set; }
    public string? Body { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorText { get; set; }
    public string? SentByName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SendEmailDto
{
    [Required, MaxLength(500)] public string Subject { get; set; } = string.Empty;
    [Required, MaxLength(100000)] public string Body { get; set; } = string.Empty;
}

// ---------- Notes ----------

public class NoteRow
{
    public int NoteId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Content { get; set; }
    public string? CreatedByName { get; set; }
    public string? UpdatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SaveNoteDto
{
    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    public string? Content { get; set; }
}

// ---------- Properties ----------

public class PropertyRow
{
    public int PropertyId { get; set; }
    public int RefSeq { get; set; }
    public string RefNo => $"PRP-{RefSeq:D5}";
    public string Title { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public string PropertyType { get; set; } = string.Empty;
    public string Completion { get; set; } = "READY";
    public string Status { get; set; } = "AVAILABLE";
    public string Emirate { get; set; } = string.Empty;
    public string? Community { get; set; }
    public string? SubCommunity { get; set; }
    public string? Developer { get; set; }
    public string? MapUrl { get; set; }
    public int? Bedrooms { get; set; }
    public int? Bathrooms { get; set; }
    public decimal? BuaSqft { get; set; }
    public decimal? PlotSqft { get; set; }
    public int? Parking { get; set; }
    public string? ViewType { get; set; }
    public string? FloorNo { get; set; }
    public decimal Price { get; set; }
    public string? RentFrequency { get; set; }
    public int? Cheques { get; set; }
    public decimal? ServiceCharge { get; set; }
    public decimal? CommissionPct { get; set; }
    public DateTime? HandoverDate { get; set; }
    public string? PaymentPlan { get; set; }
    public int? CompletionPct { get; set; }
    public string? PermitNo { get; set; }
    public string? TitleDeedNo { get; set; }
    public string? OwnerName { get; set; }
    public string? OwnerMobile { get; set; }
    public string? OwnerEmail { get; set; }
    public string? Furnishing { get; set; }
    public string? Amenities { get; set; }
    public string? Description { get; set; }
    public string IsFeatured { get; set; } = "F";
    public int? AgentId { get; set; }
    public string? AgentName { get; set; }
    public string? CoverFile { get; set; }
    public int ImageCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<PropertyFileRow> Files { get; set; } = new();
}

public class PropertyFileRow
{
    public int FileId { get; set; }
    public int PropertyId { get; set; }
    public string FileKind { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string IsCover { get; set; } = "F";
    public DateTime CreatedAt { get; set; }
}

public class SavePropertyDto
{
    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    [Required, RegularExpression("SALE|RENT")] public string Purpose { get; set; } = string.Empty;
    [Required, RegularExpression("APARTMENT|VILLA|TOWNHOUSE|PENTHOUSE|DUPLEX|HOTEL_APT|OFFICE|SHOP|WAREHOUSE|LAND|BUILDING")]
    public string PropertyType { get; set; } = string.Empty;
    [Required, RegularExpression("READY|OFFPLAN")] public string Completion { get; set; } = "READY";
    [Required, RegularExpression("AVAILABLE|RESERVED|SOLD|RENTED|OFF_MARKET")] public string Status { get; set; } = "AVAILABLE";
    [Required, MaxLength(30)] public string Emirate { get; set; } = string.Empty;
    [MaxLength(150)] public string? Community { get; set; }
    [MaxLength(150)] public string? SubCommunity { get; set; }
    [MaxLength(150)] public string? Developer { get; set; }
    [MaxLength(500), Url] public string? MapUrl { get; set; }
    [Range(0, 20)] public int? Bedrooms { get; set; }
    [Range(0, 20)] public int? Bathrooms { get; set; }
    [Range(0, 10000000)] public decimal? BuaSqft { get; set; }
    [Range(0, 100000000)] public decimal? PlotSqft { get; set; }
    [Range(0, 100)] public int? Parking { get; set; }
    [MaxLength(100)] public string? ViewType { get; set; }
    [MaxLength(20)] public string? FloorNo { get; set; }
    [Range(0, 10000000000)] public decimal Price { get; set; }
    [RegularExpression("YEARLY|MONTHLY")] public string? RentFrequency { get; set; }
    [Range(1, 12)] public int? Cheques { get; set; }
    [Range(0, 10000)] public decimal? ServiceCharge { get; set; }
    [Range(0, 100)] public decimal? CommissionPct { get; set; }
    public DateTime? HandoverDate { get; set; }
    [MaxLength(100)] public string? PaymentPlan { get; set; }
    [Range(0, 100)] public int? CompletionPct { get; set; }
    [MaxLength(50)] public string? PermitNo { get; set; }
    [MaxLength(50)] public string? TitleDeedNo { get; set; }
    [MaxLength(150)] public string? OwnerName { get; set; }
    [MaxLength(20)] public string? OwnerMobile { get; set; }
    [EmailAddress, MaxLength(150)] public string? OwnerEmail { get; set; }
    [RegularExpression("FURNISHED|SEMI|UNFURNISHED")] public string? Furnishing { get; set; }
    [MaxLength(1000)] public string? Amenities { get; set; }
    public string? Description { get; set; }
    [Required, RegularExpression("T|F")] public string IsFeatured { get; set; } = "F";
    public int? AgentId { get; set; }
}

// ---------- Services ----------

public class ServiceRow
{
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal? Price { get; set; }
    public string? PriceNote { get; set; }
    public string? Description { get; set; }
    public string IsActive { get; set; } = "T";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SaveServiceDto
{
    [Required, MaxLength(150)] public string ServiceName { get; set; } = string.Empty;
    [Required, MaxLength(50)] public string Category { get; set; } = string.Empty;
    [Range(0, 10000000000)] public decimal? Price { get; set; }
    [MaxLength(50)] public string? PriceNote { get; set; }
    [MaxLength(2000)] public string? Description { get; set; }
    [Required, RegularExpression("T|F")] public string IsActive { get; set; } = "T";
}

// ---------- Dashboard ----------

public class DashboardStats
{
    public int TotalCustomers { get; set; }
    public int NewToday { get; set; }
    public int Unassigned { get; set; }
    public int UnreadChats { get; set; }
    public int MessagesToday { get; set; }
    public int OpenWindows { get; set; }
}

public class StaffLoad
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string IsActive { get; set; } = "T";
    public int Customers { get; set; }
    public int UnreadChats { get; set; }
    public int RepliesToday { get; set; }
}
