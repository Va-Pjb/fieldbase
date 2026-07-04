import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Send, Star, X } from 'lucide-react'
import type { ReviewDraft } from '@fieldbase/shared-types'
import { sendReview } from '../../lib/api/reviews'
import { queryKeys } from '../../lib/queryKeys'

type Status = 'pending' | 'sent' | 'dismissed'

// One reviewable review-request draft. "Approve & send" is the only send path;
// it names the reviewId — nothing goes out without an explicit approval here.
export default function ReviewDraftCard({ draft }: { draft: ReviewDraft }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Status>('pending')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSend() {
    setBusy(true)
    setError(null)
    try {
      await sendReview(draft.reviewId)
      setStatus('sent')
      // The send is logged as an interaction — refresh that contact's timeline.
      void qc.invalidateQueries({ queryKey: queryKeys.timeline.byContact(draft.contactId) })
      void qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(draft.contactId) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'dismissed') return null

  return (
    <div className="ticket p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-heading text-ink">{draft.contactName}</span>
          <span className="rounded bg-paper-sunken px-2 py-0.5 font-mono text-small text-slate">
            {draft.channel}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 font-body text-small text-slate">
          <Star size={13} aria-hidden /> {draft.dealTitle}
        </span>
      </div>

      <p className="ticket__perf mt-4 whitespace-pre-wrap pt-4 font-body text-body text-ink-soft">
        {draft.body}
      </p>

      {error && (
        <p className="mt-3 font-body text-small text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {status === 'sent' ? (
          <span className="inline-flex items-center gap-2 font-body text-small font-semibold text-positive">
            <Send size={15} aria-hidden /> Sent
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
            >
              <Send size={15} aria-hidden /> {busy ? 'Sending…' : 'Approve & send'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('dismissed')}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded border border-line px-4 py-2 font-body text-small text-slate transition-colors hover:text-ink disabled:opacity-60"
            >
              <X size={15} aria-hidden /> Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  )
}
