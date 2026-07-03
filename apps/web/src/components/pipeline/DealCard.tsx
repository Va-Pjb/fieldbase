import type { Deal } from '../../lib/api/deals'
import { money } from '../../lib/format'

export default function DealCard({ deal, contactName }: { deal: Deal; contactName?: string }) {
  return (
    <div className="ticket p-3">
      <p className="font-body text-small font-semibold text-ink">{deal.title}</p>
      {contactName && <p className="mt-0.5 font-body text-label uppercase text-slate">{contactName}</p>}
      <p className="mt-2 font-mono text-small text-ink">
        {money(deal.value)}
        {deal.probability != null && <span className="text-slate"> · {deal.probability}%</span>}
      </p>
    </div>
  )
}
