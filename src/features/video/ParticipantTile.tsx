import React from "react";
import { Avatar } from "../../core/ui/Avatar";
import type { MafiaPlayerView } from "../../core/room/mafiaRoomTypes";
import { useMafiaAudio } from "../../core/audio/MafiaAudioProvider";

export function ParticipantTile({ player, stream, local = false, outputDeviceId = "" }: { player: MafiaPlayerView; stream: MediaStream | null; local?: boolean; outputDeviceId?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const { voiceVolume, allMuted } = useMafiaAudio();
  const isSpeaking = useSpeakingIndicator(stream);
  React.useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = stream;
    return () => { if (video) video.srcObject = null; };
  }, [stream]);
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.volume = allMuted ? 0 : voiceVolume;
  }, [allMuted, voiceVolume]);
  React.useEffect(() => {
    const video = videoRef.current as (HTMLVideoElement & { setSinkId?: (deviceId: string) => Promise<void> }) | null;
    if (!local && video?.setSinkId) void video.setSinkId(outputDeviceId).catch(() => undefined);
  }, [local, outputDeviceId, stream]);
  const dead = player.life_status === "dead";
  const hasLiveVideo = stream?.getVideoTracks().some((track) => track.enabled && track.readyState === "live") ?? false;
  const hasLiveAudio = stream?.getAudioTracks().some((track) => track.enabled && track.readyState === "live") ?? false;

  return (
    <article className={`mafia-video-tile ${dead ? "mafia-video-tile--dead" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted={local} className={hasLiveVideo ? "" : "mafia-media-audio-only"} />
      {!hasLiveVideo ? <div className="mafia-video-placeholder"><Avatar name={player.display_name} url={player.avatar_url} size="large" /></div> : null}
      <div className="mafia-video-label">
        <span className={isSpeaking ? "mafia-speaking-dot" : hasLiveAudio && !dead ? "mafia-audio-idle-dot" : "mafia-muted-dot"} />
        <strong>{player.display_name}{local ? " · вы" : ""}</strong>
        {dead ? <em>Погиб</em> : null}
      </div>
      <button
        className="mafia-fullscreen-button"
        aria-label={`Развернуть видео ${player.display_name}`}
        onClick={(event) => { void event.currentTarget.parentElement?.requestFullscreen?.(); }}
      >⛶</button>
    </article>
  );
}

function useSpeakingIndicator(stream: MediaStream | null) {
  const [speaking, setSpeaking] = React.useState(false);
  React.useEffect(() => {
    const liveTrack = stream?.getAudioTracks().find((track) => track.enabled && track.readyState === "live");
    if (!stream || !liveTrack || typeof AudioContext === "undefined") {
      setSpeaking(false);
      return undefined;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let lastValue = false;
    const measure = () => {
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        energy += centered * centered;
      }
      const nextValue = liveTrack.enabled && Math.sqrt(energy / samples.length) > 0.035;
      if (nextValue !== lastValue) {
        lastValue = nextValue;
        setSpeaking(nextValue);
      }
      frame = requestAnimationFrame(measure);
    };
    void context.resume().catch(() => undefined);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      analyser.disconnect();
      void context.close();
      setSpeaking(false);
    };
  }, [stream]);
  return speaking;
}
