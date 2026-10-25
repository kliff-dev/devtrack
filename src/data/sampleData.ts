import type {
  ActivityEntry,
  ActivityKind,
  NextAction,
  Priority,
  Project,
  ProjectStatus,
} from '../types.ts'

// Seed content for first launch. Timestamps are relative to "now" so the
// dashboard looks lived-in whenever the sample data is created.

interface SampleProject {
  id: string
  name: string
  description: string
  status: ProjectStatus
  technologies: string[]
  progress: number
  createdDaysAgo: number
}

type When = { minutesAgo: number } | { daysAgo: number; at: string }

interface SampleActivity {
  projectId: string
  kind: ActivityKind
  summary: string
  when: When
  durationMinutes?: number
}

interface SampleAction {
  title: string
  projectId: string
  priority: Priority
  done: boolean
  createdDaysAgo: number
}

const SAMPLE_PROJECTS: SampleProject[] = [
  {
    id: 'devtrack',
    name: 'DevTrack',
    description:
      'Personal developer dashboard for tracking projects, coding time and the next thing to work on.',
    status: 'active',
    technologies: ['React', 'TypeScript', 'Vite'],
    progress: 30,
    createdDaysAgo: 3,
  },
  {
    id: 'inkwell',
    name: 'Inkwell API',
    description:
      'REST and webhook service behind a Markdown publishing platform, with scheduled posts and delivery retries.',
    status: 'active',
    technologies: ['Node.js', 'Fastify', 'PostgreSQL', 'Docker'],
    progress: 68,
    createdDaysAgo: 64,
  },
  {
    id: 'ledger',
    name: 'Pocket Ledger',
    description:
      'Offline-first budgeting app with an encrypted local database and conflict-aware sync between devices.',
    status: 'active',
    technologies: ['React Native', 'Expo', 'SQLite', 'TypeScript'],
    progress: 52,
    createdDaysAgo: 41,
  },
  {
    id: 'homelab',
    name: 'Homelab Monitor',
    description:
      'Lightweight status page and alerting for the self-hosted services running on my home server.',
    status: 'planning',
    technologies: ['Go', 'HTMX', 'Prometheus'],
    progress: 8,
    createdDaysAgo: 10,
  },
  {
    id: 'tiny-grep',
    name: 'tiny-grep',
    description:
      'A minimal grep clone written to learn Rust’s iterators, I/O model and parallel directory walking.',
    status: 'paused',
    technologies: ['Rust', 'Clap', 'Rayon'],
    progress: 45,
    createdDaysAgo: 30,
  },
  {
    id: 'portfolio',
    name: 'Portfolio v3',
    description:
      'Rebuilt personal site with MDX case studies, view transitions and a perfect Lighthouse score.',
    status: 'completed',
    technologies: ['Astro', 'MDX', 'Tailwind CSS'],
    progress: 100,
    createdDaysAgo: 75,
  },
]

const ago = (minutesAgo: number): When => ({ minutesAgo })
const on = (daysAgo: number, at: string): When => ({ daysAgo, at })

