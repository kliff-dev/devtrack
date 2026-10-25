const PREFIX = 'devtrack:v1:'

/** Reads and parses a stored JSON value. Returns undefined when it is missing or unreadable. */
export function readStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage is full or disabled (e.g. private mode); keep working from in-memory state.
  }
}
