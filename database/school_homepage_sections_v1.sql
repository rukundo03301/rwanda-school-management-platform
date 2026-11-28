-- School public homepage sections v1.
-- Tenth isolated migration, applied AFTER platform_demo_tenant_purge_v1.
-- GitHub-controlled SQL SOURCE; the repo is the source of truth.
--
-- Adds school-authored public homepage content: address/location, a programs
-- introduction, admissions information and a photo gallery, plus the published
-- snapshot of the education levels the school itself selected in onboarding.
--
-- Additive columns only, on the two existing per-school site tables. No new
-- school_id table is created, so the 54-table tenant purge manifest is unchanged
-- and a tenant purge still removes this content with the rest of the school.
-- Both tables already have RLS enabled with every anon/authenticated privilege
-- revoked; new columns inherit that. Gallery files live under the school's own
-- UUID prefix in the existing school-branding bucket and are written only by the
-- verified server upload route, so the purge storage sweep covers them too.

alter table public.school_site_drafts
add column if not exists address_text text not null default '',
add column if not exists programs_intro text not null default '',
add column if not exists admissions_intro text not null default '',
add column if not exists admissions_instructions text not null default '',
add column if not exists admissions_contact text not null default '',
add column if not exists gallery jsonb not null default '[]'::jsonb;

-- education_levels here is a PUBLISHED SNAPSHOT copied from school_onboarding at
-- publication time, so later private edits never change the public page silently.
alter table public.platform_school_sites
add column if not exists address_text text not null default '',
add column if not exists programs_intro text not null default '',
add column if not exists admissions_intro text not null default '',
add column if not exists admissions_instructions text not null default '',
add column if not exists admissions_contact text not null default '',
add column if not exists gallery jsonb not null default '[]'::jsonb,
add column if not exists education_levels text[] not null default '{}'::text[];

do $$
declare t text;
begin
foreach t in array array['school_site_drafts','platform_school_sites'] loop
if not exists(select 1 from pg_catalog.pg_constraint where conname=t||'_homepage_sections_chk') then
execute format(
'alter table public.%I add constraint %I check ('||
'length(address_text)<=240 and length(programs_intro)<=1200 '||
'and length(admissions_intro)<=1600 and length(admissions_instructions)<=1600 '||
'and length(admissions_contact)<=254 '||
'and (case when jsonb_typeof(gallery)=''array'' then jsonb_array_length(gallery)<=12 else false end))',
t,t||'_homepage_sections_chk');
end if;
end loop;
end $$;
