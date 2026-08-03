import type { MafiaRoomSettings } from "../../core/room/mafiaRoomTypes";

type Role = keyof MafiaRoomSettings["roles"];

const roleLimits: Partial<Record<Role, number>> = {
  mafia: 6,
  don: 1,
  doctor: 2,
  commissioner: 2,
  maniac: 1,
  mistress: 1,
  bodyguard: 1,
};

export function changeRoleCount(settings: MafiaRoomSettings, role: Role, requested: number): MafiaRoomSettings {
  if (role === "host") return settings;
  if (role === "civilian") {
    const current = Number(settings.roles.civilian ?? 0);
    return changePlayerLimit(settings, settings.maxPlayers + Math.trunc(requested) - current);
  }

  const nextCount = Math.max(0, Math.min(roleLimits[role] ?? 16, Math.trunc(requested)));
  const roles = { ...settings.roles, [role]: nextCount };
  const special = specialRoleCount(roles);
  const reservedModeratorSlots = settings.hostPlays ? 0 : 1;
  const maxPlayers = Math.min(16, Math.max(settings.maxPlayers, special + reservedModeratorSlots));
  if (special > maxPlayers - reservedModeratorSlots) return settings;

  return {
    ...settings,
    maxPlayers,
    roles: { ...roles, civilian: maxPlayers - reservedModeratorSlots - special },
  };
}

export function changePlayerLimit(settings: MafiaRoomSettings, requested: number): MafiaRoomSettings {
  const special = specialRoleCount(settings.roles);
  const reservedModeratorSlots = settings.hostPlays ? 0 : 1;
  const maxPlayers = Math.max(Math.max(6, special + reservedModeratorSlots), Math.min(16, Math.trunc(requested)));
  return {
    ...settings,
    maxPlayers,
    roles: { ...settings.roles, civilian: maxPlayers - reservedModeratorSlots - special },
  };
}

export function changeHostParticipation(settings: MafiaRoomSettings, hostPlays: boolean): MafiaRoomSettings {
  const special = specialRoleCount(settings.roles);
  const playablePlayers = settings.maxPlayers - (hostPlays ? 0 : 1);
  if (special > playablePlayers) return settings;
  return {
    ...settings,
    hostPlays,
    roles: { ...settings.roles, civilian: playablePlayers - special },
  };
}

function specialRoleCount(roles: MafiaRoomSettings["roles"]): number {
  return Object.entries(roles).reduce((total, [role, count]) => (
    role === "civilian" || role === "host" ? total : total + Number(count ?? 0)
  ), 0);
}
