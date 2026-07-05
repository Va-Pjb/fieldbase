import type { StageCount, StageValue } from '@fieldbase/shared-types'
import { STAGE_LABELS, type DealStage } from '../../lib/api/deals'
import { money } from '../../lib/format'
import EmptyCard from './EmptyCard'

// Bar fill per stage — mirrors the app's canonical stage colors (StageBadge), so
// a stage reads the same everywhere. Identity is carried by the row label too,
// never by color alone.
const BAR: Record<DealStage, string> = {
  lead: 'bg-slate',
  qualified: 'bg-brand',
  proposal: 'bg-brand',
  negotiation: 'bg-signal-deep',
  won: 'bg-positive',
  lost: 'bg-danger',
}

/** The signature view: deal value per stage as a funnel of horizontal bars. */
export default function PipelineByStage({
  data,
  counts = [],
}: {
  data: StageValue[]
  counts?: StageCount[]
}) {
  if (data.length === 0) {
    return <EmptyCard>No deals yet. Add deals on the Pipeline board to see value by stage.</EmptyCard>
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  const countFor = (stage: string) => counts.find((c) => c.stage === stage)?.count

  return (
    <div className="ticket p-5 sm:p-6">
      <ul className="space-y-3">
        {data.map((d) => {
          const s = (d.stage in STAGE_LABELS ? d.stage : 'lead') as DealStage
          const n = countFor(d.stage)
          return (
            <li key={d.stage} className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-body text-small text-ink sm:w-24">
                {STAGE_LABELS[s]}
              </span>
              <span
                className="relative h-7 flex-1 overflow-hidden rounded bg-paper-sunken"
                role="img"
                aria-label={`${STAGE_LABELS[s]}: ${money(d.value)}${n != null ? `, ${n} deals` : ''}`}
              >
                <span
                  className={`absolute inset-y-0 left-0 rounded ${BAR[s]}`}
                  style={{ width: d.value > 0 ? `max(0.5rem, ${(d.value / max) * 100}%)` : 0 }}
                />
              </span>
              <span className="w-28 shrink-0 text-right font-mono text-small tabular-nums text-ink">
                {money(d.value)}
                {n != null ? <span className="text-slate"> · {n}</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
