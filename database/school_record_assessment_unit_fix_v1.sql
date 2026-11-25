-- Fix: end-of-unit marks were always rejected because the unit check read the term
-- number before the term row was loaded. Applied to APEX as 20261125170000.
do $do$
declare oid_ oid; def text; fixed text;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='school_record_assessment';
  def := pg_get_functiondef(oid_);
  fixed := regexp_replace(def, 'term_number\s*=\s*t\.term_number\)', 'term_number = (select x.term_number from public.school_assessment_terms x where x.school_id = p_school and x.id = p_term))');
  if fixed = def then raise notice 'unit check already fixed'; else execute fixed; end if;
end
$do$;
