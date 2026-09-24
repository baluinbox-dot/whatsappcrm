/* =============================================================================
   Email inbox: each company connects one mailbox (IMAP to receive, SMTP to send).
   A new sender becomes a customer (email + name), assigned to staff like WhatsApp.
   - Customers may now have only an email, so mobile_no becomes optional.
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

-- Filtered indexes need this; old sqlcmd versions default it OFF.
SET QUOTED_IDENTIFIER ON;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UX_wsm_customers_mobile')
    ALTER TABLE dbo.wsm_customers DROP CONSTRAINT UX_wsm_customers_mobile;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.wsm_customers') AND name = 'mobile_no' AND is_nullable = 0)
    ALTER TABLE dbo.wsm_customers ALTER COLUMN mobile_no NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_customers_mobile_notnull')
    CREATE UNIQUE INDEX UX_wsm_customers_mobile_notnull ON dbo.wsm_customers(company_id, mobile_no) WHERE mobile_no IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_customers_email')
    CREATE INDEX IX_wsm_customers_email ON dbo.wsm_customers(company_id, email);
GO

IF COL_LENGTH('dbo.wsm_customers', 'email_unread_count') IS NULL
    ALTER TABLE dbo.wsm_customers ADD email_unread_count INT NOT NULL CONSTRAINT DF_wsm_customers_email_unread DEFAULT 0;
IF COL_LENGTH('dbo.wsm_customers', 'last_email_at') IS NULL
    ALTER TABLE dbo.wsm_customers ADD last_email_at DATETIME2 NULL;
GO

IF OBJECT_ID('dbo.wsm_email_settings', 'U') IS NULL
CREATE TABLE dbo.wsm_email_settings (
    company_id       INT            NOT NULL PRIMARY KEY REFERENCES dbo.wsm_companies(company_id),
    email_address    NVARCHAR(150)  NOT NULL,
    from_name        NVARCHAR(150)  NULL,
    username         NVARCHAR(150)  NOT NULL,
    password         NVARCHAR(500)  NULL,
    imap_host        NVARCHAR(150)  NOT NULL,
    imap_port        INT            NOT NULL DEFAULT 993,
    smtp_host        NVARCHAR(150)  NOT NULL,
    smtp_port        INT            NOT NULL DEFAULT 587,
    is_verified      CHAR(1)        NOT NULL DEFAULT 'F',
    uid_validity     BIGINT         NULL,
    last_uid         BIGINT         NULL,      -- highest IMAP UID already imported
    last_checked_at  DATETIME2      NULL,
    last_error       NVARCHAR(500)  NULL,
    updated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.wsm_emails', 'U') IS NULL
CREATE TABLE dbo.wsm_emails (
    email_id       INT IDENTITY(1,1) PRIMARY KEY,
    company_id     INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    customer_id    INT            NOT NULL REFERENCES dbo.wsm_customers(customer_id) ON DELETE CASCADE,
    direction      VARCHAR(3)     NOT NULL,                  -- IN / OUT
    message_id     NVARCHAR(500)  NULL,                      -- RFC Message-ID header
    subject        NVARCHAR(500)  NULL,
    from_address   NVARCHAR(150)  NULL,
    to_address     NVARCHAR(150)  NULL,
    body           NVARCHAR(MAX)  NULL,
    status         VARCHAR(20)    NOT NULL,                  -- received / sent / failed
    error_text     NVARCHAR(500)  NULL,
    sent_by        INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_emails_customer')
    CREATE INDEX IX_wsm_emails_customer ON dbo.wsm_emails(customer_id, created_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_emails_message_id')
    CREATE INDEX IX_wsm_emails_message_id ON dbo.wsm_emails(company_id, message_id) WHERE message_id IS NOT NULL;
GO

PRINT 'Email inbox ready.';
GO
