import { useState } from 'react'
import { SearchCheck } from 'lucide-react'
import type { FollowupDraft } from '@fieldbase/shared-types'
import { draftFollowups } from '../../lib/api/automations'
import DraftCard from './DraftCard'

export default function FollowupQueue() {
  const [drafts, setDrafts] = useState<FollowupDraft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onScan() {
    setBusy(true)
    setError(null)
    try {
      const res = await draftFollowups()
      setDrafts(res.drafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.')
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
          <SearchCheck size={16} aria-hidden /> {busy ? 'Scanning…' : 'Find leads to follow up'}
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
          <p className="font-body text-body text-slate">No leads need a follow-up right now.</p>
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <div className="grid gap-4 md:max-w-3xl">
          {drafts.map((d) => (
            <DraftCard key={d.draftId} draft={d} />
          ))}
        </div>
      )}
    </div>
  )
}
