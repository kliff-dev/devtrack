// Gathers coding activity from Claude Code, Codex and git into public/data/sync.json.
//   npm run sync            write the file and print a summary
//   npm run sync -- --json  also print the payload to stdout (used by the Vite dev server)
//   --days N  --idle N      override the lookback window / idle gap for this run
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SyncPayload } from '../src/types.ts'
import { loadConfig, type CollectorConfig } from './config.ts'
import { runCollector } from './index.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv: string[]): { json: boolean; overrides: Partial<CollectorConfig> } {
  const overrides: Partial<CollectorConfig> = {}
  let json = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} needs a value`)
      index += 1
      return value
    }
    if (arg === '--json') json = true
    else if (arg === '--days') overrides.lookbackDays = Number(next())
    else if (arg === '--idle') overrides.idleGapMinutes = Number(next())
    else if (arg === '--out') overrides.outFile = next()
    else throw new Error(`Unknown option ${arg}`)
  }
  return { json, overrides }
}

function summary(payload: SyncPayload, outFile: string): string {
  const lines = [`DevTrack sync · ${new Date(payload.syncedAt).toLocaleString()}`]
  for (const source of payload.sources) {
    const label = { 'claude-code': 'Claude Code', codex: 'Codex', git: 'git' }[source.source].padEnd(12)
    const count =
      source.source === 'git'
        ? `${source.commits ?? 0} commits`
        : `${source.sessions ?? 0} sessions`
    lines.push(source.available ? `  ${label} ${count}  (${source.note ?? ''})` : `  ${label} unavailable: ${source.note}`)
  }
  lines.push(`  Projects     ${payload.projects.length} folders with activity`)
  lines.push(`  → ${outFile}  (${payload.activity.length} entries, last ${payload.lookbackDays} days)`)
  return lines.join('\n')
}

try {
  const { json, overrides } = parseArgs(process.argv.slice(2))
  const config = loadConfig(root, overrides)
  const payload = await runCollector(config)
  mkdirSync(dirname(config.outFile), { recursive: true })
  writeFileSync(config.outFile, JSON.stringify(payload, null, 2))
  const report = summary(payload, relative(root, config.outFile))
  if (json) {
    console.error(report)
    process.stdout.write(JSON.stringify(payload))
  } else {
    console.log(report)
  }
} catch (error) {
  console.error(`devtrack sync failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
