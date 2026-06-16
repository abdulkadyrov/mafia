export const routes = {
  auth: "/",
  home: "/home",
  gamesHub: "/games",
  settingsHub: "/settings",
  packsHub: "/packs",
  launch: (gameId?: string) => (gameId ? `/launch/${gameId}` : "/launch"),
  gameJoin: (gameId: string, roomCode: string, teamId?: string | null) =>
    `/game/${gameId}/join?roomCode=${roomCode}${
      teamId ? `&teamId=${teamId}` : ""
    }`,
  room: (roomCode: string) => `/room/${roomCode}`,
  games: (roomCode: string) => `/room/${roomCode}/games`,
  game: (roomCode: string, gameId: string) => `/room/${roomCode}/game/${gameId}`,
  import: (roomCode: string) => `/room/${roomCode}/import`,
  settings: (roomCode: string) => `/room/${roomCode}/settings`,
} as const;
