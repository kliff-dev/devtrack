import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { SyncProject } from '../src/types.ts'
import { gitOriginUrl } from './git.ts'
import { isGitRoot } from './paths.ts'

const MAX_TECHNOLOGIES = 5

// Recognised npm dependencies, most specific first so "React Native" wins over "React".
const PACKAGE_TECH: [dependency: string, label: string][] = [
  ['react-native', 'React Native'],
  ['expo', 'Expo'],
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['@angular/core', 'Angular'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
  ['astro', 'Astro'],
  ['react', 'React'],
  ['electron', 'Electron'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['hono', 'Hono'],
  ['vite', 'Vite'],
  ['typescript', 'TypeScript'],
  ['tailwindcss', 'Tailwind CSS'],
  ['prisma', 'Prisma'],
  ['@supabase/supabase-js', 'Supabase'],
  ['firebase', 'Firebase'],
  ['three', 'Three.js'],
  ['phaser', 'Phaser'],
]

const MARKER_FILES: [file: string, label: string][] = [
  ['Cargo.toml', 'Rust'],
  ['go.mod', 'Go'],
  ['pyproject.toml', 'Python'],
  ['requirements.txt', 'Python'],
  ['Pipfile', 'Python'],
  ['Gemfile', 'Ruby'],
  ['composer.json', 'PHP'],
  ['pom.xml', 'Java'],
  ['build.gradle', 'Java'],
  ['build.gradle.kts', 'Kotlin'],
  ['pubspec.yaml', 'Flutter'],
  ['CMakeLists.txt', 'C++'],
  ['mix.exs', 'Elixir'],
]

// Plain projects without a manifest (e.g. a PHP site under wamp): judge by top-level files.
const EXTENSION_TECH: Record<string, string> = {
  '.php': 'PHP',
  '.py': 'Python',
  '.html': 'HTML',
  '.css': 'CSS',
  '.js': 'JavaScript',
  '.ts': 'TypeScript',
  '.cs': 'C#',
  '.csproj': 'C#',
  '.sln': 'C#',
}

interface PackageJson {
  description?: unknown
  dependencies?: Record<string, unknown>
  devDependencies?: Record<string, unknown>
}

function readPackageJson(dir: string): PackageJson | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as PackageJson) : undefined
  } catch {
    return undefined
  }
}

function detectTechnologies(pkg: PackageJson | undefined, files: string[]): string[] {
  const found: string[] = []
  const add = (label: string) => {
    if (!found.includes(label)) found.push(label)
  }

  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const [dependency, label] of PACKAGE_TECH) if (dependency in deps) add(label)
    if (!('typescript' in deps) && files.includes('tsconfig.json')) add('TypeScript')
    if (found.length === 0) add('Node.js')
  }
  for (const [file, label] of MARKER_FILES) if (files.includes(file)) add(label)

  if (found.length === 0) {
    const counts = new Map<string, number>()
    for (const file of files) {
      const label = EXTENSION_TECH[extname(file).toLowerCase()]
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    for (const [label] of [...counts].sort((a, b) => b[1] - a[1])) add(label)
  }
  return found.slice(0, MAX_TECHNOLOGIES)
}

export async function describeProject(path: string): Promise<SyncProject> {
  const exists = existsSync(path)
  const files = exists ? safeReaddir(path) : []
  const pkg = exists ? readPackageJson(path) : undefined
  const description =
    typeof pkg?.description === 'string' && pkg.description.trim()
      ? pkg.description.trim().slice(0, 200)
      : undefined
  return {
    path,
    name: basename(path) || path,
    description,
    technologies: exists ? detectTechnologies(pkg, files) : [],
    repoUrl: exists && isGitRoot(path) ? await gitOriginUrl(path) : undefined,
    exists,
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
