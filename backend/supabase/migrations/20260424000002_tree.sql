create table public.series (
  id uuid primary key default gen_random_uuid(),
  name_cn text not null,
  name_short text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create unique index idx_series_name on public.series(name_cn);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete restrict,
  name_cn text not null,
  name_short text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create unique index idx_albums_sc on public.albums(series_id, name_cn);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete restrict,
  name_cn text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create unique index idx_contents_ac on public.contents(album_id, name_cn);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  name_cn text not null,
  sort_order int not null default 0,
  status text not null default 'drafting'
    check (status in ('drafting', 'review', 'published', 'archived')),
  created_by uuid not null references public.users(id),
  episode_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_episodes_name on public.episodes(name_cn);
create index idx_episodes_updated on public.episodes(updated_at desc);

create or replace function public.touch_episodes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_episodes_touch_updated
  before update on public.episodes
  for each row execute function public.touch_episodes_updated_at();
