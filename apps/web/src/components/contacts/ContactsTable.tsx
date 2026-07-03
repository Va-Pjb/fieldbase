import type { Contact } from '../../lib/api/contacts'

export default function ContactsTable({
  contacts,
  onSelect,
}: {
  contacts: Contact[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper-raised">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 text-label uppercase text-slate">Name</th>
            <th className="px-4 py-3 text-label uppercase text-slate">Company</th>
            <th className="hidden px-4 py-3 text-label uppercase text-slate sm:table-cell">Phone</th>
            <th className="hidden px-4 py-3 text-label uppercase text-slate md:table-cell">Email</th>
            <th className="hidden px-4 py-3 text-label uppercase text-slate lg:table-cell">Tags</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper-sunken">
              <td className="px-4 py-3">
                <button
                  onClick={() => onSelect(c.id)}
                  className="text-left font-body text-body font-semibold text-ink hover:text-brand"
                >
                  {c.name}
                </button>
              </td>
              <td className="px-4 py-3 font-body text-small text-slate">{c.company ?? '—'}</td>
              <td className="hidden px-4 py-3 font-mono text-small text-slate sm:table-cell">
                {c.phone ?? '—'}
              </td>
              <td className="hidden px-4 py-3 font-body text-small text-slate md:table-cell">
                {c.email ?? '—'}
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-paper-sunken px-2 py-0.5 text-label uppercase text-slate"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
