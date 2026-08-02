-- Abdulkadyrov Games — Mafia production schema.
-- All game-changing writes are performed by the authenticated Edge Function.
-- Browser clients receive only public room state plus their own secret role.

create extension if not exists pgcrypto;

create schema if not exists mafia_private;
revoke all on schema mafia_private from public, anon, authenticated;

create or replace function mafia_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 32),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mafia_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(btrim(name)) between 2 and 48),
  created_by uuid not null references auth.users(id) on delete restrict,
  host_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'finished', 'cancelled')),
  phase text not null default 'lobby'
    check (phase in (
      'lobby', 'role_reveal', 'night_intro', 'night_mafia',
      'night_doctor', 'night_commissioner', 'night_resolution',
      'day_announcement', 'day_discussion', 'day_voting',
      'day_execution', 'game_over'
    )),
  phase_version integer not null default 0 check (phase_version >= 0),
  round_number integer not null default 0 check (round_number >= 0),
  max_players smallint not null default 10 check (max_players between 6 and 16),
  is_private boolean not null default true,
  join_locked boolean not null default false,
  video_enabled boolean not null default true,
  camera_required boolean not null default false,
  auto_phase boolean not null default false,
  chat_enabled boolean not null default true,
  dead_chat_enabled boolean not null default true,
  dead_can_observe boolean not null default true,
  dead_can_read_alive_chat boolean not null default false,
  settings jsonb not null default jsonb_build_object(
    'nightSeconds', 45,
    'discussionSeconds', 180,
    'votingSeconds', 45,
    'roles', jsonb_build_object(
      'mafia', 2,
      'don', 0,
      'doctor', 1,
      'commissioner', 1,
      'maniac', 0,
      'mistress', 0,
      'bodyguard', 0,
      'civilian', 2
    ),
    'doctorSelfHealsLimit', 1,
    'mafiaDecision', 'majority',
    'allowVoteChange', false,
    'tieRule', 'no_execution'
  ),
  phase_started_at timestamptz,
  phase_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mafia_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 32),
  avatar_url text,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  life_status text not null default 'alive'
    check (life_status in ('alive', 'dead', 'disconnected')),
  camera_enabled boolean not null default false,
  microphone_enabled boolean not null default false,
  microphone_blocked boolean not null default false,
  connection_quality text not null default 'unknown'
    check (connection_quality in ('unknown', 'excellent', 'good', 'poor', 'offline')),
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.mafia_games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  number integer not null check (number > 0),
  status text not null default 'active'
    check (status in ('active', 'finished', 'cancelled')),
  phase text not null default 'role_reveal'
    check (phase in (
      'role_reveal', 'night_intro', 'night_mafia', 'night_doctor',
      'night_commissioner', 'night_resolution', 'day_announcement',
      'day_discussion', 'day_voting', 'day_execution', 'game_over'
    )),
  phase_version integer not null default 0 check (phase_version >= 0),
  round_number integer not null default 1 check (round_number > 0),
  winning_team text check (winning_team in ('mafia', 'city', 'maniac', 'draw')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, number)
);

create table if not exists public.mafia_game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  room_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'mafia', 'don', 'doctor', 'commissioner', 'civilian',
    'maniac', 'mistress', 'bodyguard', 'host'
  )),
  team text not null check (team in ('mafia', 'city', 'neutral', 'host')),
  life_status text not null default 'alive'
    check (life_status in ('alive', 'dead', 'disconnected')),
  is_host boolean not null default false,
  role_acknowledged_at timestamptz,
  killed_at_phase text,
  killed_at_round integer,
  death_reason text,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, room_player_id),
  unique (game_id, user_id)
);

create table if not exists public.mafia_game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  phase text not null,
  actor_game_player_id uuid not null references public.mafia_game_players(id) on delete cascade,
  target_game_player_id uuid references public.mafia_game_players(id) on delete restrict,
  action_type text not null check (action_type in (
    'mafia_kill', 'doctor_heal', 'commissioner_check',
    'commissioner_kill', 'maniac_kill', 'mistress_block', 'bodyguard_protect'
  )),
  result jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, round_number, actor_game_player_id, phase)
);

create table if not exists public.mafia_game_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  voter_game_player_id uuid not null references public.mafia_game_players(id) on delete cascade,
  target_game_player_id uuid not null references public.mafia_game_players(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (game_id, round_number, voter_game_player_id)
);

