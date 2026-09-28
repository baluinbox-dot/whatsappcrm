/* =============================================================================
   Matching & sharing properties with leads, public property pages, and the
   WhatsApp bot asking Buy / Rent, area and budget.
   - wsm_properties.public_code: random code in the public link /p/<code>.
   - wsm_customers.bot_lead_id: the lead the bot is filling in while it asks.
   - wsm_lead_shares: which property was sent to which lead, when and how.
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.wsm_properties', 'public_code') IS NULL
    ALTER TABLE dbo.wsm_properties ADD public_code VARCHAR(12) NULL;
GO

UPDATE dbo.wsm_properties
SET public_code = LOWER(LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 12))
WHERE public_code IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wsm_properties_public_code')
    CREATE UNIQUE INDEX UX_wsm_properties_public_code ON dbo.wsm_properties(public_code) WHERE public_code IS NOT NULL;
GO

-- New bot states (ASK_PURPOSE, ASK_BUDGET...) are longer than the old VARCHAR(10).
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.wsm_customers') AND name = 'chat_state' AND max_length < 20)
BEGIN
    DECLARE @df SYSNAME = (SELECT d.name FROM sys.default_constraints d
                           JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
                           WHERE d.parent_object_id = OBJECT_ID('dbo.wsm_customers') AND c.name = 'chat_state');
    IF @df IS NOT NULL EXEC('ALTER TABLE dbo.wsm_customers DROP CONSTRAINT ' + @df);
    ALTER TABLE dbo.wsm_customers ALTER COLUMN chat_state VARCHAR(20) NOT NULL;
    ALTER TABLE dbo.wsm_customers ADD CONSTRAINT DF_wsm_customers_chat_state DEFAULT 'DONE' FOR chat_state;
END
GO

IF COL_LENGTH('dbo.wsm_customers', 'bot_lead_id') IS NULL
    ALTER TABLE dbo.wsm_customers ADD bot_lead_id INT NULL;
GO

IF OBJECT_ID('dbo.wsm_lead_shares', 'U') IS NULL
CREATE TABLE dbo.wsm_lead_shares (
    share_id     INT IDENTITY(1,1) PRIMARY KEY,
    company_id   INT          NOT NULL REFERENCES dbo.wsm_companies(company_id),
    lead_id      INT          NOT NULL REFERENCES dbo.wsm_leads(lead_id) ON DELETE CASCADE,
    property_id  INT          NOT NULL REFERENCES dbo.wsm_properties(property_id),
    channel      VARCHAR(10)  NOT NULL,                 -- WHATSAPP / EMAIL
    shared_by    INT          NULL REFERENCES dbo.wsm_users(user_id),
    shared_at    DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_lead_shares_lead')
    CREATE INDEX IX_wsm_lead_shares_lead ON dbo.wsm_lead_shares(lead_id, property_id);
GO

PRINT 'Matching and sharing ready.';
GO
