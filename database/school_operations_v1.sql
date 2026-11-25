-- School operations: stock, assets, maintenance, board of directors and social links.
-- Every table is tenant scoped by school_id and is reached only through the server API (service role).

create table if not exists public.school_stock_items(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  name text not null check(char_length(name) between 2 and 120),
  category text not null check(category in ('food','kitchen','cleaning','stationery','teaching','uniform','other')),
  unit text not null check(char_length(unit) between 1 and 20),
  quantity numeric(12,2) not null default 0 check(quantity >= 0),
  reorder_level numeric(12,2) not null default 0 check(reorder_level >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,name)
);

create table if not exists public.school_stock_movements(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  item_id uuid not null references public.school_stock_items(id) on delete cascade,
  change numeric(12,2) not null check(change <> 0),
  note text check(note is null or char_length(note) <= 300),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists school_stock_movements_item_idx on public.school_stock_movements(school_id,item_id,created_at desc);

create table if not exists public.school_assets(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  asset_code text not null check(char_length(asset_code) between 2 and 30),
  name text not null check(char_length(name) between 2 and 120),
  category text not null check(category in ('furniture','ict','kitchen','sports','teaching','building','vehicle','other')),
  location text check(location is null or char_length(location) <= 120),
  condition text not null default 'good' check(condition in ('good','fair','needs_repair','out_of_service')),
  acquired_on date,
  value_rwf numeric(14,0) check(value_rwf is null or value_rwf >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,asset_code)
);

create table if not exists public.school_maintenance_requests(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  title text not null check(char_length(title) between 4 and 140),
  details text check(details is null or char_length(details) <= 1000),
  location text check(location is null or char_length(location) <= 120),
  priority text not null default 'normal' check(priority in ('low','normal','urgent')),
  status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
  resolution text check(resolution is null or char_length(resolution) <= 600),
  reported_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists school_maintenance_requests_idx on public.school_maintenance_requests(school_id,status,created_at desc);

create table if not exists public.school_board_members(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  full_name text not null check(char_length(full_name) between 3 and 120),
  position text not null check(char_length(position) between 2 and 80),
  phone text check(phone is null or char_length(phone) <= 30),
  term_start date,
  term_end date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.school_board_meetings(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  held_on date not null,
  title text not null check(char_length(title) between 4 and 140),
  agenda text check(agenda is null or char_length(agenda) <= 2000),
  minutes text check(minutes is null or char_length(minutes) <= 6000),
  status text not null default 'planned' check(status in ('planned','held')),
  created_at timestamptz not null default now()
);

create table if not exists public.school_social_links(
  school_id uuid not null references public.platform_schools(id) on delete cascade,
  platform text not null check(platform in ('youtube','tiktok','facebook','instagram','x','whatsapp')),
  url text not null check(url ~ '^https://[^[:space:]]{4,300}$'),
  updated_at timestamptz not null default now(),
  primary key(school_id,platform)
);

do $$
declare t text;
begin
  foreach t in array array['school_stock_items','school_stock_movements','school_assets','school_maintenance_requests','school_board_members','school_board_meetings','school_social_links'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant select, insert, update, delete on table public.%I to service_role',t);
  end loop;
end $$;
