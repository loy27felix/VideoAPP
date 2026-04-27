create type asset_status as enum ('draft', 'pushed', 'superseded');
create type asset_source as enum ('imported', 'pasted', 'ai-generated');
create type storage_backend as enum ('github', 'r2');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  type_code text not null references public.asset_types(code),
  name text not null,
  variant text,
  number int,
  version int not null default 1 check (version >= 1),
  stage text default 'ROUGH' not null
    check (stage in ('ROUGH', 'REVIEW', 'FINAL')),
  language text default 'ZH' not null
    check (language ~ '^[A-Z]{2}$'),
  original_filename text,
  final_filename text not null,
  storage_backend storage_backend not null,
  storage_ref text not null,
  storage_metadata jsonb,
  file_size_bytes bigint,
  mime_type text,
  source asset_source not null,
  status asset_status not null default 'pushed',
  author_id uuid not null references public.users(id),
  superseded_by uuid references public.assets(id),
  created_at timestamptz not null default now(),
  pushed_at timestamptz not null default now()
);

create index idx_assets_episode_type on public.assets(episode_id, type_code);
create index idx_assets_author on public.assets(author_id);

create unique index idx_assets_storage_unique
  on public.assets(episode_id, storage_backend, storage_ref);

create unique index idx_assets_filename_pushed
  on public.assets(episode_id, final_filename)
  where status = 'pushed';

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  provider text not null,
  model text,
  action text not null,
  tokens_input int,
  tokens_output int,
  bytes_transferred bigint,
  cost_usd numeric(10, 6),
  episode_id uuid references public.episodes(id) on delete set null,
  request_id text,
  at timestamptz not null default now()
);

create index idx_usage_user_at on public.usage_logs(user_id, at desc);
create index idx_usage_at on public.usage_logs(at desc);
