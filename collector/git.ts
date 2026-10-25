import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SyncEntry } from '../src/types.ts'

const execFileAsync = promisify(execFile)

// Spawning git is slow on Windows (~150 ms each), so callers run repositories in parallel.
async function git(args: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
    })
    return stdout.trim()
  } catch {
    return undefined
  }
}

export async function gitAvailable(): Promise<boolean> {
  return (await git(['--version'])) !== undefined
}

/** Turns any remote URL (ssh, git@, https with .git) into a browsable https URL. */
export function toHttpsUrl(remote: string): string | undefined {
  const trimmed = remote.trim().replace(/\.git$/, '')
  if (/^https?:\/\//.test(trimmed)) return trimmed
  const ssh = /^(?:ssh:\/\/)?(?:[\w.-]+@)?([\w.-]+)[:/]\/?(.+)$/.exec(trimmed)
  return ssh ? `https://${ssh[1]}/${ssh[2]}` : undefined
}

export async function gitOriginUrl(repo: string): Promise<string | undefined> {
  const remote = await git(['-C', repo, 'remote', 'get-url', 'origin'])
  return remote ? toHttpsUrl(remote) : undefined
}

/** Commits by the repository's configured user since `since`, newest first. */
export async function gitCommits(repo: string, since: Date): Promise<SyncEntry[]> {
  const email = await git(['-C', repo, 'config', 'user.email'])
  const args = ['-C', repo, 'log', `--since=${since.toISOString()}`, '--no-merges', '--format=%H%x1f%aI%x1f%s']
  if (email) args.push(`--author=${email}`)
  const log = await git(args)
  if (!log) return []
  const entries: SyncEntry[] = []
  for (const line of log.split('\n')) {
    const [sha, date, subject] = line.split('\x1f')
    const time = Date.parse(date ?? '')
    if (!sha || !Number.isFinite(time)) continue
    entries.push({
      id: `git:${sha.slice(0, 12)}`,
      projectPath: repo,
      kind: 'commit',
      source: 'git',
      summary: subject?.trim() || 'Commit',
      timestamp: new Date(time).toISOString(),
    })
  }
  return entries
}
