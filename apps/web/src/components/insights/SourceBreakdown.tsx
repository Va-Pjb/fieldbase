import type { SourceCount } from '@fieldbase/shared-types'
import EmptyCard from './EmptyCard'

/** Contacts grouped by lead source — a single-series count breakdown. */
export default function SourceBreakdown({ data }: { data: SourceCount[] }) {
  if (data.length === 0) return <EmptyCard>No contacts yet.</EmptyCard>
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="ticket p-5 sm:p-6">
      <ul className="space-y-3">
        {data.map((d) => {
          const label = d.source === '—' ? 'Unknown' : d.source
          return (
            <li key={d.source} className="flex items-center gap-3">
              <span
                className="w-20 shrink-0 truncate font-body text-small capitalize text-ink sm:w-24"
                title={label}
              >
                {label}
              </span>
              <span className="relative h-6 flex-1 overflow-hidden rounded bg-paper-sunken">
                <span
                  className="absolute inset-y-0 left-0 rounded bg-ink-soft"
                  style={{ width: `max(0.5rem, ${(d.count / max) * 100}%)` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-small tabular-nums text-ink">
                {d.count}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
