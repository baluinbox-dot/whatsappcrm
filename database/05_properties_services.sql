/* =============================================================================
   Properties (UAE real estate listings) and Services catalog.
   - Property images / floor plans / brochures are stored on the API server disk;
     wsm_property_files keeps one row per file.
   Safe to re-run.
   ============================================================================= */
USE project_management;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.wsm_properties', 'U') IS NULL
CREATE TABLE dbo.wsm_properties (
    property_id      INT IDENTITY(1,1) PRIMARY KEY,
    company_id       INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    ref_seq          INT            NOT NULL,                  -- shown as PRP-00001, numbered per company
    title            NVARCHAR(200)  NOT NULL,
    purpose          VARCHAR(10)    NOT NULL,                  -- SALE / RENT
    property_type    VARCHAR(20)    NOT NULL,                  -- APARTMENT / VILLA / TOWNHOUSE / ...
    completion       VARCHAR(10)    NOT NULL DEFAULT 'READY',  -- READY / OFFPLAN
    status           VARCHAR(12)    NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE / RESERVED / SOLD / RENTED / OFF_MARKET
    emirate          NVARCHAR(30)   NOT NULL,
    community        NVARCHAR(150)  NULL,
    sub_community    NVARCHAR(150)  NULL,                      -- building / project / cluster
    developer        NVARCHAR(150)  NULL,
    map_url          NVARCHAR(500)  NULL,
    bedrooms         INT            NULL,                      -- 0 = Studio
    bathrooms        INT            NULL,
    bua_sqft         DECIMAL(12,2)  NULL,
    plot_sqft        DECIMAL(12,2)  NULL,
    parking          INT            NULL,
    view_type        NVARCHAR(100)  NULL,
    floor_no         NVARCHAR(20)   NULL,
    price            DECIMAL(18,2)  NOT NULL,                  -- AED; for rent this is the yearly / monthly rent
    rent_frequency   VARCHAR(10)    NULL,                      -- YEARLY / MONTHLY
    cheques          INT            NULL,
    service_charge   DECIMAL(10,2)  NULL,                      -- AED per sq.ft per year
    commission_pct   DECIMAL(5,2)   NULL,
    handover_date    DATE           NULL,
    payment_plan     NVARCHAR(100)  NULL,
    completion_pct   INT            NULL,
    permit_no        NVARCHAR(50)   NULL,                      -- Trakheesi / RERA permit
    title_deed_no    NVARCHAR(50)   NULL,
    owner_name       NVARCHAR(150)  NULL,
    owner_mobile     NVARCHAR(20)   NULL,
    owner_email      NVARCHAR(150)  NULL,
    furnishing       VARCHAR(12)    NULL,                      -- FURNISHED / SEMI / UNFURNISHED
    amenities        NVARCHAR(1000) NULL,                      -- comma separated
    description      NVARCHAR(MAX)  NULL,
    is_featured      CHAR(1)        NOT NULL DEFAULT 'F',
    agent_id         INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_by       INT            NULL REFERENCES dbo.wsm_users(user_id),
    updated_by       INT            NULL REFERENCES dbo.wsm_users(user_id),
    created_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_wsm_properties_ref UNIQUE (company_id, ref_seq)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_properties_search')
    CREATE INDEX IX_wsm_properties_search ON dbo.wsm_properties(company_id, status, purpose, property_type, emirate);
GO

IF OBJECT_ID('dbo.wsm_property_files', 'U') IS NULL
CREATE TABLE dbo.wsm_property_files (
    file_id        INT IDENTITY(1,1) PRIMARY KEY,
    company_id     INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    property_id    INT            NOT NULL REFERENCES dbo.wsm_properties(property_id) ON DELETE CASCADE,
    file_kind      VARCHAR(10)    NOT NULL,                  -- IMAGE / FLOORPLAN / BROCHURE
    file_name      NVARCHAR(260)  NOT NULL,                  -- original name
    stored_name    NVARCHAR(100)  NOT NULL,                  -- random name on disk
    content_type   NVARCHAR(100)  NOT NULL,
    size_bytes     BIGINT         NOT NULL,
    is_cover       CHAR(1)        NOT NULL DEFAULT 'F',
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wsm_property_files_property')
    CREATE INDEX IX_wsm_property_files_property ON dbo.wsm_property_files(property_id, file_kind);
GO

IF OBJECT_ID('dbo.wsm_services', 'U') IS NULL
CREATE TABLE dbo.wsm_services (
    service_id     INT IDENTITY(1,1) PRIMARY KEY,
    company_id     INT            NOT NULL REFERENCES dbo.wsm_companies(company_id),
    service_name   NVARCHAR(150)  NOT NULL,
    category       NVARCHAR(50)   NOT NULL,
    price          DECIMAL(18,2)  NULL,                      -- AED
    price_note     NVARCHAR(50)   NULL,                      -- e.g. "per year", "5% of rent"
    description    NVARCHAR(2000) NULL,
    is_active      CHAR(1)        NOT NULL DEFAULT 'T',
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'Properties and services ready.';
GO
