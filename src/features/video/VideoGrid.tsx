import type { VideoParticipant } from "../../core/video/videoTypes";
import type { MafiaPlayerView } from "../../core/room/mafiaRoomTypes";
import { orderPlayersSelfFirst } from "../../core/room/orderPlayersSelfFirst";
import { ParticipantTile } from "./ParticipantTile";

export function VideoGrid({ players, selfUserId, localStream, participants, outputDeviceId = "" }: {
  players: MafiaPlayerView[];
  selfUserId: string;
  localStream: MediaStream | null;
  participants: VideoParticipant[];
  outputDeviceId?: string;
}) {
  const orderedPlayers = orderPlayersSelfFirst(players, selfUserId);
  return (
    <section className={`mafia-video-grid mafia-video-grid--${Math.min(players.length, 9)}`}>
      {orderedPlayers.map((player) => {
        const local = player.user_id === selfUserId;
        const remote = participants.find((participant) => participant.userId === player.user_id);
        return <ParticipantTile key={player.id} player={player} local={local} stream={local ? localStream : remote?.stream ?? null} outputDeviceId={outputDeviceId} />;
      })}
    </section>
  );
}
