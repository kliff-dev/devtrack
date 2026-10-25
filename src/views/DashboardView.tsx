import { useMemo, useState } from 'react'
import { ActivityChart } from '../components/ActivityChart.tsx'
import { ActivityFeed } from '../components/ActivityFeed.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { Icon } from '../components/Icon.tsx'
import { NextActions } from '../components/NextActions.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { Panel } from '../components/Panel.tsx'
import { ProgressBar } from '../components/ProgressBar.tsx'
import { ProjectAvatar } from '../components/ProjectAvatar.tsx'
import { ProjectFormDialog } from '../components/ProjectFormDialog.tsx'
import { StatCard, StatDelta } from '../components/StatCard.tsx'
import { SyncButton } from '../components/SyncButton.tsx'
import { PRIORITIES, PRIORITY_LABELS } from '../constants.ts'
import { viewHref } from '../hooks/useHashRoute.ts'
import {
  formatDayLabel,
  formatDuration,
  formatLongDate,
  greeting,
  percentChange,
} from '../lib/format.ts'
import {
  codingMinutesByProject,
  currentStreak,
  dailyCodingTotals,
  latestFirst,
  longestStreak,
  sumMinutes,
} from '../lib/stats.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { Project } from '../types.ts'
import './DashboardView.css'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export function DashboardView() {
  const { now, projects, activity, actions, settings } = useDevTrack()
  const [creating, setCreating] = useState(false)

  const days = useMemo(() => dailyCodingTotals(activity, 14, now), [activity, now])
  const thisWeek = days.slice(-7)
  const weekMinutes = sumMinutes(thisWeek)
  const weekChange = percentChange(weekMinutes, sumMinutes(days.slice(0, -7)))
  const goalPercent = (weekMinutes / (settings.weeklyGoalHours * 60)) * 100
  const streak = currentStreak(activity, now)
  const bestStreak = longestStreak(activity)
  const codedDays = thisWeek.filter((day) => day.minutes > 0).length
  const minutesByProject = codingMinutesByProject(activity, thisWeek[0].date)

  const activeProjects = projects
    .filter((project) => project.status === 'active')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const averageProgress = activeProjects.length
    ? Math.round(
        activeProjects.reduce((total, project) => total + project.progress, 0) /
          activeProjects.length,
      )
    : 0
  const openActions = actions.filter((action) => !action.done)
  const highPriority = openActions.filter((action) => action.priority === 'high').length
  const recentActivity = latestFirst(activity).slice(0, 6)
  const name = settings.displayName.trim()

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatLongDate(now)}
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        description="Here’s where your projects stand today."
        actions={
          <>
            <SyncButton />
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Icon name="plus" />
              New project
            </button>
          </>
        }
      />

      <section className="stat-grid" aria-label="Summary">
        <StatCard
          label="Active projects"
          icon="folder"
          value={String(activeProjects.length)}
          meta={`of ${plural(projects.length, 'project')}`}
          footer={
            activeProjects.length > 0 ? (
              <>
                <ProgressBar value={averageProgress} label="Average progress of active projects" />
                <span>{averageProgress}% avg. progress</span>
              </>
            ) : (
              <span>Nothing in progress</span>
            )
          }
        />
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
            <>
              <ProgressBar value={goalPercent} label="Weekly goal progress" />
              <span>
                {Math.round(goalPercent)}% of {settings.weeklyGoalHours}h goal
              </span>
            </>
          }
        />
        <StatCard
          label="Current streak"
          icon="flame"
          value={plural(streak, 'day')}
          meta={
            streak > 0 && streak >= bestStreak
              ? 'Your longest streak so far'
              : `Longest: ${plural(bestStreak, 'day')}`
          }
          footer={
            <>
              <div
                className="week-cells"
                role="img"
                aria-label={`Coded on ${codedDays} of the last 7 days`}
              >
                {thisWeek.map((day) => (
                  <span
                    key={day.key}
                    data-filled={day.minutes > 0 || undefined}
                    title={`${formatDayLabel(day.date)}: ${day.minutes ? formatDuration(day.minutes) : 'no coding'}`}
                  />
                ))}
              </div>
              <span>{codedDays}/7 days</span>
            </>
          }
        />
        <StatCard
          label="Open actions"
          icon="listChecks"
          value={String(openActions.length)}
          meta={`${highPriority} high priority`}
          footer={
            <ul className="stat-legend">
              {PRIORITIES.map((priority) => (
                <li key={priority} data-priority={priority}>
                  {openActions.filter((action) => action.priority === priority).length}{' '}
                  {PRIORITY_LABELS[priority].toLowerCase()}
                </li>
              ))}
            </ul>
          }
        />
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid__column">
          <Panel
            title="Coding activity"
            subtitle={`${formatDuration(sumMinutes(days))} in coding sessions over the last 14 days`}
            action={
              <a className="btn btn--ghost btn--sm" href={viewHref('activity')}>
                Details
                <Icon name="arrowRight" size={14} />
              </a>
            }
          >
            <ActivityChart days={days} />
          </Panel>

          <Panel
            title="Active projects"
            subtitle="Progress and time spent this week"
            action={
              <a className="btn btn--ghost btn--sm" href={viewHref('projects')}>
                All projects
                <Icon name="arrowRight" size={14} />
              </a>
            }
          >
            {activeProjects.length > 0 ? (
              <ul className="active-projects">
                {activeProjects.map((project) => (
                  <ActiveProjectRow
                    key={project.id}
                    project={project}
                    weekMinutes={minutesByProject.get(project.id) ?? 0}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="folder"
                title="No active projects"
                description="Projects marked as active show up here with their progress."
                action={
                  <button type="button" className="btn" onClick={() => setCreating(true)}>
                    <Icon name="plus" />
                    New project
                  </button>
                }
              />
            )}
          </Panel>
        </div>

        <div className="dashboard-grid__column">
          <Panel
            title="Next actions"
            subtitle={`${plural(openActions.length, 'open item')}`}
          >
            <NextActions />
          </Panel>

          <Panel
            title="Recent activity"
            action={
              <a className="btn btn--ghost btn--sm" href={viewHref('activity')}>
                View all
                <Icon name="arrowRight" size={14} />
              </a>
            }
          >
            {recentActivity.length > 0 ? (
              <ActivityFeed entries={recentActivity} />
            ) : (
              <EmptyState
                icon="activity"
                title="No activity yet"
                description="Coding sessions, commits and releases will appear here."
              />
            )}
          </Panel>
        </div>
      </div>

      {creating && <ProjectFormDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

function ActiveProjectRow({ project, weekMinutes }: { project: Project; weekMinutes: number }) {
  return (
    <li className="active-project">
      <ProjectAvatar project={project} size={36} />
      <div className="active-project__info">
        <p className="active-project__name">{project.name}</p>
        <p className="active-project__tech">{project.technologies.slice(0, 3).join(' · ')}</p>
      </div>
      <div className="active-project__progress">
        <ProgressBar value={project.progress} label={`${project.name} progress`} />
        <span>{project.progress}%</span>
      </div>
      <div className="active-project__time">
        <strong>{weekMinutes > 0 ? formatDuration(weekMinutes) : '—'}</strong>
        <span>this week</span>
      </div>
    </li>
  )
}
