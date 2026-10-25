import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { SyncEntry, SyncPayload, SyncProject, SyncSourceStatus } from '../src/types.ts'
import { FileCache } from './cache.ts'
import { collectClaudeCode, type ParsedTranscript } from './claudeCode.ts'
import { collectCodex } from './codex.ts'
import type { CollectorConfig } from './config.ts'
import { gitAvailable, gitCommits, toHttpsUrl } from './git.ts'
import { displayPath, findProjectRoot, isGitRoot, pathKey } from './paths.ts'
import { describeProject } from './projects.ts'

interface RegisteredProject {
  path: string
  entries: number
}

/** Repositories directly inside the configured scan folders. */
function scanRepositories(scanDirs: string[]): string[] {
  const repos: string[] = []
  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue
    for (const child of readdirSync(dir, { withFileTypes: true })) {
      if (!child.isDirectory()) continue
      const path = join(dir, child.name)
      if (isGitRoot(path)) repos.push(displayPath(path))
    }
  }
  return repos
}

export async function runCollector(config: CollectorConfig, now = new Date()): Promise<SyncPayload> {
  const since = new Date(now.getTime() - config.lookbackDays * 24 * 60 * 60 * 1000)
  const idleGapMs = config.idleGapMinutes * 60 * 1000

  // Bump the version whenever parseTranscript changes what it extracts.
  const transcriptCache = new FileCache<ParsedTranscript>(join(config.cacheDir, 'claude-transcripts.json'), 1)
  const [claude, codex, hasGit] = await Promise.all([
    collectClaudeCode({ claudeDir: config.claudeDir, since, idleGapMs, cache: transcriptCache }),
    Promise.resolve(collectCodex({ codexDir: config.codexDir, since, idleGapMs })),
    gitAvailable(),
  ])
  transcriptCache.save()

  // Sessions are attributed to the folder's project root, so work done from a
  // subfolder and from the repository root lands on the same project.
  const registry = new Map<string, RegisteredProject>()
  const register = (path: string) => {
    const key = pathKey(path)
    const existing = registry.get(key)
    if (existing) return existing
    const created = { path: displayPath(path), entries: 0 }
    registry.set(key, created)
    return created
  }
  const attribute = (entries: SyncEntry[]): SyncEntry[] =>
    entries.map((entry) => {
      const project = register(findProjectRoot(entry.projectPath))
      return { ...entry, projectPath: project.path }
    })

  const sessions = [...attribute(claude.entries), ...attribute(codex.entries)]
  for (const repo of scanRepositories(config.scanDirs)) register(repo)

  const repos = hasGit ? [...registry.values()].map((project) => project.path).filter(isGitRoot) : []
  const commits = (await Promise.all(repos.map((repo) => gitCommits(repo, since)))).flat()
  const gitStatus: SyncSourceStatus = hasGit
    ? {
        source: 'git',
        available: true,
        commits: commits.length,
        repos: repos.length,
        note: `${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}`,
      }
    : { source: 'git', available: false, note: 'git is not on PATH' }

  const sinceIso = since.toISOString()
  const activity = [...sessions, ...commits]
    .filter((entry) => entry.timestamp >= sinceIso)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  for (const entry of activity) register(entry.projectPath).entries += 1

  const active = [...registry].filter(([, project]) => project.entries > 0)
  const projects: SyncProject[] = await Promise.all(
    active.map(async ([key, project]) => {
      const described = await describeProject(project.path)
      const knownRemote = codex.repoUrls?.get(key)
      return {
        ...described,
        repoUrl: described.repoUrl ?? (knownRemote ? toHttpsUrl(knownRemote) : undefined),
      }
    }),
  )
  projects.sort((a, b) => a.name.localeCompare(b.name))

  return {
    version: 1,
    syncedAt: now.toISOString(),
    lookbackDays: config.lookbackDays,
    idleGapMinutes: config.idleGapMinutes,
    sources: [claude.status, codex.status, gitStatus],
    projects,
    activity,
  }
}
