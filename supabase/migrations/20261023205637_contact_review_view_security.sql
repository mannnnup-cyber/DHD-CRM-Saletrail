-- PREPARED ONLY: apply only after separate hosted authorization and safeguards.
-- Existing view definitions, base tables, RLS policies and grants are preserved.
BEGIN;
ALTER VIEW public.enrichment_status SET (security_invoker = true);
ALTER VIEW public.org_members_all SET (security_invoker = true);
ALTER VIEW public.org_members_current SET (security_invoker = true);
COMMIT;
