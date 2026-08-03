import type { ReactNode } from "react";
import type { VideoParticipant } from "../../core/video/videoTypes";
import type { MafiaPlayerView } from "../../core/room/mafiaRoomTypes";
import { orderPlayersSelfFirst } from "../../core/room/orderPlayersSelfFirst";
import { ParticipantTile } from "./ParticipantTile";

export function VideoGrid({ players, selfUserId, localStream, participants, outputDeviceId = "", className = "", emptySlots = 0, actionsForPlayer }: {
  players: MafiaPlayerView[];
  selfUserId: string;
  localStream: MediaStream | null;
  participants: VideoParticipant[];
  outputDeviceId?: string;
  className?: string;
  emptySlots?: number;
  actionsForPlayer?: (player: MafiaPlayerView) => ReactNode;
}) {
  const orderedPlayers = orderPlayersSelfFirst(players, selfUserId);
  return (
    <section className={`mafia-video-grid mafia-video-grid--${Math.min(players.length, 9)} ${className}`.trim()}>
      {orderedPlayers.map((player) => {
        const local = player.user_id === selfUserId;
        const remote = participants.find((participant) => participant.userId === player.user_id);
        return <ParticipantTile key={player.id} player={player} local={local} stream={local ? localStream : remote?.stream ?? null} outputDeviceId={outputDeviceId} actions={actionsForPlayer?.(player)} />;
      })}
      {Array.from({ length: Math.max(0, emptySlots) }, (_, index) => (
        <article className="mafia-video-tile mafia-video-tile--empty" key={`empty-${index}`}>
          <span>＋</span>
          <strong>Свободно</strong>
        </article>
      ))}
    </section>
  );
}
