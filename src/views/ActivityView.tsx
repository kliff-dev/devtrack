import { useMemo, useState } from 'react'
import { ActivityChart } from '../components/ActivityChart.tsx'
import { ActivityFeed } from '../components/ActivityFeed.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { Panel } from '../components/Panel.tsx'
import { ProjectAvatar } from '../components/ProjectAvatar.tsx'
import { SegmentedControl, type SegmentOption } from '../components/SegmentedControl.tsx'
import { StatCard, StatDelta } from '../components/StatCard.tsx'
import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS, SOURCE_LABELS } from '../constants.ts'
import { formatDuration, percentChange } from '../lib/format.ts'
import {
  codingMinutesByProject,
  codingMinutesBySource,
  dailyCodingTotals,
  latestFirst,
  sumMinutes,
} from '../lib/stats.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { ActivityEntry, ActivityKind, ActivitySource } from '../types.ts'
import './ActivityView.css'

type KindFilter = ActivityKind | 'all'

const PAGE_SIZE = 100

const TOOL_COLORS: Record<ActivitySource, string> = {
  'claude-code': 'var(--tool-claude-code)',
  codex: 'var(--tool-codex)',
  git: 'var(--tool-git)',
  manual: 'var(--accent)',
}

export function ActivityView() {
  const { activity, projects, projectsById, now } = useDevTrack()
  const [projectId, setProjectId] = useState('all')
  const [kind, setKind] = useState<KindFilter>('all')

  const scoped = useMemo(
    () => (projectId === 'all' ? activity : activity.filter((entry) => entry.projectId === projectId)),
    [activity, projectId],
  )
  const days = useMemo(() => dailyCodingTotals(scoped, 14, now), [scoped, now])

  const weekStart = days[days.length - 7].date
  const weekStartIso = weekStart.toISOString()
  const thisWeek = scoped.filter((entry) => entry.timestamp >= weekStartIso)
  const weekMinutes = sumMinutes(days.slice(-7))
  const weekChange = percentChange(weekMinutes, sumMinutes(days.slice(0, -7)))
  const sessionCount = thisWeek.filter((entry) => entry.kind === 'session').length
  const commitCount = thisWeek.filter((entry) => entry.kind === 'commit').length
  const shippedCount = thisWeek.filter(
    (entry) => entry.kind === 'deploy' || entry.kind === 'milestone',
  ).length

  const byProject = [...codingMinutesByProject(scoped, weekStart)]
    .map(([id, minutes]) => ({ project: projectsById.get(id), minutes }))
    .filter((row) => row.project !== undefined)
    .sort((a, b) => b.minutes - a.minutes)
  const busiestProjectMinutes = byProject[0]?.minutes ?? 0

  // Shown only once synced activity exists; the demo content is all one tool.
  const byTool = [...codingMinutesBySource(scoped, weekStart)]
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1])
  const toolTotal = byTool.reduce((total, [, minutes]) => total + minutes, 0)
  const showTools = byTool.some(([source]) => source !== 'manual')

  const kindOptions: SegmentOption<KindFilter>[] = [
    { value: 'all', label: 'All', count: scoped.length },
    ...ACTIVITY_KINDS.map((value) => ({
      value,
      label: ACTIVITY_KIND_LABELS[value],
      count: scoped.filter((entry) => entry.kind === value).length,
    })),
  ]
  const timeline = kind === 'all' ? scoped : scoped.filter((entry) => entry.kind === kind)

  return (
    <div className="page">
      <PageHeader
        title="Activity"
        description="Coding sessions, commits, reviews and releases across your projects."
        actions={
          <select
            className="select activity-project-filter"
            value={projectId}
            aria-label="Filter by project"
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        }
      />

      <section className="activity-stats" aria-label="Last 7 days">
        <StatCard
          label="Coding time"
          icon="clock"
          value={formatDuration(weekMinutes)}
          meta={
            weekChange === null ? (
              'Last 7 days'
            ) : (
              <>
                <StatDelta value={weekChange} /> vs previous 7 days
              </>
            )
          }
          footer={
            showTools && (
              <div className="tool-split">
                <div
                  className="tool-split__meter"
                  role="img"
                  aria-label={byTool
                    .map(([source, minutes]) => `${SOURCE_LABELS[source]} ${formatDuration(minutes)}`)
                    .join(', ')}
                >
                  {byTool.map(([source, minutes]) => (
                    <span
                      key={source}
                      style={{ width: `${(minutes / toolTotal) * 100}%`, background: TOOL_COLORS[source] }}
                    />
                  ))}
                </div>
                <ul className="tool-split__legend">
                  {byTool.map(([source, minutes]) => (
                    <li key={source}>
                      <span className="tool-split__dot" style={{ background: TOOL_COLORS[source] }} />
                      {SOURCE_LABELS[source]} {formatDuration(minutes)}
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
        <StatCard
          label="Sessions"
          icon="activity"
          value={String(sessionCount)}
          meta={
            sessionCount
              ? `${formatDuration(weekMinutes / sessionCount)} average · last 7 days`
              : 'Last 7 days'
          }
        />
        <StatCard label="Commits" icon="commit" value={String(commitCount)} meta="Last 7 days" />
        <StatCard
          label="Releases & milestones"
          icon="rocket"
          value={String(shippedCount)}
          meta="Last 7 days"
        />
      </section>

      <div className="activity-grid">
        <Panel title="Daily coding time" subtitle="Last 14 days">
          <ActivityChart days={days} />
        </Panel>

        <Panel title="Time by project" subtitle="Coding sessions, last 7 days">
          {byProject.length > 0 ? (
            <ul className="project-time">
              {byProject.map(({ project, minutes }) =>
                project ? (
                  <li key={project.id} className="project-time__row">
                    <ProjectAvatar project={project} size={28} />
                    <div className="project-time__body">
                      <div className="project-time__label">
                        <span>{project.name}</span>
                        <strong>{formatDuration(minutes)}</strong>
                      </div>
                      <div className="project-time__track">
                        <div
                          className="project-time__bar"
                          style={{ width: `${(minutes / busiestProjectMinutes) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <EmptyState icon="clock" title="No sessions this week" />
          )}
        </Panel>
      </div>

      <Panel
        title="Timeline"
        className="activity-timeline"
        action={
          <SegmentedControl
            label="Filter by activity type"
            options={kindOptions}
            value={kind}
            onChange={setKind}
          />
        }
      >
        {timeline.length > 0 ? (
          <Timeline key={`${projectId}|${kind}`} entries={timeline} />
        ) : (
          <EmptyState
            icon="activity"
            title="Nothing here yet"
            description="Activity matching these filters will show up here."
          />
        )}
      </Panel>
    </div>
  )
}

/** The day-grouped feed, revealed a page at a time so long histories stay snappy. */
function Timeline({ entries }: { entries: ActivityEntry[] }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const shown = useMemo(() => latestFirst(entries).slice(0, limit), [entries, limit])
  const remaining = entries.length - shown.length
  return (
    <>
      <ActivityFeed entries={shown} groupByDay />
      {remaining > 0 && (
        <button
          type="button"
          className="btn timeline__more"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, remaining)} more of {remaining}
        </button>
      )}
    </>
  )
}
