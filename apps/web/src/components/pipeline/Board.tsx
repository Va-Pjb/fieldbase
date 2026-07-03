import { useEffect, useRef, useState } from 'react'
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

  const scrollRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setFade({
        left: el.scrollLeft > 4,
        right: Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 4,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

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
      <div className="relative">
        {fade.left && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-paper to-transparent" />
        )}
        {fade.right && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-paper to-transparent" />
        )}
        <div ref={scrollRef} className="board-scroll flex gap-4 overflow-x-auto pb-3 pr-1">
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
      </div>
    </DndContext>
  )
}
