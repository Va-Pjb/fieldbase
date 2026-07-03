import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import type { MigrationExecuteResult, MigrationPreviewResult } from '@fieldbase/shared-types'
import { queryKeys } from '../lib/queryKeys'
import UploadStep from '../components/migration/UploadStep'
import PreviewStep from '../components/migration/PreviewStep'
import ResultStep from '../components/migration/ResultStep'

type Step = 'upload' | 'review' | 'result'
const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Review' },
  { id: 'result', label: 'Done' },
]

export default function Migration() {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<(MigrationPreviewResult & { filename: string }) | null>(
    null,
  )
  const [result, setResult] = useState<MigrationExecuteResult | null>(null)

  const activeIndex = STEPS.findIndex((s) => s.id === step)

  // Cancel or "import another" — drop the staged job and start over. Abandoning
  // the previewed job is safe: execute only ever runs from an explicit approval.
  function reset() {
    setPreview(null)
    setResult(null)
    setStep('upload')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">Import</p>
        <h1 className="mt-1 font-display text-title text-ink">Migration wizard</h1>
      </header>

      <div className="px-6 py-8 md:px-10">
        <ol className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Import steps">
          {STEPS.map((s, i) => {
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo'
            return (
              <li key={s.id} className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={
                      'flex h-7 w-7 items-center justify-center rounded-full font-mono text-small ' +
                      (state === 'active'
                        ? 'bg-brand text-white'
                        : state === 'done'
                          ? 'bg-signal text-ink'
                          : 'border border-line text-slate')
                    }
                  >
                    {state === 'done' ? <Check size={15} strokeWidth={2.5} /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    aria-current={state === 'active' ? 'step' : undefined}
                    className={
                      'font-body text-label uppercase ' +
                      (state === 'todo' ? 'text-slate' : 'text-ink')
                    }
                  >
                    {s.label}
                  </span>
                </span>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line md:w-10" aria-hidden />}
              </li>
            )
          })}
        </ol>

        {step === 'upload' && (
          <UploadStep
            onPreviewed={(res, filename) => {
              setPreview({ ...res, filename })
              setStep('review')
            }}
          />
        )}

        {step === 'review' && preview && (
          <PreviewStep
            preview={preview}
            onImported={(res) => {
              setResult(res)
              setStep('result')
              // The import wrote contacts outside React Query; refresh the list
              // so "View contacts" shows them immediately (matches mutations).
              void qc.invalidateQueries({ queryKey: queryKeys.contacts.all })
            }}
            onCancel={reset}
          />
        )}

        {step === 'result' && result && <ResultStep result={result} onReset={reset} />}
      </div>
    </div>
  )
}
