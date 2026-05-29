import { toDataURL } from 'qrcode'

export function generateRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function normalizeRoomCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6)
}

export function createRoomPeerId(roomCode: string): string {
  if (roomCode.startsWith('mafia-turborz-')) return roomCode

  return `mafia-turborz-${normalizeRoomCode(roomCode)}`
}

export async function generateQRCode(data: string): Promise<string> {
  return toDataURL(data, { margin: 1, width: 300 })
}
