import { RoomSettings } from '../types/game'

export const defaultRoomSettings: RoomSettings = {
  playerLimit: 8,
  roles: {
    mafia: 2,
    doctors: 1,
    detectives: 1,
    civilians: 4
  },
  timers: {
    nightSeconds: 45,
    discussionSeconds: 120,
    votingSeconds: 45
  },
  revealRolesAfterDeath: true,
  showActionHistory: true,
  bettingMode: true,
  privateRoom: false,
  autoStart: false,
  doctorSelfHealsLimit: 1
}

export const samplePlayerNames = ['Тимур', 'Леха', 'Адам', 'Мира', 'Ника', 'Саша', 'Илья', 'Рита']