create table if not exists public.mafia_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  game_id uuid references public.mafia_games(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  channel text not null check (channel in (
    'room_chat', 'alive_chat', 'mafia_chat', 'dead_chat', 'system_chat'
  )),
  content text not null check (char_length(content) between 1 and 500),
  client_nonce uuid,
  created_at timestamptz not null default now(),
  unique (author_user_id, client_nonce)
);

create table if not exists public.mafia_video_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  camera_enabled boolean not null default false,
  microphone_enabled boolean not null default false,
  audio_allowed boolean not null default true,
  peer_id text,
  connection_state text not null default 'new'
    check (connection_state in ('new', 'connecting', 'connected', 'reconnecting', 'closed', 'failed')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.mafia_video_signals (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  receiver_user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice', 'renegotiate', 'leave')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mafia_game_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  game_id uuid references public.mafia_games(id) on delete cascade,
  round_number integer not null default 0,
  phase text not null,
  event_type text not null,
  visibility text not null default 'public'
    check (visibility in ('public', 'host', 'private', 'mafia', 'dead')),
  target_user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mafia_game_commands (
  id uuid primary key,
  room_id uuid references public.mafia_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  command_type text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rooms_open_idx
  on public.mafia_rooms (created_at desc) where status = 'lobby' and join_locked = false;
create index if not exists room_players_room_joined_idx
  on public.mafia_room_players (room_id, joined_at);
create index if not exists room_players_user_idx
  on public.mafia_room_players (user_id, joined_at desc);
create index if not exists games_room_started_idx
  on public.mafia_games (room_id, started_at desc);
create index if not exists game_players_game_life_idx
  on public.mafia_game_players (game_id, life_status);
create index if not exists game_actions_game_round_idx
  on public.mafia_game_actions (game_id, round_number, action_type);
create index if not exists game_votes_game_round_target_idx
  on public.mafia_game_votes (game_id, round_number, target_game_player_id);
create index if not exists chat_messages_room_created_idx
  on public.mafia_chat_messages (room_id, created_at desc);
create index if not exists chat_messages_game_channel_created_idx
  on public.mafia_chat_messages (game_id, channel, created_at desc);
create index if not exists video_signals_receiver_idx
  on public.mafia_video_signals (receiver_user_id, room_id, created_at);
create index if not exists game_events_room_created_idx
  on public.mafia_game_events (room_id, created_at desc);
create index if not exists game_events_game_created_idx
  on public.mafia_game_events (game_id, created_at);
create index if not exists game_commands_user_created_idx
  on public.mafia_game_commands (user_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function mafia_private.set_updated_at();

drop trigger if exists rooms_set_updated_at on public.mafia_rooms;
create trigger rooms_set_updated_at
before update on public.mafia_rooms
for each row execute function mafia_private.set_updated_at();

drop trigger if exists video_sessions_set_updated_at on public.mafia_video_sessions;
create trigger video_sessions_set_updated_at
before update on public.mafia_video_sessions
for each row execute function mafia_private.set_updated_at();

create or replace function mafia_private.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Игрок'), 32)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists mafia_auth_user_created_profile on auth.users;
create trigger mafia_auth_user_created_profile
after insert on auth.users
for each row execute function mafia_private.create_profile_for_user();

create or replace function mafia_private.is_room_member(target_room_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mafia_room_players rp
    where rp.room_id = target_room_id
      and rp.user_id = target_user_id
  );
$$;

create or replace function mafia_private.is_room_host(target_room_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mafia_rooms r
    where r.id = target_room_id
      and r.host_user_id = target_user_id
  );
$$;

create or replace function mafia_private.can_read_chat(target_room_id uuid, target_game_id uuid, target_channel text, target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  player_row public.mafia_game_players%rowtype;
  room_row public.mafia_rooms%rowtype;
begin
  if not mafia_private.is_room_member(target_room_id, target_user_id) then
    return false;
  end if;

  if target_channel in ('room_chat', 'system_chat') then
    return true;
  end if;

  select * into room_row from public.mafia_rooms where id = target_room_id;
  select * into player_row
  from public.mafia_game_players
  where game_id = target_game_id and user_id = target_user_id;

  if not found then
    return false;
  end if;

  if target_channel = 'alive_chat' then
    return player_row.life_status = 'alive'
      or room_row.dead_can_read_alive_chat;
  end if;
  if target_channel = 'mafia_chat' then
    return player_row.life_status = 'alive' and player_row.team = 'mafia';
  end if;
  if target_channel = 'dead_chat' then
    return player_row.life_status = 'dead' and room_row.dead_chat_enabled;
  end if;
  return false;
end;
$$;

create or replace function mafia_private.can_read_event(
  target_room_id uuid,
  target_game_id uuid,
  target_visibility text,
  target_user uuid,
  viewer uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_player public.mafia_game_players%rowtype;
begin
  if not mafia_private.is_room_member(target_room_id, viewer) then
    return false;
  end if;
  if exists (
    select 1 from public.mafia_games
    where id = target_game_id and status = 'finished'
  ) then
    return true;
  end if;
  if mafia_private.is_room_host(target_room_id, viewer) then return true; end if;
  if target_visibility = 'public' then return true; end if;
  if target_visibility = 'private' then return target_user = viewer; end if;
  if target_visibility = 'host' then return false; end if;

  select * into viewer_player
  from public.mafia_game_players
  where game_id = target_game_id and user_id = viewer;

  if target_visibility = 'mafia' then
    return viewer_player.team = 'mafia' and viewer_player.life_status = 'alive';
  end if;
  if target_visibility = 'dead' then
    return viewer_player.life_status = 'dead';
  end if;
  return false;
end;
$$;

create or replace function mafia_private.can_publish_audio(target_room_id uuid, target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  room_player public.mafia_room_players%rowtype;
  room_row public.mafia_rooms%rowtype;
  game_player public.mafia_game_players%rowtype;
  active_game_id uuid;
begin
  select * into room_row from public.mafia_rooms where id = target_room_id;
  select * into room_player
  from public.mafia_room_players
  where room_id = target_room_id and user_id = target_user_id;
  if room_player.id is null or room_player.microphone_blocked then return false; end if;
  if room_player.is_host then return true; end if;
  if room_player.life_status <> 'alive' then return false; end if;
  if room_row.phase = 'lobby' or room_row.phase = 'role_reveal' or room_row.phase like 'day_%' then return true; end if;
  if room_row.phase <> 'night_mafia' then return false; end if;
  select id into active_game_id from public.mafia_games where room_id = target_room_id and status = 'active' order by number desc limit 1;
  select * into game_player from public.mafia_game_players where game_id = active_game_id and user_id = target_user_id;
  return game_player.team = 'mafia' and game_player.life_status = 'alive';
end;
$$;

revoke all on all functions in schema mafia_private from public, anon;
grant usage on schema mafia_private to authenticated;
grant execute on function mafia_private.is_room_member(uuid, uuid) to authenticated;
grant execute on function mafia_private.is_room_host(uuid, uuid) to authenticated;
grant execute on function mafia_private.can_read_chat(uuid, uuid, text, uuid) to authenticated;
grant execute on function mafia_private.can_read_event(uuid, uuid, text, uuid, uuid) to authenticated;
grant execute on function mafia_private.can_publish_audio(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.mafia_rooms enable row level security;
alter table public.mafia_room_players enable row level security;
alter table public.mafia_games enable row level security;
alter table public.mafia_game_players enable row level security;
alter table public.mafia_game_actions enable row level security;
alter table public.mafia_game_votes enable row level security;
alter table public.mafia_chat_messages enable row level security;
alter table public.mafia_video_sessions enable row level security;
alter table public.mafia_video_signals enable row level security;
alter table public.mafia_game_events enable row level security;
alter table public.mafia_game_commands enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists rooms_read_visible on public.mafia_rooms;
create policy rooms_read_visible on public.mafia_rooms
for select to authenticated
using (
  (status = 'lobby' and is_private = false and join_locked = false)
  or mafia_private.is_room_member(id)
);

drop policy if exists room_players_read_members on public.mafia_room_players;
create policy room_players_read_members on public.mafia_room_players
for select to authenticated
using (mafia_private.is_room_member(room_id));

drop policy if exists games_read_members on public.mafia_games;
create policy games_read_members on public.mafia_games
for select to authenticated
using (mafia_private.is_room_member(room_id));

drop policy if exists game_players_read_secret on public.mafia_game_players;
create policy game_players_read_secret on public.mafia_game_players
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.mafia_games g
    where g.id = game_id and g.status = 'finished'
      and mafia_private.is_room_member(g.room_id)
  )
);

drop policy if exists game_actions_read_authorized on public.mafia_game_actions;
create policy game_actions_read_authorized on public.mafia_game_actions
for select to authenticated
using (
  exists (
    select 1 from public.mafia_game_players gp
    where gp.id = actor_game_player_id and gp.user_id = (select auth.uid())
  )
);

drop policy if exists game_votes_read_authorized on public.mafia_game_votes;
create policy game_votes_read_authorized on public.mafia_game_votes
for select to authenticated
using (
  exists (
    select 1 from public.mafia_game_players gp
    where gp.id = voter_game_player_id and gp.user_id = (select auth.uid())
  )
);

drop policy if exists chat_messages_read_authorized on public.mafia_chat_messages;
create policy chat_messages_read_authorized on public.mafia_chat_messages
for select to authenticated
using (mafia_private.can_read_chat(room_id, game_id, channel));

drop policy if exists video_sessions_read_members on public.mafia_video_sessions;
create policy video_sessions_read_members on public.mafia_video_sessions
for select to authenticated
using (mafia_private.is_room_member(room_id));
drop policy if exists video_sessions_insert_own on public.mafia_video_sessions;
create policy video_sessions_insert_own on public.mafia_video_sessions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and mafia_private.is_room_member(room_id)
  and audio_allowed = mafia_private.can_publish_audio(room_id)
  and (not microphone_enabled or audio_allowed)
);
drop policy if exists video_sessions_update_own on public.mafia_video_sessions;
create policy video_sessions_update_own on public.mafia_video_sessions
for update to authenticated
using (user_id = (select auth.uid()) and mafia_private.is_room_member(room_id))
with check (
  user_id = (select auth.uid())
  and mafia_private.is_room_member(room_id)
  and audio_allowed = mafia_private.can_publish_audio(room_id)
  and (not microphone_enabled or audio_allowed)
);
drop policy if exists video_sessions_delete_own on public.mafia_video_sessions;
create policy video_sessions_delete_own on public.mafia_video_sessions
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists video_signals_read_receiver on public.mafia_video_signals;
create policy video_signals_read_receiver on public.mafia_video_signals
for select to authenticated
using (
  receiver_user_id = (select auth.uid())
  and mafia_private.is_room_member(room_id)
);
drop policy if exists video_signals_insert_sender on public.mafia_video_signals;
create policy video_signals_insert_sender on public.mafia_video_signals
for insert to authenticated
with check (
  sender_user_id = (select auth.uid())
  and sender_user_id <> receiver_user_id
  and mafia_private.is_room_member(room_id)
  and mafia_private.is_room_member(room_id, receiver_user_id)
);
drop policy if exists video_signals_delete_participant on public.mafia_video_signals;
create policy video_signals_delete_participant on public.mafia_video_signals
for delete to authenticated
using (
  sender_user_id = (select auth.uid())
  or receiver_user_id = (select auth.uid())
);

drop policy if exists game_events_read_authorized on public.mafia_game_events;
create policy game_events_read_authorized on public.mafia_game_events
for select to authenticated
using (mafia_private.can_read_event(room_id, game_id, visibility, target_user_id));

drop policy if exists game_commands_read_own on public.mafia_game_commands;
create policy game_commands_read_own on public.mafia_game_commands
for select to authenticated using (user_id = (select auth.uid()));

-- The Edge Function uses the service role for all protected writes.
grant select on public.profiles, public.mafia_rooms, public.mafia_room_players, public.mafia_games,
  public.mafia_game_players, public.mafia_game_actions, public.mafia_game_votes, public.mafia_chat_messages,
  public.mafia_video_sessions, public.mafia_video_signals, public.mafia_game_events, public.mafia_game_commands
to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.mafia_video_sessions to authenticated;
grant insert, select, delete on public.mafia_video_signals to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists profile_avatars_update_own on storage.objects;
create policy profile_avatars_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid())::text
);
drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid())::text
);

grant usage, select on sequence public.mafia_video_signals_id_seq to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'mafia_rooms', 'mafia_room_players', 'mafia_games', 'mafia_chat_messages',
    'mafia_video_sessions', 'mafia_video_signals', 'mafia_game_events'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then
      null;
    end;
  end loop;
end;
$$;
