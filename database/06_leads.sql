/* =============================================================================
   Leads: an enquiry from a customer (buy / rent requirements), worked by one
   staff member through a status pipeline, with a timeline of activities and
   scheduled follow-ups.
   - Assigning a lead also assigns its customer, so the agent can chat / email.
   - Property links are cleared by the API before a property is deleted (SQL Server
     does not allow a second cascade path to activities / follow-ups).
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.wsm_leads', 'U') IS NULL
CREATE TABLE dbo.wsm_leads (
    lead_id            INT IDENTITY(1,1) PRIMARY KEY,
    company_id         INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    lead_seq           INT            NOT NULL,                  -- shown as LD-00001, numbered per company
    customer_id        INT            NOT NULL REFERENCES dbo.wsm_customers(customer_id) ON DELETE CASCADE,
    source             VARCHAR(20)    NOT NULL,                  -- WHATSAPP / EMAIL / BAYUT / PROPERTY_FINDER / ...
    purpose            VARCHAR(10)    NOT NULL,                  -- BUY / RENT
    property_type      VARCHAR(20)    NULL,                      -- same codes as wsm_properties
    emirate            NVARCHAR(30)   NULL,
    communities        NVARCHAR(500)  NULL,                      -- comma separated
    bedrooms_min       INT            NULL,                      -- 0 = Studio
    bedrooms_max       INT            NULL,
    budget_min         DECIMAL(18,2)  NULL,                      -- AED
    budget_max         DECIMAL(18,2)  NULL,
    finance            VARCHAR(10)    NULL,                      -- CASH / MORTGAGE
    completion         VARCHAR(10)    NULL,                      -- READY / OFFPLAN / ANY
    move_timeline      VARCHAR(20)    NULL,                      -- IMMEDIATE / 1_3_MONTHS / 3_6_MONTHS / 6_PLUS / JUST_LOOKING
    nationality        NVARCHAR(50)   NULL,
    buyer_type         VARCHAR(10)    NULL,                      -- END_USER / INVESTOR
    requirements       NVARCHAR(2000) NULL,
    status             VARCHAR(20)    NOT NULL DEFAULT 'NEW',
    priority           VARCHAR(5)     NOT NULL DEFAULT 'WARM',   -- HOT / WARM / COLD
    lost_reason        VARCHAR(20)    NULL,
    won_property_id    INT            NULL REFERENCES dbo.wsm_properties(property_id),
    deal_value         DECIMAL(18,2)  NULL,
    commission_amount  DECIMAL(18,2)  NULL,
    closed_at          DATETIME2      NULL,
    assigned_to        INT            NULL REFERENCES dbo.wsm_users(user_id),
    assigned_at        DATETIME2      NULL,
    created_by         INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_wsm_leads_seq UNIQUE (company_id, lead_seq)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_leads_company')
    CREATE INDEX IX_wsm_leads_company ON dbo.wsm_leads(company_id, status, assigned_to);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_leads_customer')
    CREATE INDEX IX_wsm_leads_customer ON dbo.wsm_leads(customer_id);
GO

IF OBJECT_ID('dbo.wsm_lead_activities', 'U') IS NULL
CREATE TABLE dbo.wsm_lead_activities (
    activity_id    INT IDENTITY(1,1) PRIMARY KEY,
    company_id     INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    lead_id        INT            NOT NULL REFERENCES dbo.wsm_leads(lead_id) ON DELETE CASCADE,
    activity_type  VARCHAR(10)    NOT NULL,                  -- NOTE / CALL / MEETING / VIEWING / STATUS / ASSIGN / CREATED
    body           NVARCHAR(2000) NULL,
    outcome        VARCHAR(20)    NULL,                      -- calls: ANSWERED / NO_ANSWER / BUSY / SWITCHED_OFF / WRONG_NUMBER
    property_id    INT            NULL REFERENCES dbo.wsm_properties(property_id),
    status_from    VARCHAR(20)    NULL,
    status_to      VARCHAR(20)    NULL,
    created_by     INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_lead_activities_lead')
    CREATE INDEX IX_wsm_lead_activities_lead ON dbo.wsm_lead_activities(lead_id, created_at);
GO

IF OBJECT_ID('dbo.wsm_follow_ups', 'U') IS NULL
CREATE TABLE dbo.wsm_follow_ups (
    follow_up_id   INT IDENTITY(1,1) PRIMARY KEY,
    company_id     INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    lead_id        INT            NOT NULL REFERENCES dbo.wsm_leads(lead_id) ON DELETE CASCADE,
    follow_up_type VARCHAR(10)    NOT NULL,                  -- CALL / WHATSAPP / EMAIL / MEETING / VIEWING
    due_at         DATETIME2      NOT NULL,                  -- UTC
    notes          NVARCHAR(1000) NULL,
    property_id    INT            NULL REFERENCES dbo.wsm_properties(property_id),
    assigned_to    INT            NULL REFERENCES dbo.wsm_users(user_id),
    is_done        CHAR(1)        NOT NULL DEFAULT 'F',
    done_at        DATETIME2      NULL,
    done_by        INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_by     INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_follow_ups_due')
    CREATE INDEX IX_wsm_follow_ups_due ON dbo.wsm_follow_ups(company_id, is_done, due_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_follow_ups_lead')
    CREATE INDEX IX_wsm_follow_ups_lead ON dbo.wsm_follow_ups(lead_id);
GO

PRINT 'Leads ready.';
GO
