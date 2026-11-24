-- school_auth_identity_read_v1
--
-- Several server-only functions (staff, guardian and student invitation
-- claims, demo school creation, tenant purge) confirm that the caller owns a
-- verified email by reading auth.users. They are SECURITY INVOKER and run as
-- service_role, which had no read access to that table, so every one of them
-- failed with "permission denied for table users".
--
-- This grants service_role read access to exactly the three columns those
-- checks use. It grants nothing to anon or authenticated, changes no row level
-- security, and exposes no password, token or metadata column.

grant usage on schema auth to service_role;
grant select (id, email, email_confirmed_at) on table auth.users to service_role;
