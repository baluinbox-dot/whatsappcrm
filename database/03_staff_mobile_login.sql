/* =============================================================================
   Staff sign in with: company admin email + staff mobile number + password.
   - Email becomes optional (staff may have none); still unique when present.
   - Mobile number is unique within a company.
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UX_wsm_users_email')
    ALTER TABLE dbo.wsm_users DROP CONSTRAINT UX_wsm_users_email;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.wsm_users') AND name = 'email' AND is_nullable = 0)
    ALTER TABLE dbo.wsm_users ALTER COLUMN email NVARCHAR(150) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_users_email_notnull')
    CREATE UNIQUE INDEX UX_wsm_users_email_notnull ON dbo.wsm_users(email) WHERE email IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_users_company_mobile')
    CREATE UNIQUE INDEX UX_wsm_users_company_mobile ON dbo.wsm_users(company_id, mobile_no) WHERE mobile_no IS NOT NULL;
GO

PRINT 'Staff mobile sign-in ready.';
GO
