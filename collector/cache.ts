import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

interface CacheEntry<T> {
  size: number
  mtimeMs: number
  value: T
}

interface CacheFile<T> {
  version: number
  entries: Record<string, CacheEntry<T>>
}

/**
 * Remembers what was parsed from a file, keyed by its size and modification time.
 * Claude Code transcripts can run to hundreds of megabytes and rarely change once a
 * session ends, so this turns a sync from seconds into milliseconds.
 */
export class FileCache<T> {
  private readonly file: string
  private readonly version: number
  private entries: Record<string, CacheEntry<T>> = {}
  private readonly seen = new Set<string>()
  private dirty = false

  constructor(file: string, version: number) {
    this.file = file
    this.version = version
    if (!existsSync(file)) return
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as CacheFile<T>
      if (parsed.version === version && parsed.entries) this.entries = parsed.entries
    } catch {
      // A damaged cache is just rebuilt.
    }
  }

  get(key: string, size: number, mtimeMs: number): T | undefined {
    const entry = this.entries[key]
    if (!entry || entry.size !== size || entry.mtimeMs !== mtimeMs) return undefined
    this.seen.add(key)
    return entry.value
  }

  set(key: string, size: number, mtimeMs: number, value: T): void {
    this.entries[key] = { size, mtimeMs, value }
    this.seen.add(key)
    this.dirty = true
  }

  /** Writes the cache, dropping files that were not seen during this run. */
  save(): void {
    const kept = Object.fromEntries(Object.entries(this.entries).filter(([key]) => this.seen.has(key)))
    if (!this.dirty && Object.keys(kept).length === Object.keys(this.entries).length) return
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify({ version: this.version, entries: kept } satisfies CacheFile<T>))
    } catch {
      // Caching is an optimisation; a read-only folder must not fail the sync.
    }
  }
}