const SAMPLE_ACTIVITY: SampleActivity[] = [
  // Today
  { projectId: 'devtrack', kind: 'commit', summary: 'feat: add sidebar navigation and app shell', when: ago(20) },
  { projectId: 'devtrack', kind: 'session', summary: 'Built the layout shell and dashboard stat cards', when: ago(75), durationMinutes: 50 },
  { projectId: 'inkwell', kind: 'commit', summary: 'fix: ignore empty webhook payloads', when: ago(190) },
  { projectId: 'inkwell', kind: 'session', summary: 'Investigated duplicate webhook deliveries', when: ago(230), durationMinutes: 35 },
  // Yesterday
  { projectId: 'ledger', kind: 'commit', summary: 'feat: detect conflicting edits during sync', when: on(1, '21:50') },
  { projectId: 'ledger', kind: 'session', summary: 'Implemented conflict detection for the sync queue', when: on(1, '20:10'), durationMinutes: 90 },
  { projectId: 'devtrack', kind: 'commit', summary: 'chore: scaffold Vite + React + TypeScript', when: on(1, '14:55') },
  { projectId: 'devtrack', kind: 'session', summary: 'Sketched the data model and sample data', when: on(1, '14:00'), durationMinutes: 50 },
  // Earlier this week
  { projectId: 'inkwell', kind: 'deploy', summary: 'Deployed v0.9.0 to staging', when: on(2, '22:05') },
  { projectId: 'inkwell', kind: 'commit', summary: 'feat: retry failed webhooks with exponential backoff', when: on(2, '21:40') },
  { projectId: 'inkwell', kind: 'session', summary: 'Added webhook retries with exponential backoff', when: on(2, '19:30'), durationMinutes: 125 },
  { projectId: 'ledger', kind: 'session', summary: 'Refactored transaction list virtualization', when: on(2, '10:15'), durationMinutes: 70 },
  { projectId: 'devtrack', kind: 'session', summary: 'Prototyped dashboard layouts in the browser', when: on(3, '21:00'), durationMinutes: 120 },
  { projectId: 'devtrack', kind: 'milestone', summary: 'Started DevTrack', when: on(3, '20:45') },
  { projectId: 'inkwell', kind: 'commit', summary: 'test: cover publish endpoint edge cases', when: on(4, '19:50') },
  { projectId: 'inkwell', kind: 'session', summary: 'Wrote integration tests for the publish endpoint', when: on(4, '18:30'), durationMinutes: 75 },
  { projectId: 'inkwell', kind: 'review', summary: 'Reviewed PR #41: OpenAPI schema cleanup', when: on(4, '11:20') },
  { projectId: 'inkwell', kind: 'review', summary: 'Reviewed and merged PR #42: rate limiting middleware', when: on(5, '22:10') },
  { projectId: 'inkwell', kind: 'session', summary: 'Tuned rate limits and load-tested the API', when: on(5, '20:30'), durationMinutes: 90 },
  { projectId: 'ledger', kind: 'commit', summary: 'feat: encrypt local database at rest', when: on(5, '15:30') },
  { projectId: 'ledger', kind: 'session', summary: 'Encrypted the local database with SQLCipher', when: on(5, '13:00'), durationMinutes: 140 },
  // Last week
  { projectId: 'portfolio', kind: 'milestone', summary: 'Launched Portfolio v3', when: on(7, '18:30') },
  { projectId: 'portfolio', kind: 'deploy', summary: 'Deployed to production', when: on(7, '18:20') },
  { projectId: 'portfolio', kind: 'session', summary: 'Final polish and Lighthouse fixes before launch', when: on(7, '16:00'), durationMinutes: 120 },
  { projectId: 'portfolio', kind: 'commit', summary: 'content: add Inkwell case study', when: on(8, '20:40') },
  { projectId: 'portfolio', kind: 'session', summary: 'Wrote the Inkwell case study in MDX', when: on(8, '19:00'), durationMinutes: 95 },
  { projectId: 'homelab', kind: 'milestone', summary: 'Kicked off Homelab Monitor with a service inventory', when: on(9, '22:20') },
  { projectId: 'homelab', kind: 'session', summary: 'Researched Prometheus exporters for home services', when: on(9, '21:15'), durationMinutes: 60 },
  { projectId: 'inkwell', kind: 'session', summary: 'Designed the scheduled posts queue', when: on(9, '10:00'), durationMinutes: 90 },
  { projectId: 'ledger', kind: 'commit', summary: 'feat: budget category editor', when: on(10, '20:25') },
  { projectId: 'ledger', kind: 'session', summary: 'Built the budget category editor', when: on(10, '18:30'), durationMinutes: 110 },
  { projectId: 'tiny-grep', kind: 'commit', summary: 'perf: walk directories in parallel', when: on(12, '16:30') },
  { projectId: 'tiny-grep', kind: 'session', summary: 'Parallel directory walking with Rayon', when: on(12, '14:00'), durationMinutes: 140 },
  { projectId: 'tiny-grep', kind: 'commit', summary: 'bench: add hyperfine comparisons', when: on(13, '21:10') },
  { projectId: 'tiny-grep', kind: 'session', summary: 'Benchmarked against GNU grep', when: on(13, '20:00'), durationMinutes: 65 },
]

const SAMPLE_ACTIONS: SampleAction[] = [
  { title: 'Fix sync conflict when two devices edit the same entry', projectId: 'ledger', priority: 'high', done: false, createdDaysAgo: 1 },
  { title: 'Write migration for the webhook retry table', projectId: 'inkwell', priority: 'high', done: false, createdDaysAgo: 2 },
  { title: 'Add keyboard shortcuts for switching views', projectId: 'devtrack', priority: 'medium', done: false, createdDaysAgo: 0 },
  { title: 'Sketch status page wireframes', projectId: 'homelab', priority: 'medium', done: false, createdDaysAgo: 8 },
  { title: 'Document the data model in the README', projectId: 'devtrack', priority: 'low', done: false, createdDaysAgo: 1 },
  { title: 'Benchmark the regex engine against ripgrep', projectId: 'tiny-grep', priority: 'low', done: false, createdDaysAgo: 12 },
  { title: 'Set up CI pipeline with GitHub Actions', projectId: 'inkwell', priority: 'medium', done: true, createdDaysAgo: 6 },
  { title: 'Publish the Portfolio v3 launch post', projectId: 'portfolio', priority: 'low', done: true, createdDaysAgo: 7 },
]

// Sample ids are fixed so the demo content can be told apart from real data and removed.
export const SAMPLE_PROJECT_IDS: ReadonlySet<string> = new Set(SAMPLE_PROJECTS.map((project) => project.id))
export const isSampleActivityId = (id: string) => /^activity-\d+$/.test(id)
export const isSampleActionId = (id: string) => /^action-\d+$/.test(id)

function resolveWhen(when: When, now: Date): Date {
  if ('minutesAgo' in when) return new Date(now.getTime() - when.minutesAgo * 60_000)
  const [hours, minutes] = when.at.split(':').map(Number)
  const date = new Date(now)
  date.setDate(date.getDate() - when.daysAgo)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function daysBefore(now: Date, days: number): string {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export function createSampleData(now = new Date()) {
  const activity: ActivityEntry[] = SAMPLE_ACTIVITY.map(({ when, ...entry }, index) => ({
    id: `activity-${index + 1}`,
    ...entry,
    timestamp: resolveWhen(when, now).toISOString(),
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const projects: Project[] = SAMPLE_PROJECTS.map(({ createdDaysAgo, ...project }) => {
    const createdAt = daysBefore(now, createdDaysAgo)
    const latest = activity.find((entry) => entry.projectId === project.id)
    return { ...project, createdAt, updatedAt: latest?.timestamp ?? createdAt }
  })

  const actions: NextAction[] = SAMPLE_ACTIONS.map(({ createdDaysAgo, ...action }, index) => ({
    id: `action-${index + 1}`,
    ...action,
    createdAt: daysBefore(now, createdDaysAgo),
  }))

  return { projects, activity, actions }
}
