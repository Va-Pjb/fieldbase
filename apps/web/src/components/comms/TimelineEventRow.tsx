import { Calendar, Mail, MessageSquare, Phone, StickyNote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TimelineEvent } from '@fieldbase/shared-types'
import { dateTime } from '../../lib/format'

const INTERACTION_ICON: Record<string, LucideIcon> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  note: StickyNote,
}

// One row in the contact timeline. Quiet by design — the signature accent lives
// in the relationship summary above. The left rail + square nub give the
// dispatch-log / work-order feel from the locked tokens.
export default function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const Icon = event.kind === 'interaction' ? (INTERACTION_ICON[event.interactionType] ?? StickyNote) : Calendar
  const label =
    event.kind === 'interaction' ? event.interactionType : `Appointment · ${event.status}`
  const when = dateTime(event.at)

  return (
    <li className="relative pl-6">
      <span
        className="absolute left-[-4px] top-1.5 h-2 w-2 bg-brand"
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Icon size={14} className="text-brand" aria-hidden />
        <span className="font-body text-label uppercase tracking-wide text-slate">{label}</span>
        <span className="font-mono text-small text-slate">{when}</span>
      </div>
      {event.kind === 'interaction' ? (
        <>
          {event.content && (
            <p className="mt-1 whitespace-pre-wrap font-body text-body text-ink-soft">
              {event.content}
            </p>
          )}
          {event.aiSummary && (
            <p className="mt-0.5 font-body text-small text-slate">{event.aiSummary}</p>
          )}
        </>
      ) : (
        event.notes && (
          <p className="mt-1 whitespace-pre-wrap font-body text-body text-ink-soft">{event.notes}</p>
        )
      )}
    </li>
  )
}
