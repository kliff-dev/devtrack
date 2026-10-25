import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const LONG_PATH_UNC = '\\\\?\\UNC\\'
const LONG_PATH = '\\\\?\\'

export const HOME = homedir()

/** Codex records working directories with Windows' long-path prefix (\\?\C:\...). */
export function stripLongPathPrefix(path: string): string {
  if (path.startsWith(LONG_PATH_UNC)) return '\\\\' + path.slice(LONG_PATH_UNC.length)
  if (path.startsWith(LONG_PATH)) return path.slice(LONG_PATH.length)
  return path
}

/** Absolute path as shown to the user: native separators, upper-case drive letter, no trailing separator. */
export function displayPath(path: string): string {
  const resolved = resolve(stripLongPathPrefix(path.trim())).replace(/[\\/]+$/, '')
  return resolved.replace(/^[a-z]:/, (drive) => drive.toUpperCase())
}

/** Key for comparing paths; Claude Code alternates `c:\` and `C:\` within one session. */
export function pathKey(path: string): string {
  return displayPath(path).toLowerCase()
}

export function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/') || path.startsWith('~\\')
    ? join(HOME, path.slice(1))
    : path
}

export function isGitRoot(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

/**
 * The folder a working directory belongs to: the nearest ancestor that is a git
 * repository, or the directory itself. Never climbs to the home directory, so a
 * session run from ~ doesn't swallow every project.
 */
export function findProjectRoot(dir: string): string {
  const start = displayPath(dir)
  const homeKey = pathKey(HOME)
  let current = start
  while (pathKey(current) !== homeKey) {
    if (isGitRoot(current)) return current
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return start
}
