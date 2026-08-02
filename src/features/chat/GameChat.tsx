import React from "react";
import { canReadChat, canSendChat } from "../../core/chat/chatPermissions";
import type { ChatChannel } from "../../core/chat/chatTypes";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaSnapshot } from "../../core/room/mafiaRoomTypes";

const channelLabels: Record<ChatChannel, string> = {
  room_chat: "Комната",
  alive_chat: "Живые",
  mafia_chat: "Мафия",
  dead_chat: "Погибшие",
  system_chat: "События",
};

export function GameChat({ snapshot, defaultChannel }: { snapshot: MafiaSnapshot; defaultChannel?: ChatChannel }) {
  const actor = React.useMemo(() => ({
    lifeStatus: snapshot.self.lifeStatus,
    team: snapshot.self.team ?? (snapshot.self.isHost ? "host" as const : "city" as const),
    blocked: false,
  }), [snapshot.self.isHost, snapshot.self.lifeStatus, snapshot.self.team]);
  const policy = React.useMemo(() => ({
    chatEnabled: snapshot.room.chat_enabled,
    deadChatEnabled: snapshot.room.dead_chat_enabled,
    deadCanReadAliveChat: snapshot.room.dead_can_read_alive_chat,
  }), [snapshot.room.chat_enabled, snapshot.room.dead_can_read_alive_chat, snapshot.room.dead_chat_enabled]);
  const visibleChannels = React.useMemo(
    () => (Object.keys(channelLabels) as ChatChannel[]).filter((item) => canReadChat(actor, item, policy)),
    [actor, policy]
  );
  const fallback = visibleChannels.includes(defaultChannel ?? "room_chat") ? defaultChannel! : visibleChannels[0];
  const [channel, setChannel] = React.useState<ChatChannel>(fallback);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const selectedChannel = visibleChannels.includes(channel) ? channel : (visibleChannels[0] ?? "system_chat");
  const canSend = canSendChat(actor, selectedChannel, snapshot.room.phase, policy);
  const messages = snapshot.messages.filter((message) => message.channel === selectedChannel);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const content = draft.trim();
    if (!content || !canSend) return;
    setSending(true);
    setError("");
    try {
      await mafiaCommands.sendChat(snapshot.room.id, selectedChannel, content);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mafia-chat-panel">
      <div className="mafia-chat-tabs" role="tablist">
        {visibleChannels.map((item) => (
          <button key={item} role="tab" aria-selected={selectedChannel === item} className={selectedChannel === item ? "active" : ""} onClick={() => setChannel(item)}>
            {channelLabels[item]}
          </button>
        ))}
      </div>
      <div className="mafia-chat-messages" ref={listRef} aria-live="polite">
        {messages.length === 0 ? <p className="mafia-chat-empty">Здесь пока тихо.</p> : messages.map((message) => (
          <article key={message.id} className={message.channel === "system_chat" ? "mafia-system-message" : "mafia-chat-message"}>
            <div><strong>{message.author_name}</strong><time>{formatTime(message.created_at)}</time></div>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      {canSend ? (
        <div className="mafia-chat-composer">
          <textarea
            value={draft}
            maxLength={500}
            rows={2}
            placeholder="Сообщение…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button disabled={sending || !draft.trim()} onClick={() => void send()} aria-label="Отправить">➤</button>
        </div>
      ) : <p className="mafia-chat-readonly">В этой фазе чат доступен только для чтения.</p>}
      {error ? <p className="mafia-inline-error">{error}</p> : null}
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
