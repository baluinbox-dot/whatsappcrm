/* =============================================================================
   Projects (a development with common features) and lead buying requirements.
   - wsm_projects: number, name, description, location, developer, amenities and price plan.
   - wsm_project_payments: the payment schedule (step-down payments) of a project.
   - wsm_properties.project_id: a property (unit) belongs to one project and inherits its
     location, developer, handover and payment plan. Rate and size stay on the property.
   - wsm_leads: down payment, monthly EMI, self plan / ready to buy, pre-approved / developer
     finance and minimum amenities.
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.wsm_projects', 'U') IS NULL
CREATE TABLE dbo.wsm_projects (
    project_id       INT IDENTITY(1,1) PRIMARY KEY,
    company_id       INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    project_seq      INT            NOT NULL,                  -- shown as PRJ-00001, numbered per company
    project_name     NVARCHAR(200)  NOT NULL,
    description      NVARCHAR(MAX)  NULL,
    project_type     VARCHAR(20)    NOT NULL DEFAULT 'COMMUNITY', -- APARTMENT / COMMUNITY / VILLAGE / GATED_COMMUNITY / ...
    developer        NVARCHAR(150)  NULL,
    emirate          NVARCHAR(30)   NOT NULL,
    community        NVARCHAR(150)  NULL,
    map_url          NVARCHAR(500)  NULL,
    completion       VARCHAR(10)    NOT NULL DEFAULT 'OFFPLAN', -- READY / OFFPLAN
    handover_date    DATE           NULL,
    completion_pct   INT            NULL,
    amenities        NVARCHAR(1000) NULL,                      -- comma separated
    down_payment_pct DECIMAL(5,2)   NULL,                      -- share of the price paid up front
    payment_plan     NVARCHAR(100)  NULL,                      -- short text, e.g. 60/40
    is_active        CHAR(1)        NOT NULL DEFAULT 'T',
    created_by       INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_wsm_projects_seq UNIQUE (company_id, project_seq)
);
GO

IF OBJECT_ID('dbo.wsm_project_payments', 'U') IS NULL
CREATE TABLE dbo.wsm_project_payments (
    payment_id     INT IDENTITY(1,1) PRIMARY KEY,
    project_id     INT            NOT NULL REFERENCES dbo.wsm_projects(project_id) ON DELETE CASCADE,
    step_no        INT            NOT NULL,
    label          NVARCHAR(100)  NOT NULL,                  -- e.g. On booking, On handover
    percent_due    DECIMAL(5,2)   NOT NULL,
    due_note       NVARCHAR(100)  NULL                       -- e.g. Within 30 days, Q4 2026
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_project_payments_project')
    CREATE INDEX IX_wsm_project_payments_project ON dbo.wsm_project_payments(project_id, step_no);
GO

IF COL_LENGTH('dbo.wsm_properties', 'project_id') IS NULL
    ALTER TABLE dbo.wsm_properties ADD project_id INT NULL REFERENCES dbo.wsm_projects(project_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_properties_project')
    CREATE INDEX IX_wsm_properties_project ON dbo.wsm_properties(project_id);
GO

IF COL_LENGTH('dbo.wsm_leads', 'down_payment_max') IS NULL
    ALTER TABLE dbo.wsm_leads ADD down_payment_max DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.wsm_leads', 'monthly_emi_max') IS NULL
    ALTER TABLE dbo.wsm_leads ADD monthly_emi_max DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.wsm_leads', 'buy_plan') IS NULL
    ALTER TABLE dbo.wsm_leads ADD buy_plan VARCHAR(15) NULL;     -- SELF_PLAN / READY_TO_BUY
IF COL_LENGTH('dbo.wsm_leads', 'min_amenities') IS NULL
    ALTER TABLE dbo.wsm_leads ADD min_amenities NVARCHAR(1000) NULL;
GO

-- finance now also holds PRE_APPROVED / DEVELOPER (longer than the old VARCHAR(10)).
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.wsm_leads') AND name = 'finance' AND max_length < 15)
    ALTER TABLE dbo.wsm_leads ALTER COLUMN finance VARCHAR(15) NULL;
GO

PRINT 'Projects ready.';
GO
