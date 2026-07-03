import { useMemo } from 'react'
import { useContacts } from '../hooks/useContacts'
import { useDeals } from '../hooks/useDeals'
import Board from '../components/pipeline/Board'
import { money } from '../lib/format'

export default function Pipeline() {
  const deals = useDeals()
  const contacts = useContacts()

  const contactNames = useMemo(
    () => Object.fromEntries((contacts.data ?? []).map((c) => [c.id, c.name] as const)),
    [contacts.data],
  )

  const list = deals.data ?? []
  const openDeals = list.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const openTotal = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">Deals</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-title text-ink">Pipeline</h1>
          <p className="font-mono text-small text-slate">
            Open <span className="text-ink">{money(openTotal)}</span> · {openDeals.length} live
          </p>
        </div>
      </header>

      <div className="px-6 py-6 md:px-10">
        {deals.isLoading ? (
          <p className="font-body text-small text-slate">Loading pipeline…</p>
        ) : deals.isError ? (
          <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3">
            <p className="font-body text-small text-danger">
              Couldn’t load deals: {(deals.error as Error).message}
            </p>
          </div>
        ) : list.length > 0 ? (
          <Board deals={list} contactNames={contactNames} />
        ) : (
          <div className="field-grid flex min-h-[240px] items-center justify-center rounded-card border border-line">
            <p className="font-body text-body text-slate">
              No deals yet. Load sample data in Settings to see the pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
