import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { DEAL_STAGES, type Deal, type DealStage } from '../../lib/api/deals'
import Column from './Column'

export default function Board({
  deals,
  contactNames,
  onMoveStage,
  onOpenDeal,
}: {
  deals: Deal[]
  contactNames: Record<string, string>
  onMoveStage: (id: string, stage: DealStage) => void
  onOpenDeal: (deal: Deal) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return
    const id = String(e.active.id)
    const stage = String(e.over.id) as DealStage
    if (!DEAL_STAGES.includes(stage)) return
    const deal = deals.find((d) => d.id === id)
    if (deal && deal.stage !== stage) onMoveStage(id, stage)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {DEAL_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            deals={deals.filter((d) => d.stage === stage)}
            contactNames={contactNames}
            onOpenDeal={onOpenDeal}
          />
        ))}
      </div>
    </DndContext>
  )
}
