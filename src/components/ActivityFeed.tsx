import type { CSSProperties } from 'react'
import { SOURCE_LABELS } from '../constants.ts'
import { projectColor } from '../lib/colors.ts'
import { formatDayHeading, formatDuration, formatRelative, formatTime } from '../lib/format.ts'
import { groupByDay, latestFirst } from '../lib/stats.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { ActivityEntry, ActivityKind, Project } from '../types.ts'
import { Icon, type IconName } from './Icon.tsx'
import './ActivityFeed.css'

const KIND_ICONS: Record<ActivityKind, IconName> = {
  session: 'clock',
  commit: 'commit',
  deploy: 'rocket',
  review: 'eye',
  milestone: 'flag',
}

interface ActivityFeedProps {
  entries: ActivityEntry[]
  /** Group under day headings and show clock times instead of relative times. */
  groupByDay?: boolean
}

export function ActivityFeed({ entries, groupByDay: grouped = false }: ActivityFeedProps) {
  const { projectsById, now } = useDevTrack()

  if (!grouped) {
    return (
      <ol className="activity-list">
        {latestFirst(entries).map((entry) => (
          <ActivityItem
            key={entry.id}
            entry={entry}
            project={projectsById.get(entry.projectId)}
            time={formatRelative(entry.timestamp, now)}
          />
        ))}
      </ol>
    )
  }

  return (
    <div className="activity-groups">
      {groupByDay(entries).map((group) => (
        <section key={group.key} className="activity-group">
          <header className="activity-group__header">
            <h3>{formatDayHeading(group.date, now)}</h3>
            {group.minutes > 0 && <span>{formatDuration(group.minutes)} coded</span>}
          </header>
          <ol className="activity-list">
            {group.entries.map((entry) => (
              <ActivityItem
                key={entry.id}
                entry={entry}
                project={projectsById.get(entry.projectId)}
                time={formatTime(entry.timestamp)}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

interface ActivityItemProps {
  entry: ActivityEntry
  project?: Project
  time: string
}

function ActivityItem({ entry, project, time }: ActivityItemProps) {
  return (
    <li className="activity-item" data-kind={entry.kind}>
      <span className="activity-item__icon">
        <Icon name={KIND_ICONS[entry.kind]} size={15} />
      </span>
      <div className="activity-item__body">
        <p className="activity-item__summary">{entry.summary}</p>
        <p className="activity-item__meta">
          {project && (
            <span
              className="activity-item__project"
              style={{ '--project-color': projectColor(project.id) } as CSSProperties}
            >
              {project.name}
            </span>
          )}
          <time dateTime={entry.timestamp}>{time}</time>
          {entry.durationMinutes ? <span>{formatDuration(entry.durationMinutes)}</span> : null}
          {entry.source && entry.source !== 'manual' && (
            <span className="source-badge" data-source={entry.source}>
              {SOURCE_LABELS[entry.source]}
            </span>
          )}
        </p>
      </div>
    </li>
  )
}
