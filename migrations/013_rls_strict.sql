-- Tighten RLS policies on grants and share_links to actually enforce
-- isolation (issue #126).
--
-- Migration 011 added RLS policies but with a permissive bypass: any
-- query without `app.principal_id` set defaulted to ALLOW. The
-- application never set the variable, so the policies were vestigial.
--
-- This migration drops the permissive policies and replaces them with
-- strict versions:
--
--   - Queries without `app.principal_id` set are DENIED (the
--     `current_setting` lookup with missing_ok=true returns NULL,
--     and a NULL comparison fails the policy).
--   - The `__system__` sentinel id, set via runAsSystem() in the app
--     storage module, is treated as a bypass for legitimate background
--     jobs and admin tooling that needs to cross user boundaries.
--   - Empty-string is no longer a bypass (the migration 011 mistake).
--
-- The matching app-side wiring lives in modules/storage/internal/
-- principal-context.ts and rls-query.ts. Every grant/share_link query
-- now routes through rlsQuery which issues SET LOCAL app.principal_id
-- inside a transaction, reading the principal id from AsyncLocalStorage.

-- ============================================================
-- 1. Drop the permissive policies from migration 011
-- ============================================================

DROP POLICY IF EXISTS grants_select_policy ON grants;
DROP POLICY IF EXISTS grants_insert_policy ON grants;
DROP POLICY IF EXISTS grants_update_policy ON grants;
DROP POLICY IF EXISTS grants_delete_policy ON grants;

DROP POLICY IF EXISTS share_links_select_policy ON share_links;
DROP POLICY IF EXISTS share_links_insert_policy ON share_links;
DROP POLICY IF EXISTS share_links_update_policy ON share_links;
DROP POLICY IF EXISTS share_links_delete_policy ON share_links;

-- ============================================================
-- 2. Strict grants policies
-- ============================================================
--
-- A user (non-system) can:
--   - SELECT grants where they are the principal OR they are the
--     grantor
--   - INSERT grants where they are the grantor
--   - UPDATE / DELETE grants where they are the grantor
--
-- The system principal (`__system__`) bypasses all policies.

CREATE POLICY grants_select_policy ON grants
  FOR SELECT
  USING (
    current_setting('app.principal_id', true) = '__system__'
    OR principal_id = current_setting('app.principal_id', true)
    OR granted_by = current_setting('app.principal_id', true)
  );

CREATE POLICY grants_insert_policy ON grants
  FOR INSERT
  WITH CHECK (
    current_setting('app.principal_id', true) = '__system__'
    OR granted_by = current_setting('app.principal_id', true)
  );

CREATE POLICY grants_update_policy ON grants
  FOR UPDATE
  USING (
    current_setting('app.principal_id', true) = '__system__'
    OR granted_by = current_setting('app.principal_id', true)
  );

CREATE POLICY grants_delete_policy ON grants
  FOR DELETE
  USING (
    current_setting('app.principal_id', true) = '__system__'
    OR granted_by = current_setting('app.principal_id', true)
  );

-- ============================================================
-- 3. Strict share_links policies
-- ============================================================
--
-- The grantor (creator of the share link) can do everything with it.
-- The anonymous resolution path goes through runAsSystem() in the
-- application layer (see modules/sharing/internal/routes.ts) so the
-- `__system__` bypass covers token-based lookup.

CREATE POLICY share_links_select_policy ON share_links
  FOR SELECT
  USING (
    current_setting('app.principal_id', true) = '__system__'
    OR grantor_id = current_setting('app.principal_id', true)
  );

CREATE POLICY share_links_insert_policy ON share_links
  FOR INSERT
  WITH CHECK (
    current_setting('app.principal_id', true) = '__system__'
    OR grantor_id = current_setting('app.principal_id', true)
  );

CREATE POLICY share_links_update_policy ON share_links
  FOR UPDATE
  USING (
    current_setting('app.principal_id', true) = '__system__'
    OR grantor_id = current_setting('app.principal_id', true)
  );

CREATE POLICY share_links_delete_policy ON share_links
  FOR DELETE
  USING (
    current_setting('app.principal_id', true) = '__system__'
    OR grantor_id = current_setting('app.principal_id', true)
  );
