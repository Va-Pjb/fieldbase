import { useState } from 'react'
import { SearchCheck } from 'lucide-react'
import type { ReviewDraft } from '@fieldbase/shared-types'
import { draftReviews } from '../../lib/api/reviews'
import ReviewDraftCard from './ReviewDraftCard'

// Scan won deals for jobs that haven't been asked for a review, draft one each,
// and review-then-approve every send. The scan writes drafts only.
export default function ReviewQueue() {
  const [drafts, setDrafts] = useState<ReviewDraft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onScan() {
    setBusy(true)
    setError(null)
    try {
      const res = await draftReviews()
      setDrafts(res.drafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find jobs to review.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void onScan()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 font-body text-small font-semibold text-paper transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          <SearchCheck size={16} aria-hidden />{' '}
          {busy ? 'Finding jobs…' : 'Find jobs to request reviews'}
        </button>
        {drafts && drafts.length > 0 && (
          <p className="font-body text-body text-ink">
            <span className="u-marker">
              {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
            </span>{' '}
            to review
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3" role="alert">
          <p className="font-body text-small text-danger">{error}</p>
        </div>
      )}

      {drafts && drafts.length === 0 && (
        <div className="field-grid flex min-h-[160px] items-center justify-center rounded-card border border-line">
          <p className="font-body text-body text-slate">
            No completed jobs are waiting on a review request.
          </p>
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <div className="grid gap-4 md:max-w-3xl">
          {drafts.map((d) => (
            <ReviewDraftCard key={d.reviewId} draft={d} />
          ))}
        </div>
      )}
    </div>
  )
}
