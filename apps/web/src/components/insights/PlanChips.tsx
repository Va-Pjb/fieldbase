import type { ReactNode } from 'react'
import type { InsightPlan } from '@fieldbase/shared-types'

const OP: Record<string, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  contains: '∋',
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-line bg-paper-sunken px-2 py-1 font-mono text-label text-ink">
      {children}
    </span>
  )
}

/** Show how the question was interpreted — the same transparency crm_query gives. */
export default function PlanChips({ plan, count }: { plan: InsightPlan; count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-body text-label uppercase tracking-wide text-slate">Reading as</span>
      <Chip>{plan.entity}</Chip>
      {plan.filters.map((f, i) => (
        <Chip key={i}>
          {f.field} {OP[f.op] ?? f.op} {String(f.value)}
        </Chip>
      ))}
      {plan.aggregate ? (
        <Chip>
          {plan.aggregate.op}
          {plan.aggregate.field ? `(${plan.aggregate.field})` : ''}
          {plan.aggregate.groupBy ? ` by ${plan.aggregate.groupBy}` : ''}
        </Chip>
      ) : null}
      {plan.sort ? (
        <Chip>
          sort {plan.sort.field} {plan.sort.direction === 'asc' ? '↑' : '↓'}
        </Chip>
      ) : null}
      <span className="font-body text-small text-slate">
        · {count} {count === 1 ? 'match' : 'matches'}
      </span>
    </div>
  )
}
