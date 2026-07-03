import { STAGE_LABELS, type Deal, type DealStage } from '../../lib/api/deals'
import { money } from '../../lib/format'
import DealCard from './DealCard'

export default function Column({
  stage,
  deals,
  contactNames,
}: {
  stage: DealStage
  deals: Deal[]
  contactNames: Record<string, string>
}) {
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-card border border-line bg-paper-sunken/40">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="font-display text-heading text-ink">{STAGE_LABELS[stage]}</h2>
        <span className="font-mono text-small text-slate">{deals.length}</span>
      </header>
      <p className="border-b border-line px-3 py-1.5 font-mono text-label uppercase text-slate">
        {money(total)}
      </p>
      <div className="flex flex-col gap-2 p-3">
        {deals.length > 0 ? (
          deals.map((d) => <DealCard key={d.id} deal={d} contactName={contactNames[d.contact_id]} />)
        ) : (
          <p className="py-6 text-center font-body text-small text-slate">—</p>
        )}
      </div>
    </section>
  )
}
