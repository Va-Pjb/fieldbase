import type { ReactNode } from 'react'
import type { AggregateResult, InsightAskResult, InsightEntity } from '@fieldbase/shared-types'
import { dateTime, money } from '../../lib/format'
import StageBadge from '../StageBadge'
import EmptyCard from './EmptyCard'

/** Format an aggregate number for its op + field (money for value, % for probability). */
function fmtValue(op: string, field: string | undefined, n: number): string {
  if (op === 'count') return n.toLocaleString('en-AU')
  if (field === 'value') return money(n)
  if (field === 'probability') return `${Math.round(n)}%`
  return n.toLocaleString('en-AU')
}

const OP_NAMES: Record<string, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
}
function aggLabel(a: AggregateResult): string {
  const opName = OP_NAMES[a.op] ?? a.op
  const field = a.op !== 'count' && a.field ? ` of ${a.field}` : ''
  const group = a.groupBy ? ` by ${a.groupBy}` : ''
  return `${opName}${field}${group}`
}

type Col = { key: string; header: string; render: (r: Record<string, unknown>) => ReactNode }
const COLUMNS: Record<InsightEntity, Col[]> = {
  deals: [
    { key: 'title', header: 'Deal', render: (r) => String(r.title ?? '—') },
    { key: 'stage', header: 'Stage', render: (r) => <StageBadge stage={String(r.stage ?? 'lead')} /> },
    { key: 'value', header: 'Value', render: (r) => money(r.value as number | null) },
  ],
  contacts: [
    { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
    { key: 'company', header: 'Company', render: (r) => (r.company ? String(r.company) : '—') },
    { key: 'source', header: 'Source', render: (r) => (r.source ? String(r.source) : '—') },
  ],
  interactions: [
    { key: 'type', header: 'Type', render: (r) => String(r.type ?? '—') },
    { key: 'occurred_at', header: 'When', render: (r) => dateTime(r.occurred_at as string) },
  ],
  appointments: [
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
    { key: 'start_time', header: 'Start', render: (r) => dateTime(r.start_time as string) },
    { key: 'end_time', header: 'End', render: (r) => dateTime(r.end_time as string) },
  ],
}

/** Render an answer: a headline figure, a grouped mini-bar, or a rows table. */
export default function QueryResult({ result }: { result: InsightAskResult }) {
  const { plan, aggregate, results } = result

  if (aggregate) {
    if (aggregate.groups.length > 0) {
      const max = Math.max(...aggregate.groups.map((g) => g.value), 1)
      return (
        <div className="ticket p-5 sm:p-6">
          <p className="mb-4 font-body text-label uppercase tracking-wide text-slate">
            {aggLabel(aggregate)}
          </p>
          <ul className="space-y-3">
            {aggregate.groups.map((g) => (
              <li key={g.key} className="flex items-center gap-3">
                <span
                  className="w-24 shrink-0 truncate font-body text-small capitalize text-ink"
                  title={g.key}
                >
                  {g.key === '—' ? 'Unknown' : g.key}
                </span>
                <span className="relative h-6 flex-1 overflow-hidden rounded bg-paper-sunken">
                  <span
                    className="absolute inset-y-0 left-0 rounded bg-brand"
                    style={{ width: `max(0.5rem, ${(g.value / max) * 100}%)` }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right font-mono text-small tabular-nums text-ink">
                  {fmtValue(aggregate.op, aggregate.field, g.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    return (
      <div className="ticket p-6">
        <p className="font-body text-label uppercase tracking-wide text-slate">{aggLabel(aggregate)}</p>
        <p className="mt-2 font-mono text-display tabular-nums text-ink">
          {fmtValue(aggregate.op, aggregate.field, aggregate.scalar ?? 0)}
        </p>
      </div>
    )
  }

  const rows = results ?? []
  if (rows.length === 0) return <EmptyCard>No matching records.</EmptyCard>
  const cols = COLUMNS[plan.entity]

  return (
    <div className="ticket overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line">
            {cols.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-4 py-3 font-body text-label uppercase tracking-wide text-slate"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {cols.map((c) => (
                <td key={c.key} className="px-4 py-3 font-body text-small text-ink">
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
