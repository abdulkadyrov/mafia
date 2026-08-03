import React from "react";
import { MafiaBackground } from "../../core/ui/MafiaBackground";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { NightActionType } from "../../core/game/gameTypes";
import type { MafiaPlayerView, MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { PlayerCard } from "../../core/ui/PlayerCard";
import { PhaseTimer } from "../../core/ui/PhaseTimer";
import { GameChat } from "../chat/GameChat";
import { getLatestMafiaChoices, type MafiaChoice } from "./mafiaConsensus";

export function NightScreen({ snapshot, applySnapshot, onCancel }: { snapshot: MafiaSnapshot; applySnapshot: (snapshot: MafiaSnapshot) => void; onCancel: () => void }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [dismissedChoiceId, setDismissedChoiceId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const phase = snapshot.game?.phase ?? "night_intro";
  const role = snapshot.self.role;
  const actionType = getActionForPhase(role, phase);
  const canAct = snapshot.self.lifeStatus === "alive" && Boolean(actionType);
  const candidates = snapshot.players.filter((player) => canTarget(snapshot, player, actionType));
  const isMafiaChatVisible = snapshot.self.team === "mafia" && phase === "night_mafia";
  const isMafiaDecision = actionType === "mafia_kill";
  const roundNumber = snapshot.game?.round_number ?? 1;
  const gameId = snapshot.game?.id ?? null;
  const mafiaChoices = React.useMemo(
    () => getLatestMafiaChoices(snapshot.events, roundNumber, gameId),
    [gameId, roundNumber, snapshot.events]
  );
  const ownChoice = mafiaChoices.find((choice) => choice.actorId === snapshot.self.gamePlayerId);
  const otherChoices = mafiaChoices.filter((choice) => choice.actorId !== snapshot.self.gamePlayerId);
  const allMafiaAgree = mafiaChoices.length > 1 && new Set(mafiaChoices.map((choice) => choice.targetId)).size === 1;
  const choiceToAnswer = [...otherChoices].reverse().find((choice) => !ownChoice || choice.targetId !== ownChoice.targetId)
    ?? [...otherChoices].reverse()[0];
  const choicePlayer = choiceToAnswer
    ? snapshot.players.find((player) => player.gamePlayerId === choiceToAnswer.targetId)
    : undefined;
  const showChoicePrompt = isMafiaDecision
    && !allMafiaAgree
    && Boolean(choiceToAnswer && choicePlayer)
    && String(choiceToAnswer?.eventId) !== dismissedChoiceId;

  React.useEffect(() => {
    setSubmitted(false);
    setSelectedId(null);
    setDismissedChoiceId(null);
  }, [phase, roundNumber]);

  React.useEffect(() => {
    if (!isMafiaDecision || !ownChoice) return;
    const selectedPlayer = snapshot.players.find((player) => player.gamePlayerId === ownChoice.targetId);
    setSubmitted(true);
    setSelectedId(selectedPlayer?.id ?? null);
  }, [isMafiaDecision, ownChoice, snapshot.players]);

  async function submit(player: MafiaPlayerView) {
    if (!actionType || !player.gamePlayerId || (submitted && !isMafiaDecision)) return;
    setSelectedId(player.id);
    if (choiceToAnswer) setDismissedChoiceId(String(choiceToAnswer.eventId));
    setBusy(true);
    setError("");
    try {
      await mafiaCommands.nightAction(snapshot.room.id, actionType, player.gamePlayerId);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить действие");
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    setBusy(true);
    setError("");
    try { applySnapshot(await mafiaCommands.advancePhase(snapshot.room.id, snapshot.room.phase_version)); setSubmitted(false); setSelectedId(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось продолжить ночь"); }
    finally { setBusy(false); }
  }

  const heading = phaseHeading(phase);
  return (
    <main className="mafia-page mafia-night-page">
      <MafiaBackground name="night" />
      <section className="mafia-night-shell">
        <header className="mafia-phase-header">
          <div><span className="mafia-eyebrow">Ночь {snapshot.game?.round_number ?? 1}</span><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
          <PhaseTimer endsAt={snapshot.room.phase_ends_at} onExpire={snapshot.room.auto_phase ? () => void advance() : undefined} />
        </header>

        <div className={`mafia-night-layout ${isMafiaChatVisible ? "with-chat" : ""}`}>
          <section className="mafia-night-action-panel">
            {phase === "night_intro" ? <SleepingState text="Город погружается в тишину. Приготовьтесь передать устройство следующей роли." /> : null}
            {phase === "night_resolution" ? <SleepingState text="Ведущий собирает решения. Скоро город узнает, что произошло этой ночью." /> : null}
            {!canAct && phase !== "night_intro" && phase !== "night_resolution" ? <SleepingState text={snapshot.self.lifeStatus === "dead" ? "Вы наблюдаете за игрой. Микрофон отключён." : "Ваша роль спит. Не подсматривайте за действиями других игроков."} /> : null}
            {canAct ? (
              <>
                {isMafiaDecision && allMafiaAgree && ownChoice ? (
                  <MafiaAgreement player={snapshot.players.find((player) => player.gamePlayerId === ownChoice.targetId)} />
                ) : null}
                {showChoicePrompt && choiceToAnswer && choicePlayer ? (
                  <MafiaChoicePrompt
                    snapshot={snapshot}
                    choice={choiceToAnswer}
                    target={choicePlayer}
                    busy={busy}
                    onAgree={() => void submit(choicePlayer)}
                    onChooseAnother={() => setDismissedChoiceId(String(choiceToAnswer.eventId))}
                  />
                ) : null}
                <div className="mafia-action-instruction"><span>{actionIcon(actionType!)}</span><div><strong>{actionLabel(actionType!)}</strong><p>{isMafiaDecision ? (submitted ? "Ваш выбор сохранён. Его можно изменить до конца хода мафии." : "Выберите жертву или согласитесь с выбором напарника.") : (submitted ? "Решение сохранено и не может быть изменено." : "Выберите живого игрока. Решение можно отправить только один раз.")}</p></div></div>
                <div className="mafia-target-grid">
                  {candidates.map((player) => <PlayerCard key={player.id} player={player} selected={player.id === selectedId} disabled={busy || (submitted && !isMafiaDecision)} compact onClick={() => void submit(player)} />)}
                </div>
              </>
            ) : null}
            {snapshot.self.isHost && phase.startsWith("night_") ? <HostNightMonitor snapshot={snapshot} /> : null}
          </section>
          {isMafiaChatVisible ? <aside><GameChat snapshot={snapshot} defaultChannel="mafia_chat" /></aside> : null}
        </div>

        {snapshot.self.isHost ? <footer className="mafia-action-bar"><span className="mafia-muted-copy">Ведущий видит служебные события, но не раскрывает их игрокам.</span><button className="mafia-secondary-button danger" onClick={onCancel}>Отменить игру</button><button className="mafia-primary-button" disabled={busy} onClick={() => void advance()}>{busy ? "Обрабатываем…" : phase === "night_resolution" ? "Объявить утро" : "Следующая фаза"}</button></footer> : null}
        {error ? <div className="mafia-toast">{error}</div> : null}
      </section>
    </main>
  );
}

function MafiaChoicePrompt({ snapshot, choice, target, busy, onAgree, onChooseAnother }: {
  snapshot: MafiaSnapshot;
  choice: MafiaChoice;
  target: MafiaPlayerView;
  busy: boolean;
  onAgree: () => void;
  onChooseAnother: () => void;
}) {
  const actor = snapshot.players.find((player) => player.gamePlayerId === choice.actorId);
  return (
    <section className="mafia-consensus-card" aria-live="polite">
      <span className="mafia-eyebrow">Решение напарника</span>
      <h2>{actor?.display_name ?? "Игрок мафии"} <small>(мафия)</small> выбрал убить {target.display_name}</h2>
      <p>Вы согласны с ним или хотите выбрать другого?</p>
      <div>
        <button className="mafia-primary-button" disabled={busy} onClick={onAgree}>Согласен</button>
        <button className="mafia-secondary-button" disabled={busy} onClick={onChooseAnother}>Выбрать другого</button>
      </div>
    </section>
  );
}

function MafiaAgreement({ player }: { player?: MafiaPlayerView }) {
  return (
    <div className="mafia-consensus-agreed" aria-live="polite">
      <span>✓</span>
      <div><strong>Цель согласована</strong><p>Мафия выбрала: {player?.display_name ?? "игрок"}</p></div>
    </div>
  );
}

function HostNightMonitor({ snapshot }: { snapshot: MafiaSnapshot }) {
  const actions = snapshot.events.filter((event) =>
    event.round_number === snapshot.game?.round_number
    && event.event_type === "night_action_submitted"
  );
  const playerName = (gamePlayerId: unknown) => snapshot.players.find((player) => player.gamePlayerId === gamePlayerId)?.display_name ?? "Игрок";
  return (
    <section className="mafia-host-monitor">
      <span className="mafia-eyebrow">Пульт ведущего</span>
      <h2>Ночные решения</h2>
      {actions.length === 0 ? <p>Действия ещё не отправлены.</p> : actions.map((event) => (
        <article key={event.id}>
          <strong>{hostActionLabel(String(event.payload.actionType ?? ""))}</strong>
          <span>{playerName(event.payload.actorId)} → {playerName(event.payload.targetId)}</span>
        </article>
      ))}
    </section>
  );
}

function hostActionLabel(action: string) {
  if (action === "mafia_kill") return "Выбор мафии";
  if (action === "doctor_heal") return "Лечение доктора";
  if (action === "commissioner_check") return "Проверка комиссара";
  if (action === "maniac_kill") return "Выбор маньяка";
  if (action === "mistress_block") return "Блокировка любовницы";
  if (action === "bodyguard_protect") return "Защита телохранителя";
  return "Служебное действие";
}

function SleepingState({ text }: { text: string }) {
  return <div className="mafia-sleeping-state"><span>☾</span><h2>Город спит</h2><p>{text}</p></div>;
}

function getActionForPhase(role: MafiaSnapshot["self"]["role"], phase: string): NightActionType | null {
  if ((role === "mafia" || role === "don") && phase === "night_mafia") return "mafia_kill";
  if (role === "doctor" && phase === "night_doctor") return "doctor_heal";
  if (role === "commissioner" && phase === "night_commissioner") return "commissioner_check";
  if (role === "maniac" && phase === "night_mafia") return "maniac_kill";
  if (role === "mistress" && phase === "night_mafia") return "mistress_block";
  if (role === "bodyguard" && phase === "night_doctor") return "bodyguard_protect";
  return null;
}

function canTarget(snapshot: MafiaSnapshot, player: MafiaPlayerView, action: NightActionType | null) {
  if (!action || player.life_status !== "alive" || player.is_host || !player.gamePlayerId) return false;
  if (action === "doctor_heal") return true;
  if (player.gamePlayerId === snapshot.self.gamePlayerId) return false;
  if (action === "mafia_kill" && player.team === "mafia") return false;
  return true;
}

function phaseHeading(phase: string) {
  if (phase === "night_intro") return { title: "Наступает ночь", subtitle: "Все игровые действия защищены сервером." };
  if (phase === "night_mafia") return { title: "Ход мафии", subtitle: "Мафия выбирает жертву." };
  if (phase === "night_doctor") return { title: "Ход доктора", subtitle: "Доктор пытается спасти игрока." };
  if (phase === "night_commissioner") return { title: "Ход комиссара", subtitle: "Комиссар проверяет подозреваемого." };
  return { title: "Итоги ночи", subtitle: "Решения применяются один раз." };
}

function actionLabel(action: NightActionType) {
  if (action === "mafia_kill" || action === "maniac_kill") return "Выберите жертву";
  if (action === "doctor_heal") return "Кого лечить?";
  if (action === "commissioner_check") return "Кого проверить?";
  if (action === "mistress_block") return "Чьё действие заблокировать?";
  return "Кого защитить?";
}

function actionIcon(action: NightActionType) {
  if (action.includes("kill")) return "✦";
  if (action === "doctor_heal") return "+";
  if (action === "commissioner_check") return "⌖";
  return "◈";
}
