export type ChatChannel =
  | "room_chat"
  | "alive_chat"
  | "mafia_chat"
  | "dead_chat"
  | "system_chat";

export type ChatActor = {
  lifeStatus: "alive" | "dead" | "disconnected";
  team: "mafia" | "city" | "neutral" | "host";
  blocked: boolean;
};
