/** randomUUID is only available in secure contexts, so fall back when the app is opened over plain http on a LAN. */
export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
