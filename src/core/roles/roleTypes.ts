export type MafiaRole =
  | "mafia"
  | "don"
  | "doctor"
  | "commissioner"
  | "civilian"
  | "maniac"
  | "mistress"
  | "bodyguard"
  | "host";

export type MafiaTeam = "mafia" | "city" | "neutral" | "host";

export type RoleCounts = Partial<Record<MafiaRole, number>>;

export type RoleDefinition = {
  id: MafiaRole;
  team: MafiaTeam;
  name: string;
  shortDescription: string;
  rules: string[];
  nightAction:
    | "mafia_kill"
    | "doctor_heal"
    | "commissioner_check"
    | "maniac_kill"
    | "mistress_block"
    | "bodyguard_protect"
    | null;
};
