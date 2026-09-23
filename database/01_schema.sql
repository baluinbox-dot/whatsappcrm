/* =============================================================================
   WhatsApp CRM - schema. All tables are prefixed wsm_ and live in the shared
   project_management database next to (but independent of) the PM tables.
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

IF OBJECT_ID('dbo.wsm_companies', 'U') IS NULL
CREATE TABLE dbo.wsm_companies (
    company_id     INT IDENTITY(1,1) PRIMARY KEY,
    company_code   VARCHAR(20)    NOT NULL,            -- used in the webhook URL
    company_name   NVARCHAR(150)  NOT NULL,
    status         VARCHAR(10)    NOT NULL DEFAULT 'PENDING',   -- PENDING / ACTIVE / SUSPENDED
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    approved_at    DATETIME2      NULL,
    CONSTRAINT UX_wsm_companies_code UNIQUE (company_code)
);
GO

IF OBJECT_ID('dbo.wsm_users', 'U') IS NULL
CREATE TABLE dbo.wsm_users (
    user_id         INT IDENTITY(1,1) PRIMARY KEY,
    company_id      INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    full_name       NVARCHAR(150)  NOT NULL,
    email           NVARCHAR(150)  NULL,                       -- required for admins; staff may sign in by mobile
    mobile_no       NVARCHAR(20)   NULL,
    password_hash   NVARCHAR(255)  NULL,
    role            VARCHAR(10)    NOT NULL DEFAULT 'STAFF',    -- ADMIN / STAFF
    is_super_admin  CHAR(1)        NOT NULL DEFAULT 'F',
    is_active       CHAR(1)        NOT NULL DEFAULT 'T',
    last_login_at   DATETIME2      NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_users_email_notnull')
    CREATE UNIQUE INDEX UX_wsm_users_email_notnull ON dbo.wsm_users(email) WHERE email IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_users_company_mobile')
    CREATE UNIQUE INDEX UX_wsm_users_company_mobile ON dbo.wsm_users(company_id, mobile_no) WHERE mobile_no IS NOT NULL;
GO

IF OBJECT_ID('dbo.wsm_password_resets', 'U') IS NULL
CREATE TABLE dbo.wsm_password_resets (
    reset_id    INT IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL REFERENCES dbo.wsm_users(user_id),
    token_hash  NVARCHAR(64)  NOT NULL,
    expires_at  DATETIME2     NOT NULL,
    used_at     DATETIME2     NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_wsm_password_resets_hash UNIQUE (token_hash)
);
GO

IF OBJECT_ID('dbo.wsm_whatsapp_settings', 'U') IS NULL
CREATE TABLE dbo.wsm_whatsapp_settings (
    company_id       INT            NOT NULL PRIMARY KEY REFERENCES dbo.wsm_companies(company_id),
    waba_id          NVARCHAR(50)   NULL,
    phone_number_id  NVARCHAR(50)   NULL,
    display_number   NVARCHAR(30)   NULL,
    access_token     NVARCHAR(1000) NULL,
    verify_token     NVARCHAR(200)  NULL,
    app_secret       NVARCHAR(200)  NULL,
    is_verified      CHAR(1)        NOT NULL DEFAULT 'F',
    verified_name    NVARCHAR(200)  NULL,
    updated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.wsm_customers', 'U') IS NULL
CREATE TABLE dbo.wsm_customers (
    customer_id      INT IDENTITY(1,1) PRIMARY KEY,
    company_id       INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    mobile_no        NVARCHAR(20)   NOT NULL,
    customer_name    NVARCHAR(150)  NULL,
    email            NVARCHAR(150)  NULL,
    whatsapp_name    NVARCHAR(150)  NULL,
    chat_state       VARCHAR(10)    NOT NULL DEFAULT 'DONE',     -- ASK_NAME / ASK_EMAIL / DONE
    source           VARCHAR(20)    NOT NULL DEFAULT 'WhatsApp',
    assigned_to      INT            NULL REFERENCES dbo.wsm_users(user_id),
    assigned_at      DATETIME2      NULL,
    unread_count     INT            NOT NULL DEFAULT 0,
    last_inbound_at  DATETIME2      NULL,
    last_message_at  DATETIME2      NULL,
    created_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_wsm_customers_mobile UNIQUE (company_id, mobile_no)
);
GO

IF OBJECT_ID('dbo.wsm_messages', 'U') IS NULL
CREATE TABLE dbo.wsm_messages (
    message_id     INT IDENTITY(1,1) PRIMARY KEY,
    company_id     INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    customer_id    INT            NOT NULL REFERENCES dbo.wsm_customers(customer_id) ON DELETE CASCADE,
    wa_message_id  NVARCHAR(200)  NULL,
    direction      VARCHAR(3)     NOT NULL,                  -- IN / OUT
    msg_type       VARCHAR(20)    NOT NULL DEFAULT 'text',
    body           NVARCHAR(MAX)  NULL,
    status         VARCHAR(20)    NOT NULL,                  -- received / sent / delivered / read / failed
    error_text     NVARCHAR(500)  NULL,
    is_bot         CHAR(1)        NOT NULL DEFAULT 'F',
    sent_by        INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_messages_wa_id')
    CREATE UNIQUE INDEX UX_wsm_messages_wa_id ON dbo.wsm_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_messages_customer')
    CREATE INDEX IX_wsm_messages_customer ON dbo.wsm_messages(customer_id, created_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_customers_assigned')
    CREATE INDEX IX_wsm_customers_assigned ON dbo.wsm_customers(company_id, assigned_to);
GO

IF OBJECT_ID('dbo.wsm_assignment_history', 'U') IS NULL
CREATE TABLE dbo.wsm_assignment_history (
    history_id   INT IDENTITY(1,1) PRIMARY KEY,
    company_id   INT        NOT NULL REFERENCES dbo.wsm_companies(company_id),
    customer_id  INT        NOT NULL REFERENCES dbo.wsm_customers(customer_id) ON DELETE CASCADE,
    from_user_id INT        NULL REFERENCES dbo.wsm_users(user_id),
    to_user_id   INT        NULL REFERENCES dbo.wsm_users(user_id),
    assigned_by  INT        NULL REFERENCES dbo.wsm_users(user_id),
    created_at   DATETIME2  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.wsm_notes', 'U') IS NULL
CREATE TABLE dbo.wsm_notes (
    note_id     INT IDENTITY(1,1) PRIMARY KEY,
    company_id  INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    title       NVARCHAR(200)  NOT NULL,
    content     NVARCHAR(MAX)  NULL,
    created_by  INT            NULL REFERENCES dbo.wsm_users(user_id),
    updated_by  INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'WhatsApp CRM schema ready.';
GO
