import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { HOME, expandHome } from './paths.ts'

export interface CollectorConfig {
  /** Only activity from the last N days is collected. */
  lookbackDays: number
  /** A pause longer than this splits one tool session into two. */
  idleGapMinutes: number
  /** Folders whose immediate subfolders are checked for git repositories. */
  scanDirs: string[]
  claudeDir: string
  codexDir: string
  /** Where the sync payload is written (absolute after loading). */
  outFile: string
  /** Where parsed transcripts are cached between runs (absolute after loading). */
  cacheDir: string
}

export const CONFIG_FILE = 'devtrack.config.json'

const DEFAULTS: CollectorConfig = {
  lookbackDays: 90,
  idleGapMinutes: 30,
  scanDirs: [join(HOME, 'Projects')],
  claudeDir: process.env.CLAUDE_CONFIG_DIR ?? join(HOME, '.claude'),
  codexDir: process.env.CODEX_HOME ?? join(HOME, '.codex'),
  outFile: 'public/data/sync.json',
  cacheDir: 'node_modules/.cache/devtrack',
}

function readConfigFile(root: string): Partial<CollectorConfig> {
  const file = join(root, CONFIG_FILE)
  if (!existsSync(file)) return {}
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object') throw new Error(`${CONFIG_FILE} must contain an object`)
  const raw = parsed as Record<string, unknown>
  const config: Partial<CollectorConfig> = {}
  if (typeof raw.lookbackDays === 'number') config.lookbackDays = raw.lookbackDays
  if (typeof raw.idleGapMinutes === 'number') config.idleGapMinutes = raw.idleGapMinutes
  if (Array.isArray(raw.scanDirs)) config.scanDirs = raw.scanDirs.filter((d) => typeof d === 'string')
  if (typeof raw.claudeDir === 'string') config.claudeDir = raw.claudeDir
  if (typeof raw.codexDir === 'string') config.codexDir = raw.codexDir
  if (typeof raw.outFile === 'string') config.outFile = raw.outFile
  if (typeof raw.cacheDir === 'string') config.cacheDir = raw.cacheDir
  return config
}

/** Defaults, overridden by devtrack.config.json, overridden by CLI flags. Paths come back absolute. */
export function loadConfig(root: string, overrides: Partial<CollectorConfig> = {}): CollectorConfig {
  const config = { ...DEFAULTS, ...readConfigFile(root), ...overrides }
  return {
    ...config,
    scanDirs: config.scanDirs.map(expandHome),
    claudeDir: expandHome(config.claudeDir),
    codexDir: expandHome(config.codexDir),
    outFile: resolve(root, expandHome(config.outFile)),
    cacheDir: resolve(root, expandHome(config.cacheDir)),
  }
}
