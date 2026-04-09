-- Row Level Security for grants and share_links tables.
-- Defense-in-depth: policies default to ALLOW when no session variable is set
-- (backward compatible), but RESTRICT when app.principal_id IS set.
--
-- TODO: Update the application to call SET LOCAL app.principal_id = '<id>'
-- on each connection before running queries. Once that is done, remove the
-- fallback "no principal set" clauses to enforce strict RLS.

-- ============================================================
-- 1. Enable RLS on both tables
-- ============================================================

ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (superusers are always exempt).
ALTER TABLE grants FORCE ROW LEVEL SECURITY;
ALTER TABLE share_links FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Grants table policies
-- ============================================================

-- SELECT: principal can see their own grants, or all if no session var set
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'grants' AND policyname = 'grants_select_policy'
  ) THEN
    CREATE POLICY grants_select_policy ON grants
      FOR SELECT
      USING (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR principal_id = current_setting('app.principal_id', true)
        OR granted_by = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- INSERT: principal can only create grants they are the grantor of
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'grants' AND policyname = 'grants_insert_policy'
  ) THEN
    CREATE POLICY grants_insert_policy ON grants
      FOR INSERT
      WITH CHECK (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR granted_by = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- UPDATE: principal can only update grants they created
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'grants' AND policyname = 'grants_update_policy'
  ) THEN
    CREATE POLICY grants_update_policy ON grants
      FOR UPDATE
      USING (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR granted_by = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- DELETE: principal can only delete grants they created
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'grants' AND policyname = 'grants_delete_policy'
  ) THEN
    CREATE POLICY grants_delete_policy ON grants
      FOR DELETE
      USING (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR granted_by = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- ============================================================
-- 3. Share links table policies
-- ============================================================

-- SELECT: grantor can see their own share links
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'share_links_select_policy'
  ) THEN
    CREATE POLICY share_links_select_policy ON share_links
      FOR SELECT
      USING (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR grantor_id = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- INSERT: principal can only create share links as themselves
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'share_links_insert_policy'
  ) THEN
    CREATE POLICY share_links_insert_policy ON share_links
      FOR INSERT
      WITH CHECK (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR grantor_id = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- UPDATE: principal can only update their own share links
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'share_links_update_policy'
  ) THEN
    CREATE POLICY share_links_update_policy ON share_links
      FOR UPDATE
      USING (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR grantor_id = current_setting('app.principal_id', true)
      );
  END IF;
END $$;

-- DELETE: principal can only delete their own share links
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'share_links_delete_policy'
  ) THEN
    CREATE POLICY share_links_delete_policy ON share_links
      FOR DELETE
      USING (
        current_setting('app.principal_id', true) IS NULL
        OR current_setting('app.principal_id', true) = ''
        OR grantor_id = current_setting('app.principal_id', true)
      );
  END IF;
END $$;
