import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import type { MigrationExecuteResult } from '@fieldbase/shared-types'

export default function ResultStep({
  result,
  onReset,
}: {
  result: MigrationExecuteResult
  onReset: () => void
}) {
  const { imported, skipped, warnings } = result

  return (
    <div className="max-w-2xl space-y-6">
      <div className="ticket p-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-positive" aria-hidden />
          <p className="font-body text-label uppercase text-slate">Import complete</p>
        </div>
        <p className="mt-2 font-display text-title text-ink">
          <span className="u-marker">
            {imported} imported
          </span>
          {skipped > 0 && <span className="text-slate"> · {skipped} skipped</span>}
        </p>
        <p className="mt-2 font-body text-small text-slate">
          The new contacts are in your CRM now.
        </p>
      </div>

      {warnings.length > 0 && (
        <section className="rounded-card border border-signal-deep/40 bg-signal/10 px-5 py-4">
          <h2 className="font-body text-label uppercase text-ink">Notes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {warnings.map((w, i) => (
              <li key={i} className="font-body text-small text-ink-soft">
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/contacts"
          className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink"
        >
          View contacts
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-line px-4 py-2 font-body text-small text-slate transition-colors hover:text-ink"
        >
          Import another file
        </button>
      </div>
    </div>
  )
}
