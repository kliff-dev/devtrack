import { useState, type CSSProperties, type PointerEvent } from 'react'
import { formatDayLabel, formatDuration, formatWeekdayNarrow } from '../lib/format.ts'
import type { DayTotal } from '../lib/stats.ts'
import './ActivityChart.css'

interface ActivityChartProps {
  days: DayTotal[]
}

/** A clean hour-based y-axis that fits the busiest day. */
function hourScale(maxMinutes: number) {
  const hours = Math.max(1, Math.ceil(maxMinutes / 60))
  const step = hours > 8 ? 4 : hours > 4 ? 2 : 1
  const top = Math.ceil(hours / step) * step
  const ticks: number[] = []
  for (let tick = 0; tick <= top; tick += step) ticks.push(tick)
  return { topMinutes: top * 60, ticks }
}

/** Daily coding time as columns, with a tooltip per day on hover or focus. */
export function ActivityChart({ days }: ActivityChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const maxMinutes = Math.max(0, ...days.map((day) => day.minutes))
  const { topMinutes, ticks } = hourScale(maxMinutes)
  const peakIndex = maxMinutes > 0 ? days.findIndex((day) => day.minutes === maxMinutes) : -1
  const lastIndex = days.length - 1
  const percentOf = (minutes: number) => (minutes / topMinutes) * 100

  // Touch taps go through focus/blur instead, so the tooltip doesn't flash and vanish.
  const whenMouse = (handler: () => void) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') handler()
  }

  return (
    <figure className="activity-chart" style={{ '--columns': days.length } as CSSProperties}>
      <figcaption className="sr-only">
        Coding time per day over the last {days.length} days
      </figcaption>
      <div className="activity-chart__plot">
        {ticks.map((hours) => (
          <div
            key={hours}
            className="activity-chart__gridline"
            style={{ bottom: `${percentOf(hours * 60)}%` }}
            aria-hidden="true"
          >
            <span className="activity-chart__tick">{hours === 0 ? '0' : `${hours}h`}</span>
          </div>
        ))}

        {maxMinutes === 0 && (
          <p className="activity-chart__empty">No coding sessions in this period</p>
        )}

        <div className="activity-chart__columns">
          {days.map((day, index) => {
            const isActive = activeIndex === index
            const value = day.minutes > 0 ? formatDuration(day.minutes) : 'No coding'
            const align = index < 2 ? 'start' : index > lastIndex - 2 ? 'end' : undefined
            return (
              <div
                key={day.key}
                className="activity-chart__column"
                data-active={isActive || undefined}
                data-align={align}
                role="img"
                tabIndex={0}
                aria-label={`${formatDayLabel(day.date)}: ${value}`}
                onPointerEnter={whenMouse(() => setActiveIndex(index))}
                onPointerLeave={whenMouse(() => setActiveIndex(null))}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              >
                {day.minutes > 0 && (
                  <div className="activity-chart__bar" style={{ height: `${percentOf(day.minutes)}%` }}>
                    {index === peakIndex && !isActive && (
                      <span className="activity-chart__peak">{value}</span>
                    )}
                  </div>
                )}
                {isActive && (
                  <div
                    className="activity-chart__tooltip"
                    style={{ bottom: `calc(${percentOf(day.minutes)}% + 10px)` }}
                    aria-hidden="true"
                  >
                    <strong>{value}</strong>
                    <span>{formatDayLabel(day.date)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="activity-chart__axis" aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.key} data-today={index === lastIndex || undefined}>
            {index === lastIndex ? 'Today' : formatWeekdayNarrow(day.date)}
          </span>
        ))}
      </div>
    </figure>
  )
}
