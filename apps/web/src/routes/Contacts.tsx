import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../hooks/useContacts'
import ContactsTable from '../components/contacts/ContactsTable'

export default function Contacts() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const navigate = useNavigate()
  const { data: contacts, isLoading, isError, error } = useContacts(deferredSearch)

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">People</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-title text-ink">Contacts</h1>
          <button
            onClick={() => navigate('/contacts/new')}
            className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink"
          >
            + New contact
          </button>
        </div>
      </header>

      <div className="px-6 py-6 md:px-10">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, or email"
          className="mb-5 w-full max-w-sm rounded border border-line bg-paper-raised px-3 py-2 font-body text-small text-ink placeholder:text-slate"
        />

        {isLoading ? (
          <p className="font-body text-small text-slate">Loading contacts…</p>
        ) : isError ? (
          <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3">
            <p className="font-body text-small text-danger">
              Couldn’t load contacts: {(error as Error).message}
            </p>
          </div>
        ) : contacts && contacts.length > 0 ? (
          <>
            <p className="mb-3 font-mono text-small text-slate">
              {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
            </p>
            <ContactsTable contacts={contacts} onSelect={(id) => navigate(`/contacts/${id}`)} />
          </>
        ) : deferredSearch ? (
          <div className="field-grid flex min-h-[240px] items-center justify-center rounded-card border border-line">
            <p className="font-body text-body text-slate">No contacts match “{deferredSearch}”.</p>
          </div>
        ) : (
          <div className="field-grid flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-card border border-line text-center">
            <p className="font-body text-body text-slate">
              No contacts yet. Add your first, or load sample data in Settings.
            </p>
            <button
              onClick={() => navigate('/contacts/new')}
              className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white hover:bg-brand-ink"
            >
              + New contact
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
