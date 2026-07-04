import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContact } from '../hooks/useContacts'
import { useDealsByContact } from '../hooks/useDeals'
import { useDeleteContact } from '../hooks/useContactMutations'
import ConfirmDialog from '../components/ConfirmDialog'
import StageBadge from '../components/StageBadge'
import RelationshipSummary from '../components/comms/RelationshipSummary'
import ContactTimeline from '../components/comms/ContactTimeline'
import { money } from '../lib/format'

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-label uppercase text-slate">{label}</dt>
      <dd className={`text-right text-ink ${mono ? 'font-mono' : 'font-body'}`}>{value || '—'}</dd>
    </div>
  )
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const contact = useContact(id)
  const deals = useDealsByContact(id)
  const del = useDeleteContact()
  const [confirming, setConfirming] = useState(false)

  if (contact.isLoading) {
    return <div className="p-10 font-body text-small text-slate">Loading…</div>
  }
  if (!contact.data) {
    return (
      <div className="p-10">
        <p className="font-body text-small text-slate">Contact not found.</p>
        <button
          onClick={() => navigate('/contacts')}
          className="mt-3 font-body text-small text-brand hover:underline"
        >
          ← Back to contacts
        </button>
      </div>
    )
  }

  const c = contact.data

  async function onDelete() {
    if (!id) return
    await del.mutateAsync(id)
    navigate('/contacts')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <button
          onClick={() => navigate('/contacts')}
          className="font-body text-small text-slate hover:text-ink"
        >
          ← Contacts
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-body text-label uppercase text-brand">Contact</p>
            <h1 className="mt-1 font-display text-title text-ink">{c.name}</h1>
            {c.company && <p className="font-body text-small text-slate">{c.company}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/contacts/${c.id}/edit`)}
              className="rounded border border-line px-4 py-2 font-body text-small text-ink hover:border-brand hover:text-brand"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded border border-line px-4 py-2 font-body text-small text-slate hover:border-danger hover:text-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 pt-8 md:px-10">
        <RelationshipSummary
          contactId={c.id}
          summary={c.ai_summary}
          updatedAt={c.summary_updated_at}
        />
      </div>

      <div className="grid gap-6 px-6 pb-8 pt-6 md:px-10 lg:grid-cols-3">
        <section className="ticket p-6 lg:col-span-1">
          <p className="font-body text-label uppercase text-slate">Details</p>
          <div className="ticket__perf my-3" />
          <dl className="space-y-3 font-body text-small">
            <Row label="Phone" value={c.phone} mono />
            <Row label="Email" value={c.email} />
            <Row label="Source" value={c.source} />
            <div>
              <dt className="text-label uppercase text-slate">Tags</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {c.tags.length ? (
                  c.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-paper-sunken px-2 py-0.5 text-label uppercase text-slate"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-ink">—</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="font-display text-heading text-ink">Deals</h2>
            <div className="mt-3">
              {deals.isLoading ? (
                <p className="font-body text-small text-slate">Loading deals…</p>
              ) : deals.data && deals.data.length > 0 ? (
                <ul className="space-y-2">
                  {deals.data.map((d) => (
                    <li key={d.id} className="ticket flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-body text-body text-ink">{d.title}</p>
                        <p className="mt-0.5 font-mono text-small text-slate">
                          {money(d.value)}
                          {d.probability != null && ` · ${d.probability}%`}
                        </p>
                      </div>
                      <StageBadge stage={d.stage} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-body text-small text-slate">No deals for this contact yet.</p>
              )}
            </div>
          </section>

          <ContactTimeline contactId={c.id} />
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete contact?"
          message={`This permanently deletes ${c.name} and their deals. This can't be undone.`}
          confirmLabel="Delete"
          busy={del.isPending}
          onConfirm={onDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
