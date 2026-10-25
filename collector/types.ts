import type { SyncEntry, SyncSourceStatus } from '../src/types.ts'

/** What one source (Claude Code, Codex, git) contributes to a sync. */
export interface SourceResult {
  status: SyncSourceStatus
  /** `projectPath` is the raw working directory; the collector maps it to a project root. */
  entries: SyncEntry[]
  /** Repository URLs a source happens to know, keyed by normalized path. */
  repoUrls?: Map<string, string>
}

export function unavailable(source: SyncSourceStatus['source'], note: string): SourceResult {
  return { status: { source, available: false, note }, entries: [] }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
