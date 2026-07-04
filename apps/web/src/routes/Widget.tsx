import { useState } from 'react'
import { useParams } from 'react-router-dom'
import WidgetChat from '../components/widget/WidgetChat'
import BookingForm from '../components/widget/BookingForm'

// PUBLIC page (no auth, no app shell) at /widget/:token. The token identifies
// the owner; all data goes through the widget-public edge function.
export default function Widget() {
  const { token } = useParams()
  const [tab, setTab] = useState<'ask' | 'book'>('ask')

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-sunken p-4">
        <p className="font-body text-small text-slate">Invalid widget link.</p>
      </div>
    )
  }

  const tabClass = (active: boolean) =>
    `flex-1 px-4 py-3 font-body text-small font-semibold transition-colors ${
      active ? 'bg-paper text-ink' : 'bg-paper-sunken text-slate hover:text-ink'
    }`

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-sunken p-4">
      <div className="w-full max-w-md overflow-hidden rounded-card border border-line bg-paper">
        <header className="flex items-center gap-2 bg-ink px-5 py-4">
          <span className="h-3.5 w-3.5 rounded-sm bg-signal" aria-hidden />
          <span className="font-display text-heading text-paper">Book with us</span>
        </header>

        <div className="flex border-b border-line">
          <button type="button" onClick={() => setTab('ask')} className={tabClass(tab === 'ask')}>
            Ask a question
          </button>
          <button type="button" onClick={() => setTab('book')} className={tabClass(tab === 'book')}>
            Request a booking
          </button>
        </div>

        <div className="p-5">
          {tab === 'ask' ? <WidgetChat token={token} /> : <BookingForm token={token} />}
        </div>

        <p className="border-t border-line px-5 py-2 text-center font-mono text-[0.7rem] text-slate">
          Powered by FieldBase
        </p>
      </div>
    </div>
  )
}
