-- Ensure service_role has only the operations required by the form-content adapter.
-- This corrects default privileges on databases where migration 0006 was already applied.
begin;
revoke all privileges on table public.applicant_form_content from service_role;
grant select, insert, update on table public.applicant_form_content to service_role;
commit;
