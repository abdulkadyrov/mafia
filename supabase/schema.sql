create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  host_player_id uuid null,
  status text not null default 'lobby',
  phase text not null default 'lobby',
  round_number integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  role text not null default 'unassigned',
  is_alive boolean not null default true,
  is_host boolean not null default false,
  score integer not null default 0,
  joined_at timestamptz not null default now()
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null default 0,
  phase text not null,
  type text not null,
  message text not null,
  visibility text not null default 'public',
  target_player_id uuid null references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.night_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  actor_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid references public.players(id) on delete cascade,
  action_type text not null,
  created_at timestamptz not null default now(),
  constraint night_actions_unique_actor_round_type
    unique (room_id, round_number, actor_player_id, action_type)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  voter_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid references public.players(id) on delete cascade,
  vote_type text not null default 'main',
  created_at timestamptz not null default now(),
  constraint votes_unique_voter_round_type
    unique (room_id, round_number, voter_player_id, vote_type)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rooms_host_player_id_fkey'
  ) then
    alter table public.rooms
      add constraint rooms_host_player_id_fkey
      foreign key (host_player_id) references public.players(id) on delete set null;
  end if;
end;
$$;

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists rooms_status_idx on public.rooms(status);
create index if not exists players_room_id_idx on public.players(room_id);
create index if not exists game_events_room_id_created_at_idx on public.game_events(room_id, created_at desc);
create index if not exists game_events_room_id_round_idx on public.game_events(room_id, round_number);
create index if not exists night_actions_room_id_round_idx on public.night_actions(room_id, round_number);
create index if not exists votes_room_id_round_type_idx on public.votes(room_id, round_number, vote_type);

drop trigger if exists set_rooms_updated_at on public.rooms;
create trigger set_rooms_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.players;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.game_events;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.night_actions;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.votes;
exception
  when duplicate_object then null;
end;
$$;

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.game_events enable row level security;
alter table public.night_actions enable row level security;
alter table public.votes enable row level security;

drop policy if exists "anon can select rooms" on public.rooms;
create policy "anon can select rooms" on public.rooms for select to anon using (true);
drop policy if exists "anon can insert rooms" on public.rooms;
create policy "anon can insert rooms" on public.rooms for insert to anon with check (true);
drop policy if exists "anon can update rooms" on public.rooms;
create policy "anon can update rooms" on public.rooms for update to anon using (true) with check (true);

drop policy if exists "anon can select players" on public.players;
create policy "anon can select players" on public.players for select to anon using (true);
drop policy if exists "anon can insert players" on public.players;
create policy "anon can insert players" on public.players for insert to anon with check (true);
drop policy if exists "anon can update players" on public.players;
create policy "anon can update players" on public.players for update to anon using (true) with check (true);

drop policy if exists "anon can select game_events" on public.game_events;
create policy "anon can select game_events" on public.game_events for select to anon using (true);
drop policy if exists "anon can insert game_events" on public.game_events;
create policy "anon can insert game_events" on public.game_events for insert to anon with check (true);

drop policy if exists "anon can select night_actions" on public.night_actions;
create policy "anon can select night_actions" on public.night_actions for select to anon using (true);
drop policy if exists "anon can insert night_actions" on public.night_actions;
create policy "anon can insert night_actions" on public.night_actions for insert to anon with check (true);

drop policy if exists "anon can select votes" on public.votes;
create policy "anon can select votes" on public.votes for select to anon using (true);
drop policy if exists "anon can insert votes" on public.votes;
create policy "anon can insert votes" on public.votes for insert to anon with check (true);
