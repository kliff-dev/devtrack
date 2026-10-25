# DevTrack

A personal developer dashboard that tracks your projects, coding activity and next actions. Activity is read from the tools you actually code with, Claude Code and Codex, plus git. Built with React, TypeScript and Vite; the only runtime dependencies are React and React DOM.

## Getting started

```sh
npm install
npm run dev      # http://localhost:5173 — also syncs activity on start
npm run sync     # gather activity into public/data/sync.json
npm run build    # type-check + production build
npm run lint     # oxlint
```

On first launch with no synced activity, DevTrack seeds sample projects so the interface looks complete; **Settings → Data** can remove or restore them. With a sync file present it starts from your real projects instead. Everything the app holds is saved to `localStorage`.

## How activity gets in

`npm run sync` runs the collector (`collector/`), a dependency-free Node script that reads this machine and writes `public/data/sync.json`. The app loads that file on start and merges it into your projects by folder.

| Source | What is read | Becomes |
|---|---|---|
| **Claude Code** | `~/.claude/projects/*/*.jsonl` transcripts (top-level files only; subagent transcripts overlap their parent) | sessions, titled with the session's AI title |
| **Codex** | the Codex app's SQLite thread index in `~/.codex` (`state_N.sqlite`, `thread_history_N.sqlite`), opened read-only | sessions, titled with the thread name or first prompt |
| **git** | `git log` in every folder above plus the repositories under `scanDirs`, filtered to your configured `user.email` | commits |

Sessions come from the message timestamps: a pause longer than `idleGapMinutes` splits a thread into separate sessions, so a chat left open overnight doesn't count as a 14-hour session. Overlapping sessions (both tools on one project at once) count once in the daily totals.

Each session or commit is attributed to the nearest enclosing git repository, or the working directory itself. Folders the app hasn't seen become new projects, named after the folder, with technologies guessed from `package.json` and marker files. Projects you create by hand can claim a folder through **Local folder** in the project form. Deleting a folder-linked project puts that folder on an ignore list (**Settings → Activity sources**) so the next sync doesn't bring it back.

Under `npm run dev`, **Sync now** on the dashboard and in Settings re-runs the collector through the dev server. A production build has no server, so run `npm run sync` and reload.

### Configuration

`devtrack.config.json` at the project root (all keys optional):

```json
{
  "lookbackDays": 90,
  "idleGapMinutes": 30,
  "scanDirs": ["~/Projects", "C:\\wamp64\\www"],
  "claudeDir": "~/.claude",
  "codexDir": "~/.codex"
}
```

`CLAUDE_CONFIG_DIR` and `CODEX_HOME` are honoured when set. `npm run sync -- --days 30` and `--idle 45` override the file for one run. Parsed Claude Code transcripts are cached in `node_modules/.cache/devtrack/`; the cache is keyed by file size and modification time, so only changed transcripts are re-read.

## Features

- **Dashboard:** summary stats (active projects, coding time against a weekly goal, streak, open actions), a 14-day coding chart, active projects with progress and time this week, a next-actions checklist and recent activity.
- **Projects:** searchable, filterable, sortable project cards with status, technologies, progress and linked folder. Projects can be created, edited and deleted.
- **Activity:** 7-day stats with a time-by-tool split, the daily chart, time per project and a day-grouped timeline filtered by project and type, with each entry badged by its source.
- **Settings:** display name, weekly goal, accent color, source status, sync, ignored folders and data management (export, remove or restore samples, clear).

The layout is responsive; below 960px the sidebar becomes a slide-out drawer.

## Project structure

```
collector/             Node script run by `npm run sync` (TypeScript, executed directly by Node 24)
  cli.ts               Entry point: flags, config, writes the sync file
  index.ts             Runs the sources, attributes entries to project roots, builds the payload
  claudeCode.ts        Transcript parser          codex.ts   SQLite reader       git.ts   git log
  sessions.ts          Idle-gap session splitting and prompt cleaning
  projects.ts          Folder name, technologies, repository URL
src/
  App.tsx              App shell: sidebar, mobile top bar, current view
  types.ts             Domain types and the sync payload contract shared with the collector
  constants.ts         Labels, option lists and default settings
  data/sampleData.ts   First-launch demo content (timestamps relative to now)
  store/               DevTrackProvider: app state, sync merging, exposed through useDevTrack()
  hooks/               useLocalStorage, useHashRoute (#/projects style routing), useNow
  lib/                 Pure helpers: formatting, stats, storage, validation, sync merging
  components/          Reusable UI, each with a colocated .css file
  views/               Dashboard, Projects, Activity and Settings pages
vite.config.ts         Dev-server plugin that runs the collector on start and on POST /api/sync
```

Styling is plain CSS with custom properties. Design tokens and shared primitives (buttons, inputs, panels) live in `src/index.css`.

## Data and storage

State is stored under `devtrack:v1:*` keys (`projects`, `activity`, `actions`, `settings`, `ignoredPaths`). Stored values are validated when loaded; anything malformed falls back to the defaults instead of crashing the app.

Activity entries have a `kind` (`session`, `commit`, `deploy`, `review`, `milestone`) and a `source` (`claude-code`, `codex`, `git`, or none for entries added by hand). The sync file is authoritative for synced entries: each sync replaces them by id, while manual entries, projects, actions and settings are always kept. Resetting or clearing data therefore keeps synced activity too; it mirrors files on disk and would return on the next sync.

AI features (session summaries, suggested next actions) are the next step and are intentionally not built yet.
