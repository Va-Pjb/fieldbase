import { useTimeline } from '../../hooks/useTimeline'
import TimelineEventRow from './TimelineEventRow'

// The unified, chronological contact timeline: interactions + appointments,
// most-recent first. Read-only; the AI summary above is the AI moment.
export default function ContactTimeline({ contactId }: { contactId: string }) {
  const timeline = useTimeline(contactId)

  return (
    <section>
      <h2 className="font-display text-heading text-ink">Timeline</h2>
      <div className="mt-3">
        {timeline.isLoading ? (
          <p className="font-body text-small text-slate">Loading timeline…</p>
        ) : timeline.isError ? (
          <p className="font-body text-small text-danger" role="alert">
            Could not load the timeline.
          </p>
        ) : timeline.data && timeline.data.length > 0 ? (
          <ul className="ml-1 space-y-5 border-l border-line py-1">
            {timeline.data.map((e) => (
              <TimelineEventRow key={`${e.kind}-${e.id}`} event={e} />
            ))}
          </ul>
        ) : (
          <p className="font-body text-small text-slate">
            No calls, messages, or appointments logged yet.
          </p>
        )}
      </div>
    </section>
  )
}
