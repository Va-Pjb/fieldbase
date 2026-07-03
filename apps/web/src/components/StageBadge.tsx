import { STAGE_LABELS, type DealStage } from '../lib/api/deals'

const STYLES: Record<DealStage, string> = {
  lead: 'bg-paper-sunken text-slate',
  qualified: 'bg-brand/10 text-brand',
  proposal: 'bg-brand/10 text-brand',
  negotiation: 'bg-signal-deep/20 text-ink',
  won: 'bg-positive/15 text-positive',
  lost: 'bg-danger/10 text-danger',
}

export default function StageBadge({ stage }: { stage: string }) {
  const s = (stage in STAGE_LABELS ? stage : 'lead') as DealStage
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-label uppercase ${STYLES[s]}`}>
      {STAGE_LABELS[s]}
    </span>
  )
}
