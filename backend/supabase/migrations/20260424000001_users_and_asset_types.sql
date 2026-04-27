create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email ~* '@beva\.com$'),
  display_name text not null,
  team text,
  role text not null default 'member'
    check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  is_active boolean not null default true
);

create index idx_users_email on public.users(email);

create table public.asset_types (
  code text primary key,
  name_cn text not null,
  icon text,
  folder_path text not null,
  filename_tpl text not null,
  file_exts text[] not null,
  storage_ext text not null,
  storage_backend text not null
    check (storage_backend in ('github', 'r2')),
  parent_panel text,
  needs_before text[],
  supports_paste boolean not null default false,
  allow_ai_generate boolean not null default false,
  sort_order int not null default 0,
  enabled boolean not null default true
);
