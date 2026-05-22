import { toDataURL } from 'qrcode'

export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const part = () =>
    Array.from({ length: 4 })
      .map(() => letters[Math.floor(Math.random() * letters.length)])
      .join('')
  const digits = Math.floor(10 + Math.random() * 90)
  return `${part()}-${digits}`
}

export async function generateQRCode(data: string): Promise<string> {
  return toDataURL(data, { margin: 1, width: 300 })
}
