import { describe, expect, it } from "vitest";
import { chooseMediumBotNightTarget, chooseMediumBotVote, mediumBotDiscussionLine, type BotMindPlayer } from "./botStrategy";

const players: BotMindPlayer[] = [
  player("mafia", "mafia", "mafia"),
  player("doctor", "doctor", "city"),
  player("commissioner", "commissioner", "city"),
  player("civilian", "civilian", "city"),
];

describe("medium bot strategy", () => {
  it("never lets a mafia bot attack its teammate or itself", () => {
    const teammate = player("don", "don", "mafia");
    const target = chooseMediumBotNightTarget(players[0], [...players, teammate], {}, () => 0.5);
    expect(target?.team).not.toBe("mafia");
    expect(target?.id).not.toBe(players[0].id);
  });

  it("uses a commissioner's confirmed result during voting", () => {
    const target = chooseMediumBotVote(players[2], players, { knownMafiaIds: [players[0].id] }, () => 0.1);
    expect(target?.id).toBe(players[0].id);
  });

  it("avoids repeating a night target when another valid choice exists", () => {
    const target = chooseMediumBotNightTarget(players[1], players, { previousTargetIds: [players[3].id] }, () => 0.5);
    expect(target?.id).not.toBe(players[3].id);
  });

  it("produces a bounded discussion phrase", () => {
    expect(mediumBotDiscussionLine("Сильва", "Марко", () => 0)).toContain("Марко");
  });
});

function player(id: string, role: BotMindPlayer["role"], team: BotMindPlayer["team"]): BotMindPlayer {
  return { id, role, team, lifeStatus: "alive", isHost: false };
}
