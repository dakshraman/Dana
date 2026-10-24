-- Supabase hardening.
--
-- The application talks to Postgres through Prisma using the `postgres` role
-- (table owner). Tables in the public schema are also reachable through
-- Supabase's Data API by the `anon` / `authenticated` / `service_role` roles.
-- This migration makes the database deny-by-default for those roles:
--
--   * RLS is enabled on every existing public table, with no policies.
--   * Direct table/sequence/function grants are revoked.
--   * Default privileges are revoked so future Prisma tables are protected too.
--
-- Prisma (as table owner) is unaffected because RLS is not forced on owners.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
