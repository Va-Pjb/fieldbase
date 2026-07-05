import type { MonthCount } from '@fieldbase/shared-types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(m: string): string {
  const n = Number(m.split('-')[1])
  return MONTHS[n - 1] ?? m
}

/** New contacts per month over the last six months — a small column sparkline. */
export default function TrendSparkline({ data }: { data: MonthCount[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="ticket p-5 sm:p-6">
      <div className="flex items-end justify-between gap-2" style={{ height: 96 }}>
        {data.map((d) => (
          <div
            key={d.month}
            className="flex flex-1 flex-col items-center justify-end gap-2"
            title={`${monthLabel(d.month)}: ${d.count}`}
          >
            <span className="font-mono text-label tabular-nums text-slate">{d.count || ''}</span>
            <span
              className="w-full rounded-t bg-brand"
              style={{ height: `max(2px, ${(d.count / max) * 68}px)` }}
              aria-hidden
            />
            <span className="font-body text-label uppercase text-slate">{monthLabel(d.month)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 font-body text-small text-slate">{total} new in the last 6 months</p>
    </div>
  )
}
