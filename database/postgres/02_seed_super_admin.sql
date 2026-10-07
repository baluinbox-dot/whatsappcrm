-- First company and super admin on an empty database. Needs the BCrypt hash of the password:
--   psql -d istreams_crm -v admin_hash='$2a$11$...' -f 02_seed_super_admin.sql
-- Copy the hash from SQL Server (SELECT password_hash FROM wsm_users WHERE is_super_admin = 'T')
-- or create one with any BCrypt tool. Safe to re-run: does nothing if a company already exists.
SELECT NOT EXISTS (SELECT 1 FROM wsm_companies) AS is_empty \gset

\if :is_empty
    WITH c AS (
        INSERT INTO wsm_companies (company_code, company_name, status, approved_at)
        VALUES (substr(md5(random()::text), 1, 12), 'iStreams', 'ACTIVE', now() AT TIME ZONE 'utc')
        RETURNING company_id
    )
    INSERT INTO wsm_users (company_id, full_name, email, password_hash, role, is_super_admin)
    SELECT company_id, 'Super Admin', 'baluinbox@gmail.com', :'admin_hash', 'ADMIN', 'T' FROM c;
\else
    \echo 'wsm_companies already has data - seed skipped.'
\endif
