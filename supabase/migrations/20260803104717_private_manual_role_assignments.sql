-- Manual assignments are secret game state. They must not live in mafia_rooms.settings,
-- because every room member can select that row through the Data API.

create table if not exists public.mafia_manual_role_assignments (
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  room_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  role text not null check (role in (
    'mafia', 'don', 'doctor', 'commissioner', 'civilian',
    'maniac', 'mistress', 'bodyguard'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, room_player_id)
);

alter table public.mafia_manual_role_assignments enable row level security;

-- Edge Functions use service_role. Browser roles intentionally receive no access.
revoke all on public.mafia_manual_role_assignments from anon, authenticated;
grant all on public.mafia_manual_role_assignments to service_role;

create index if not exists manual_role_assignments_room_idx
  on public.mafia_manual_role_assignments (room_id);

update public.mafia_rooms
set settings = settings - 'manualRoles'
where settings ? 'manualRoles';
