alter table public.users enable row level security;
alter table public.asset_types enable row level security;
alter table public.series enable row level security;
alter table public.albums enable row level security;
alter table public.contents enable row level security;
alter table public.episodes enable row level security;
alter table public.assets enable row level security;
alter table public.usage_logs enable row level security;

create policy users_select_all on public.users
  for select to authenticated using (true);

create policy users_self_update on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy asset_types_select on public.asset_types
  for select to authenticated using (true);

create policy series_select on public.series
  for select to authenticated using (true);

create policy albums_select on public.albums
  for select to authenticated using (true);

create policy contents_select on public.contents
  for select to authenticated using (true);

create policy episodes_select on public.episodes
  for select to authenticated using (true);

create policy assets_select_pushed on public.assets
  for select to authenticated
  using (status = 'pushed' or author_id = auth.uid());

create policy usage_select_self on public.usage_logs
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
