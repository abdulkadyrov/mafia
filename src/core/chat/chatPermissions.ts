import type { GamePhase } from "../game/gameTypes.ts";
import type { ChatActor, ChatChannel } from "./chatTypes.ts";

export type ChatPolicy = {
  chatEnabled: boolean;
  deadChatEnabled: boolean;
  deadCanReadAliveChat: boolean;
};

const aliveChatPhases: readonly GamePhase[] = [
  "day_announcement",
  "day_discussion",
  "day_voting",
  "day_execution",
];

export function canReadChat(
  actor: ChatActor,
  channel: ChatChannel,
  policy: ChatPolicy
): boolean {
  if (channel === "system_chat" || channel === "room_chat") return true;
  if (channel === "alive_chat") return actor.lifeStatus === "alive" || policy.deadCanReadAliveChat;
  if (channel === "mafia_chat") return actor.lifeStatus === "alive" && actor.team === "mafia";
  return channel === "dead_chat" && actor.lifeStatus === "dead" && policy.deadChatEnabled;
}

export function canSendChat(
  actor: ChatActor,
  channel: ChatChannel,
  phase: GamePhase,
  policy: ChatPolicy
): boolean {
  if (!policy.chatEnabled || actor.blocked || actor.lifeStatus === "disconnected") return false;
  if (channel === "system_chat") return false;
  if (channel === "room_chat") return phase === "lobby";
  if (channel === "alive_chat") return actor.lifeStatus === "alive" && aliveChatPhases.includes(phase);
  if (channel === "mafia_chat") {
    return actor.lifeStatus === "alive" && actor.team === "mafia" && phase === "night_mafia";
  }
  return channel === "dead_chat" && actor.lifeStatus === "dead" && policy.deadChatEnabled;
}

export function normalizeChatMessage(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new Error("Сообщение пустое");
  if (normalized.length > 500) throw new Error("Сообщение длиннее 500 символов");
  return normalized;
}
