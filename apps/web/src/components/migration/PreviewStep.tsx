import { useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { MigrationExecuteResult, MigrationPreviewResult } from '@fieldbase/shared-types'
import { executeMigration } from '../../lib/api/migration'

type Props = {
  preview: MigrationPreviewResult & { filename: string }
  onImported: (result: MigrationExecuteResult) => void
  onCancel: () => void
}

function cell(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null || value === '') return ''
  return String(value)
}

export default function PreviewStep({ preview, onImported, onCancel }: Props) {
  const { plan, sample, jobId, filename } = preview
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = plan.stats.totalRows
  const noun = total === 1 ? 'contact' : 'contacts'
  const mapped = plan.columnMappings.filter((m) => m.target)
  const ignored = plan.columnMappings.filter((m) => !m.target)
  const sampleCols = mapped.map((m) => m.target as string)
  const rows = sample as unknown as Record<string, unknown>[]

  async function onApprove() {
    setBusy(true)
    setError(null)
    try {
      onImported(await executeMigration(jobId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Signature: the one bold moment — what's about to happen, in plain terms. */}
      <div className="ticket p-6">
        <p className="font-body text-label uppercase text-slate">Ready to import</p>
        <p className="mt-2 font-display text-title text-ink">
          <span className="u-marker">
            {total} {noun}
          </span>{' '}
          from <span className="font-mono text-heading text-ink-soft">{filename || 'your file'}</span>
        </p>
        <p className="mt-2 font-body text-small text-slate">
          {mapped.length} {mapped.length === 1 ? 'column' : 'columns'} mapped
          {ignored.length ? `, ${ignored.length} ignored` : ''}. Nothing is written until you
          approve.
        </p>
      </div>

      {/* Column mapping — a work-order spec sheet. */}
      <section className="ticket overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-body text-label uppercase text-slate">Column mapping</h2>
        </div>
        <ul className="divide-y divide-line">
          {plan.columnMappings.map((m, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="font-mono text-small text-ink">{m.source}</span>
              <ArrowRight size={15} className="shrink-0 text-slate" aria-hidden />
              {m.target ? (
                <span className="rounded bg-brand/10 px-2 py-0.5 font-mono text-small text-brand-ink">
                  {m.target}
                </span>
              ) : (
                <span className="font-body text-small italic text-slate">ignored</span>
              )}
              {m.note && (
                <span className="ml-auto font-body text-small text-slate">{m.note}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {plan.warnings.length > 0 && (
        <section className="rounded-card border border-signal-deep/40 bg-signal/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-ink" aria-hidden />
            <h2 className="font-body text-label uppercase text-ink">Check before importing</h2>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {plan.warnings.map((w, i) => (
              <li key={i} className="font-body text-small text-ink-soft">
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="ticket overflow-hidden">
          <div className="border-b border-line px-5 py-3">
            <h2 className="font-body text-label uppercase text-slate">
              Sample — first {rows.length} of {total}
            </h2>
          </div>
          <div className="board-scroll overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {sampleCols.map((c) => (
                    <th key={c} className="px-4 py-2 font-body text-label uppercase text-slate">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {sampleCols.map((c) => {
                      const text = cell(row[c])
                      return (
                        <td
                          key={c}
                          className="whitespace-nowrap px-4 py-2 font-mono text-small text-ink"
                        >
                          {text === '' ? <span className="text-slate">—</span> : text}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3" role="alert">
          <p className="font-body text-small text-danger">{error}</p>
        </div>
      )}

      {/* The never-silent gate. */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onApprove()}
          disabled={busy}
          className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
        >
          {busy ? 'Importing…' : `Approve & import ${total} ${noun}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-line px-4 py-2 font-body text-small text-slate transition-colors hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
