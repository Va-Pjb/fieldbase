import { useDraggable } from '@dnd-kit/core'
import type { Deal } from '../../lib/api/deals'
import { money } from '../../lib/format'

export default function DealCard({
  deal,
  contactName,
  onOpen,
}: {
  deal: Deal
  contactName?: string
  onOpen: (deal: Deal) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onOpen(deal)}
      {...listeners}
      {...attributes}
      className={`ticket cursor-grab p-3 text-left ${isDragging ? 'opacity-60' : ''}`}
    >
      <p className="font-body text-small font-semibold text-ink">{deal.title}</p>
      {contactName && (
        <p className="mt-0.5 font-body text-label uppercase text-slate">{contactName}</p>
      )}
      <p className="mt-2 font-mono text-small text-ink">
        {money(deal.value)}
        {deal.probability != null && <span className="text-slate"> · {deal.probability}%</span>}
      </p>
    </div>
  )
}
