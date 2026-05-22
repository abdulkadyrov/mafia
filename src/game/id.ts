export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  const timePart = Date.now().toString(36)
  return `${prefix}_${timePart}_${randomPart}`
}
