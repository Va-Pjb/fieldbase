import { useState } from 'react'
import { useCreateAutomation } from '../../hooks/useAutomations'

const HINT = 'e.g. "Follow up with leads we haven\'t contacted in 2 days, by SMS, keep it friendly."'

export default function RuleBuilder() {
  const [instructions, setInstructions] = useState('')
  const create = useCreateAutomation()

  async function onCreate() {
    const text = instructions.trim()
    if (!text) return
    await create.mutateAsync({ instructions: text })
    setInstructions('')
  }

  return (
    <div className="max-w-2xl space-y-3">
      <label className="block">
        <span className="font-body text-label uppercase text-slate">Describe an automation</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder={HINT}
          className="mt-1 w-full rounded border border-line bg-paper-raised px-3 py-2 font-body text-small text-ink placeholder:text-slate"
        />
      </label>

      {create.isError && (
        <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3" role="alert">
          <p className="font-body text-small text-danger">{(create.error as Error).message}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void onCreate()}
        disabled={create.isPending || !instructions.trim()}
        className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        {create.isPending ? 'Reading your request…' : 'Create automation'}
      </button>
    </div>
  )
}
