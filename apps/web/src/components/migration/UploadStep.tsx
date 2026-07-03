import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import type { MigrationPreviewResult } from '@fieldbase/shared-types'
import { previewMigration } from '../../lib/api/migration'

const HINT =
  'e.g. "Map Mobile to phone and Company Name to company. Ignore the Notes column. Tags are separated by semicolons."'

// Rough client-side count for reassurance before the server parses properly.
function countRows(csv: string): number {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  return Math.max(0, lines.length - 1)
}

export default function UploadStep({
  onPreviewed,
}: {
  onPreviewed: (result: MigrationPreviewResult, filename: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')
  const [csv, setCsv] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    setError(null)
    if (!file) return
    const text = await file.text()
    setFilename(file.name)
    setCsv(text)
    setRowCount(countRows(text))
  }

  async function onPreview() {
    if (!csv) {
      setError('Choose a CSV file first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await previewMigration({ csv, instructions, filename })
      onPreviewed(res, filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="max-w-prose font-body text-body text-slate">
        Bring contacts across from another CRM or a spreadsheet. Upload a CSV and tell the
        assistant how to read it — it drafts a column mapping you approve before anything is
        written.
      </p>

      <div>
        <span className="font-body text-label uppercase text-slate">CSV file</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="field-grid mt-1 flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center transition-colors hover:border-brand"
        >
          <UploadCloud size={22} className="text-brand" aria-hidden />
          {filename ? (
            <span className="font-mono text-small text-ink">{filename}</span>
          ) : (
            <span className="font-body text-small text-slate">
              Choose a CSV file — header row plus one contact per row
            </span>
          )}
          {filename && (
            <span className="font-mono text-small text-slate">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'} detected
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
          aria-label="CSV file"
        />
      </div>

      <label className="block">
        <span className="font-body text-label uppercase text-slate">Instructions (optional)</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder={HINT}
          className="mt-1 w-full rounded border border-line bg-paper-raised px-3 py-2 font-body text-small text-ink placeholder:text-slate"
        />
      </label>

      {error && (
        <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3" role="alert">
          <p className="font-body text-small text-danger">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void onPreview()}
        disabled={busy || !csv}
        className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        {busy ? 'Planning the import…' : 'Preview import'}
      </button>
    </div>
  )
}
