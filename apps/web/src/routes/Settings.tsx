import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearMyData, loadSampleData } from '../lib/sampleData'
import { queryKeys } from '../lib/queryKeys'
import { useContacts } from '../hooks/useContacts'
import { useDeals } from '../hooks/useDeals'

export default function Settings() {
  const qc = useQueryClient()
  const contacts = useContacts()
  const deals = useDeals()
  const [confirmClear, setConfirmClear] = useState(false)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.contacts.all })
    void qc.invalidateQueries({ queryKey: queryKeys.deals.all })
  }

  const load = useMutation({ mutationFn: loadSampleData, onSuccess: invalidate })
  const clear = useMutation({
    mutationFn: clearMyData,
    onSuccess: () => {
      invalidate()
      setConfirmClear(false)
    },
  })

  const contactCount = contacts.data?.length ?? 0
  const dealCount = deals.data?.length ?? 0

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">Workspace</p>
        <h1 className="mt-1 font-display text-title text-ink">Settings</h1>
      </header>

      <div className="px-6 py-8 md:px-10">
        <section className="ticket max-w-2xl p-6">
          <h2 className="font-display text-heading text-ink">Demo data</h2>
          <p className="mt-1 font-body text-small text-slate">
            Load fake service-business contacts and jobs to explore FieldBase, or clear everything
            and start fresh. Sample data only — never real customers.
          </p>

          <dl className="mt-5 flex gap-8 font-mono text-small">
            <div>
              <dt className="text-label uppercase text-slate">Contacts</dt>
              <dd className="mt-1 text-body text-ink">{contacts.isLoading ? '…' : contactCount}</dd>
            </div>
            <div>
              <dt className="text-label uppercase text-slate">Deals</dt>
              <dd className="mt-1 text-body text-ink">{deals.isLoading ? '…' : dealCount}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => load.mutate()}
              disabled={load.isPending}
              className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
            >
              {load.isPending ? 'Loading…' : 'Load sample data'}
            </button>

            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={clear.isPending || contactCount === 0}
                className="rounded border border-line px-4 py-2 font-body text-small text-slate transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
              >
                Clear my data
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <button
                  onClick={() => clear.mutate()}
                  disabled={clear.isPending}
                  className="rounded bg-danger px-4 py-2 font-body text-small font-semibold text-white disabled:opacity-60"
                >
                  {clear.isPending ? 'Clearing…' : 'Confirm — delete all'}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="font-body text-small text-slate hover:text-ink"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>

          {(load.isError || clear.isError) && (
            <p className="mt-3 font-body text-small text-danger">
              {(load.error as Error)?.message ?? (clear.error as Error)?.message}
            </p>
          )}
          {load.isSuccess && !load.isPending && (
            <p className="mt-3 font-body text-small text-positive">
              Loaded {load.data.contacts} contacts and {load.data.deals} deals.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
