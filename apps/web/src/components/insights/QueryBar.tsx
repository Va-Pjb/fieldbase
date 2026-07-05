import { useState } from 'react'
import { useInsightQuery } from '../../hooks/useInsightQuery'
import PlanChips from './PlanChips'
import QueryResult from './QueryResult'

const EXAMPLES = ['won deals over $3000', 'total value of won deals', 'how many contacts by source']

/** The page hero: ask the CRM a question in plain English (read-only, AI). */
export default function QueryBar() {
  const [q, setQ] = useState('')
  const ask = useInsightQuery()

  const submit = (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || ask.isPending) return
    setQ(trimmed)
    ask.mutate(trimmed)
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="font-body text-label uppercase text-brand">Natural language</p>
        <h2 className="mt-1 font-display text-title text-ink">
          Ask about your <span className="u-marker">jobs &amp; deals</span>
        </h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(q)
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. total value of won deals"
          aria-label="Ask a question about your CRM"
          className="flex-1 rounded-card border border-line bg-paper-raised px-4 py-3 font-body text-body text-ink placeholder:text-slate focus:border-brand"
        />
        <button
          type="submit"
          disabled={ask.isPending || !q.trim()}
          className="rounded-card bg-brand px-6 py-3 font-body text-small font-semibold text-paper-raised transition-colors hover:bg-brand-ink disabled:opacity-50"
        >
          {ask.isPending ? 'Asking…' : 'Ask'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-body text-small text-slate">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => submit(ex)}
            className="rounded border border-line bg-paper-raised px-2.5 py-1 font-body text-small text-ink hover:border-brand"
          >
            {ex}
          </button>
        ))}
      </div>

      {ask.isError ? (
        <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3">
          <p className="font-body text-small text-danger">
            {(ask.error as Error).message} Try one of the examples above.
          </p>
        </div>
      ) : ask.data ? (
        <div className="space-y-3">
          <PlanChips plan={ask.data.plan} count={ask.data.count} />
          <QueryResult result={ask.data} />
        </div>
      ) : null}
    </section>
  )
}
