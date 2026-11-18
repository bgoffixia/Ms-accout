-- Additive form-copy storage for M-soft Account Protection.
-- Apply ONLY through a verified connection to project uxmuqrzapklifcmpxclr
-- (ms-accout-production, ap-south-1). The application runtime also pins
-- SUPABASE_URL to uxmuqrzapklifcmpxclr.supabase.co before using this table.
-- This migration does not read or modify any applicant submission records.

begin;

create table if not exists public.applicant_form_content (
  config_key text not null
    constraint applicant_form_content_pkey
    primary key
    constraint applicant_form_content_config_key_check
    check (config_key = 'applicant-forms'),
  content jsonb not null default '{}'::jsonb
    constraint applicant_form_content_content_object_check
    check (jsonb_typeof(content) = 'object'),
  version integer not null default 0
    constraint applicant_form_content_version_nonnegative_check
    check (version >= 0),
  updated_by_user_id text,
  updated_at timestamptz not null default now()
);

do $migration$
declare
  required_columns integer;
  service_role_exists boolean;
begin
  select count(*)
    into required_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'applicant_form_content'
     and (
       (column_name = 'config_key' and data_type = 'text' and is_nullable = 'NO')
       or (column_name = 'content' and data_type = 'jsonb' and is_nullable = 'NO')
       or (column_name = 'version' and data_type = 'integer' and is_nullable = 'NO')
       or (column_name = 'updated_by_user_id' and data_type = 'text' and is_nullable = 'YES')
       or (column_name = 'updated_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO')
     );

  if required_columns <> 5 then
    raise exception 'applicant_form_content exists with an incompatible schema; no further changes were applied';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.applicant_form_content'::regclass
       and conname = 'applicant_form_content_pkey'
       and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (config_key)'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = 'public.applicant_form_content'::regclass
       and conname = 'applicant_form_content_config_key_check'
       and contype = 'c'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = 'public.applicant_form_content'::regclass
       and conname = 'applicant_form_content_content_object_check'
       and contype = 'c'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = 'public.applicant_form_content'::regclass
       and conname = 'applicant_form_content_version_nonnegative_check'
       and contype = 'c'
  ) then
    raise exception 'applicant_form_content has missing or incompatible constraints; no further changes were applied';
  end if;

  select exists (select 1 from pg_roles where rolname = 'service_role')
    into service_role_exists;
  if not service_role_exists then
    raise exception 'Supabase service_role is missing; no further changes were applied';
  end if;
end
$migration$;

alter table public.applicant_form_content enable row level security;
revoke all privileges on table public.applicant_form_content from public;

do $privileges$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all privileges on table public.applicant_form_content from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all privileges on table public.applicant_form_content from authenticated';
  end if;
  execute 'revoke all privileges on table public.applicant_form_content from service_role';
  execute 'grant select, insert, update on table public.applicant_form_content to service_role';
end
$privileges$;

insert into public.applicant_form_content (config_key, content, version)
values ('applicant-forms', '{}'::jsonb, 0)
on conflict (config_key) do nothing;

commit;
