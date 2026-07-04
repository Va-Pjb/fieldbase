import { RefreshCw } from 'lucide-react'
import { useGenerateContactSummary } from '../../hooks/useTimeline'
import { dateTime } from '../../lib/format'

// The signature AI moment on the contact detail view: a Claude-written
// relationship summary over the whole timeline. The hi-vis marker (.u-marker)
// is spent here and nowhere else on the page.
export default function RelationshipSummary({
  contactId,
  summary,
  updatedAt,
}: {
  contactId: string
  summary: string | null
  updatedAt: string | null
}) {
  const gen = useGenerateContactSummary(contactId)
  const busy = gen.isPending

  return (
    <section className="ticket p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="u-marker font-body text-label uppercase text-ink">AI relationship summary</p>
        <button
          type="button"
          onClick={() => gen.mutate()}
          disabled={busy}
          className="inline-flex items-center gap-2 font-body text-small font-semibold text-brand transition-colors hover:text-brand-ink disabled:opacity-60"
        >
          <RefreshCw
            size={14}
            className={busy ? 'animate-spin motion-reduce:animate-none' : ''}
            aria-hidden
          />
          {busy ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      <div className="ticket__perf my-3" />

      {gen.isError && (
        <p className="font-body text-small text-danger" role="alert">
          {gen.error instanceof Error ? gen.error.message : 'Could not generate a summary.'}
        </p>
      )}

      {summary ? (
        <>
          <p className="whitespace-pre-wrap font-body text-body text-ink-soft">{summary}</p>
          {updatedAt && (
            <p className="mt-3 font-mono text-label uppercase text-slate">Updated {dateTime(updatedAt)}</p>
          )}
        </>
      ) : (
        !gen.isError && (
          <p className="font-body text-small text-slate">
            No summary yet. Generate one from this contact's calls, messages, and appointments.
          </p>
        )
      )}
    </section>
  )
}
