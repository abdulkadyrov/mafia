-- Server-controlled test players do not own Supabase Auth accounts.
-- Human membership and all host authorization continue to use auth.uid().

alter table public.mafia_room_players
  alter column user_id drop not null,
  add column if not exists is_bot boolean not null default false,
  add column if not exists bot_difficulty text;

alter table public.mafia_game_players
  alter column user_id drop not null,
  add column if not exists is_bot boolean not null default false,
  add column if not exists bot_difficulty text;

do $$
begin
  alter table public.mafia_room_players
    add constraint mafia_room_players_identity_check check (
      (is_bot and user_id is null and bot_difficulty = 'medium' and not is_host)
      or
      (not is_bot and user_id is not null and bot_difficulty is null)
    );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.mafia_game_players
    add constraint mafia_game_players_identity_check check (
      (is_bot and user_id is null and bot_difficulty = 'medium' and not is_host)
      or
      (not is_bot and user_id is not null and bot_difficulty is null)
    );
exception when duplicate_object then null;
end;
$$;

create index if not exists room_players_room_bots_idx
  on public.mafia_room_players (room_id, is_bot)
  where is_bot = true;

create index if not exists game_players_game_bots_idx
  on public.mafia_game_players (game_id, is_bot, life_status)
  where is_bot = true;
