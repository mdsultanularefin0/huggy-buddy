REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE USAGE ON SCHEMA private FROM anon, authenticated;