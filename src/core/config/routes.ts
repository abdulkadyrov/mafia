export const routes = {
  home: "/",
  room: (roomCode: string) => `/room/${roomCode}`,
  games: (roomCode: string) => `/room/${roomCode}/games`,
  game: (roomCode: string, gameId: string) => `/room/${roomCode}/game/${gameId}`,
  import: (roomCode: string) => `/room/${roomCode}/import`,
  settings: (roomCode: string) => `/room/${roomCode}/settings`,
} as const;

