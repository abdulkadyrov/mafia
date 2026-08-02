import React from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";
import { enforceAudioPermission } from "./audioPermissions";
import { listMediaDevices, requestMedia, stopMediaStream, type DeviceInventory } from "./mediaDevices";
import { closePeer, createPeerConnection, syncLocalTracks } from "./peerConnectionService";
import { closeSignalSubscription, sendVideoSignal, subscribeToVideoSignals } from "./signalingService";
import type { VideoParticipant, VideoProvider, VideoSignal } from "./videoTypes";

type VideoSessionRow = { user_id: string; audio_allowed: boolean; connection_state: string };

export function useVideoRoom(options: {
  roomId: string | null;
  enabled: boolean;
  audioAllowed: boolean;
}) {
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [participants, setParticipants] = React.useState<VideoParticipant[]>([]);
  const [devices, setDevices] = React.useState<DeviceInventory>({ cameras: [], microphones: [], speakers: [] });
  const [cameraEnabled, setCameraEnabled] = React.useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = React.useState(false);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = React.useState("");
  const [selectedMicrophoneDeviceId, setSelectedMicrophoneDeviceId] = React.useState("");
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = React.useState("");
  const [error, setError] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  const peersRef = React.useRef(new Map<string, RTCPeerConnection>());
  const streamsRef = React.useRef(new Map<string, MediaStream>());
  const signalChannelRef = React.useRef<RealtimeChannel | null>(null);
  const userIdRef = React.useRef<string | null>(null);
  const roomIdRef = React.useRef<string | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const audioPermissionRef = React.useRef(options.audioAllowed);
  const cameraDeviceIdRef = React.useRef("");
  const microphoneDeviceIdRef = React.useRef("");
  const pendingIceRef = React.useRef(new Map<string, RTCIceCandidateInit[]>());

  const createAndSendOffer = React.useCallback(async (remoteUserId: string, peer: RTCPeerConnection, iceRestart = false) => {
    if (peer.signalingState !== "stable") return;
    const offer = await peer.createOffer({ iceRestart });
    await peer.setLocalDescription(offer);
    await sendVideoSignal(roomIdRef.current!, userIdRef.current!, remoteUserId, "offer", offer);
  }, []);

  const removePeer = React.useCallback((remoteUserId: string) => {
    const peer = peersRef.current.get(remoteUserId);
    if (peer) closePeer(peer);
    peersRef.current.delete(remoteUserId);
    streamsRef.current.delete(remoteUserId);
    setParticipants((current) => current.filter((participant) => participant.userId !== remoteUserId));
  }, []);

  const restartIce = React.useCallback(async (remoteUserId: string, peer: RTCPeerConnection) => {
    if (userIdRef.current!.localeCompare(remoteUserId) >= 0) return;
    try {
      await createAndSendOffer(remoteUserId, peer, true);
    } catch {
      setError("Не удалось восстановить видеосвязь");
    }
  }, [createAndSendOffer]);

  const ensurePeer = React.useCallback((remoteUserId: string, shouldOffer: boolean): RTCPeerConnection => {
    const existing = peersRef.current.get(remoteUserId);
    if (existing) return existing;
    const roomId = roomIdRef.current!;
    const userId = userIdRef.current!;
    const peer = createPeerConnection({
      onIceCandidate: (candidate) => {
        void sendVideoSignal(roomId, userId, remoteUserId, "ice", candidate).catch(() => setError("Ошибка сигналинга"));
      },
      onTrack: (stream) => {
        streamsRef.current.set(remoteUserId, stream);
        setParticipants((current) => upsertParticipant(current, remoteUserId, { stream }));
      },
      onStateChange: (connectionState) => {
        setParticipants((current) => upsertParticipant(current, remoteUserId, { connectionState }));
        if (connectionState === "failed") void restartIce(remoteUserId, peer);
      },
      onNegotiationNeeded: () => {
        if (userId.localeCompare(remoteUserId) < 0) {
          void createAndSendOffer(remoteUserId, peer).catch(() => setError("Не удалось обновить видеопоток"));
        } else {
          void sendVideoSignal(roomId, userId, remoteUserId, "renegotiate", {}).catch(() => setError("Ошибка обновления видеопотока"));
        }
      },
    });
    syncLocalTracks(peer, localStreamRef.current);
    peersRef.current.set(remoteUserId, peer);
    setParticipants((current) => upsertParticipant(current, remoteUserId, { connectionState: peer.connectionState }));
    if (shouldOffer) {
      void createAndSendOffer(remoteUserId, peer).catch(() => setError("Не удалось начать видеосоединение"));
    }
    return peer;
  }, [createAndSendOffer, restartIce]);

  const refreshSessions = React.useCallback(async () => {
    const roomId = roomIdRef.current;
    const userId = userIdRef.current;
    if (!roomId || !userId) return;
    const { data } = await getSupabaseClient()
      .from("mafia_video_sessions")
      .select("user_id, audio_allowed, connection_state")
      .eq("room_id", roomId)
      .neq("connection_state", "closed");
    const sessions = (data ?? []) as VideoSessionRow[];
    const activeRemoteIds = new Set(sessions.filter((session) => session.user_id !== userId).map((session) => session.user_id));
    for (const remoteUserId of peersRef.current.keys()) {
      if (!activeRemoteIds.has(remoteUserId)) removePeer(remoteUserId);
    }
    for (const session of sessions) {
      if (session.user_id === userId) continue;
      ensurePeer(session.user_id, userId.localeCompare(session.user_id) < 0);
    }
  }, [ensurePeer, removePeer]);

  const handleSignal = React.useCallback(async (signal: VideoSignal) => {
    try {
      const peer = ensurePeer(signal.sender_user_id, false);
      if (signal.signal_type === "offer") {
        if (peer.signalingState !== "stable") await peer.setLocalDescription({ type: "rollback" });
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        await flushPendingIce(peer, signal.sender_user_id, pendingIceRef.current);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendVideoSignal(signal.room_id, userIdRef.current!, signal.sender_user_id, "answer", answer);
      } else if (signal.signal_type === "answer") {
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        await flushPendingIce(peer, signal.sender_user_id, pendingIceRef.current);
      } else if (signal.signal_type === "ice") {
        if (peer.remoteDescription) await peer.addIceCandidate(signal.payload as RTCIceCandidateInit);
        else pendingIceRef.current.set(signal.sender_user_id, [...(pendingIceRef.current.get(signal.sender_user_id) ?? []), signal.payload as RTCIceCandidateInit]);
      } else if (signal.signal_type === "renegotiate") {
        await createAndSendOffer(signal.sender_user_id, peer);
      } else if (signal.signal_type === "leave") {
        removePeer(signal.sender_user_id);
      }
    } catch {
      setError("Соединение с одним из участников прервано");
    } finally {
      void getSupabaseClient().from("mafia_video_signals").delete().eq("id", signal.id);
    }
  }, [createAndSendOffer, ensurePeer, removePeer]);

  const provider = React.useMemo<VideoProvider>(() => ({
    joinRoom: async (roomId) => {
      if (!options.enabled || joined) return;
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) throw new Error("Войдите в аккаунт для видеосвязи");
      userIdRef.current = user.id;
      roomIdRef.current = roomId;
      const { error: sessionError } = await getSupabaseClient().from("mafia_video_sessions").upsert({
        room_id: roomId,
        user_id: user.id,
        camera_enabled: cameraEnabled,
        microphone_enabled: microphoneEnabled && audioPermissionRef.current,
        audio_allowed: audioPermissionRef.current,
        connection_state: "connecting",
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "room_id,user_id" });
      if (sessionError) throw new Error("Не удалось войти в видеокомнату");
      signalChannelRef.current = subscribeToVideoSignals(roomId, user.id, handleSignal, () => void refreshSessions());
      await refreshSessions();
      await getSupabaseClient().from("mafia_video_sessions").update({ connection_state: "connected" }).eq("room_id", roomId).eq("user_id", user.id);
      setJoined(true);
    },
    leaveRoom: async () => {
      const roomId = roomIdRef.current;
      const userId = userIdRef.current;
      if (roomId && userId) {
        await Promise.all([...peersRef.current.keys()].map((remoteUserId) =>
          sendVideoSignal(roomId, userId, remoteUserId, "leave", {}).catch(() => undefined)
        ));
        await getSupabaseClient().from("mafia_video_sessions").update({
          connection_state: "closed",
          camera_enabled: false,
          microphone_enabled: false,
        }).eq("room_id", roomId).eq("user_id", userId);
      }
      await closeSignalSubscription(signalChannelRef.current);
      signalChannelRef.current = null;
      for (const peer of peersRef.current.values()) closePeer(peer);
      peersRef.current.clear();
      streamsRef.current.clear();
      pendingIceRef.current.clear();
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      setParticipants([]);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setJoined(false);
      roomIdRef.current = null;
      userIdRef.current = null;
    },
    enableCamera: async () => updateLocalMedia(true, microphoneEnabled),
    disableCamera: async () => updateLocalMedia(false, microphoneEnabled),
    enableMicrophone: async () => {
      if (!audioPermissionRef.current) throw new Error("Микрофон недоступен в текущей фазе");
      await updateLocalMedia(cameraEnabled, true);
    },
    disableMicrophone: async () => updateLocalMedia(cameraEnabled, false),
    selectCameraDevice: async (deviceId) => {
      cameraDeviceIdRef.current = deviceId;
      setSelectedCameraDeviceId(deviceId);
      if (cameraEnabled) await updateLocalMedia(true, microphoneEnabled);
    },
    selectMicrophoneDevice: async (deviceId) => {
      microphoneDeviceIdRef.current = deviceId;
      setSelectedMicrophoneDeviceId(deviceId);
      if (microphoneEnabled) await updateLocalMedia(cameraEnabled, true);
    },
    selectOutputDevice: async (deviceId) => {
      setSelectedOutputDeviceId(deviceId);
    },
    setPlayerAudioPermission: async (playerId, allowed) => {
      const stream = streamsRef.current.get(playerId);
      enforceAudioPermission(stream ?? null, allowed);
      setParticipants((current) => upsertParticipant(current, playerId, { audioAllowed: allowed }));
    },
  }), [cameraEnabled, handleSignal, joined, microphoneEnabled, options.enabled, refreshSessions]);

  async function updateLocalMedia(nextCamera: boolean, nextMicrophone: boolean) {
    const allowedMicrophone = nextMicrophone && audioPermissionRef.current;
    const nextStream = nextCamera || allowedMicrophone
      ? await requestMedia({
          camera: nextCamera,
          microphone: allowedMicrophone,
          cameraDeviceId: cameraDeviceIdRef.current || undefined,
          microphoneDeviceId: microphoneDeviceIdRef.current || undefined,
        })
      : null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = nextStream;
    setLocalStream(nextStream);
    setCameraEnabled(nextCamera);
    setMicrophoneEnabled(allowedMicrophone);
    for (const peer of peersRef.current.values()) syncLocalTracks(peer, nextStream);
    if (roomIdRef.current && userIdRef.current) {
      await getSupabaseClient().from("mafia_video_sessions").update({
        camera_enabled: nextCamera,
        microphone_enabled: allowedMicrophone,
        audio_allowed: audioPermissionRef.current,
        last_seen_at: new Date().toISOString(),
      }).eq("room_id", roomIdRef.current).eq("user_id", userIdRef.current);
    }
    setDevices(await listMediaDevices());
  }

  React.useEffect(() => {
    audioPermissionRef.current = options.audioAllowed;
    enforceAudioPermission(localStreamRef.current, options.audioAllowed && microphoneEnabled);
    if (!options.audioAllowed && microphoneEnabled) setMicrophoneEnabled(false);
    if (roomIdRef.current && userIdRef.current) {
      void getSupabaseClient().from("mafia_video_sessions").update({
        audio_allowed: options.audioAllowed,
        microphone_enabled: options.audioAllowed && microphoneEnabled,
      }).eq("room_id", roomIdRef.current).eq("user_id", userIdRef.current);
    }
  }, [microphoneEnabled, options.audioAllowed]);

  React.useEffect(() => {
    if (!options.enabled) return undefined;
    const refreshDevices = () => {
      void listMediaDevices().then(setDevices).catch(() => undefined);
    };
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [options.enabled]);

  const providerRef = React.useRef(provider);
  React.useEffect(() => {
    providerRef.current = provider;
  }, [provider]);
  React.useEffect(() => () => {
    void providerRef.current.leaveRoom();
  }, []);

  return {
    provider,
    localStream,
    participants,
    devices,
    cameraEnabled,
    microphoneEnabled,
    joined,
    error,
    selectedCameraDeviceId,
    selectedMicrophoneDeviceId,
    selectedOutputDeviceId,
    clearError: () => setError(""),
  };
}

async function flushPendingIce(
  peer: RTCPeerConnection,
  remoteUserId: string,
  pending: Map<string, RTCIceCandidateInit[]>
) {
  const candidates = pending.get(remoteUserId) ?? [];
  pending.delete(remoteUserId);
  for (const candidate of candidates) await peer.addIceCandidate(candidate);
}

function upsertParticipant(
  participants: VideoParticipant[],
  userId: string,
  patch: Partial<VideoParticipant>
): VideoParticipant[] {
  const current = participants.find((participant) => participant.userId === userId);
  const next: VideoParticipant = {
    userId,
    stream: current?.stream ?? null,
    connectionState: current?.connectionState ?? "new",
    isSpeaking: current?.isSpeaking ?? false,
    audioAllowed: current?.audioAllowed ?? true,
    ...patch,
  };
  return current
    ? participants.map((participant) => participant.userId === userId ? next : participant)
    : [...participants, next];
}
