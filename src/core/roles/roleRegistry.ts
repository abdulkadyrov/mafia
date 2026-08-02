import type { MafiaRole, RoleDefinition } from "./roleTypes.ts";

export const roleRegistry: Record<MafiaRole, RoleDefinition> = {
  mafia: {
    id: "mafia",
    team: "mafia",
    name: "Мафия",
    shortDescription: "Ночью выбирает жертву вместе с мафией.",
    rules: ["Не раскрывайте команду", "Победите, сравнявшись числом с городом"],
    nightAction: "mafia_kill",
  },
  don: {
    id: "don",
    team: "mafia",
    name: "Дон",
    shortDescription: "Возглавляет мафию и участвует в выборе жертвы.",
    rules: ["Ваш голос учитывается в решении мафии", "Защищайте команду"],
    nightAction: "mafia_kill",
  },
  doctor: {
    id: "doctor",
    team: "city",
    name: "Доктор",
    shortDescription: "Каждую ночь спасает одного игрока.",
    rules: ["Выберите только живого игрока", "Самолечение ограничивается правилами комнаты"],
    nightAction: "doctor_heal",
  },
  commissioner: {
    id: "commissioner",
    team: "city",
    name: "Комиссар",
    shortDescription: "Проверяет принадлежность игрока к мафии.",
    rules: ["Результат проверки видите только вы", "Не раскрывайтесь слишком рано"],
    nightAction: "commissioner_check",
  },
  civilian: {
    id: "civilian",
    team: "city",
    name: "Мирный житель",
    shortDescription: "Обсуждает события и голосует днём.",
    rules: ["Ночью не совершает действий", "Ищите мафию по поведению игроков"],
    nightAction: null,
  },
  maniac: {
    id: "maniac",
    team: "neutral",
    name: "Маньяк",
    shortDescription: "Играет в одиночку и выбирает ночную жертву.",
    rules: ["У вас нет союзников", "Останьтесь последним живым игроком"],
    nightAction: "maniac_kill",
  },
  mistress: {
    id: "mistress",
    team: "city",
    name: "Любовница",
    shortDescription: "Блокирует ночное действие выбранного игрока.",
    rules: ["Нельзя выбрать погибшего", "Заблокированное действие не применяется"],
    nightAction: "mistress_block",
  },
  bodyguard: {
    id: "bodyguard",
    team: "city",
    name: "Телохранитель",
    shortDescription: "Защищает игрока от одного ночного нападения.",
    rules: ["Защита действует одну ночь", "Нельзя защищать погибшего"],
    nightAction: "bodyguard_protect",
  },
  host: {
    id: "host",
    team: "host",
    name: "Ведущий",
    shortDescription: "Управляет темпом партии и видит служебные события.",
    rules: ["Не участвует в голосовании", "Не раскрывает секретные действия"],
    nightAction: null,
  },
};

export function getRoleDefinition(role: MafiaRole): RoleDefinition {
  return roleRegistry[role];
}
