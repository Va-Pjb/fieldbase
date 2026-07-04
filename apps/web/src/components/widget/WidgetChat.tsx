import { useState } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { askWidget } from '../../lib/api/widget'

type Msg = { role: 'you' | 'assistant'; text: string }

// Public FAQ chat. Each question hits the widget-public 'ask' path, answered
// only from the owner's configured profile.
export default function WidgetChat({ token }: { token: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onAsk(e: FormEvent) {
    e.preventDefault()
    const question = q.trim()
    if (!question || busy) return
    setMsgs((m) => [...m, { role: 'you', text: question }])
    setQ('')
    setBusy(true)
    setError(null)
    try {
      const res = await askWidget(token, question)
      setMsgs((m) => [...m, { role: 'assistant', text: res.answer }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="space-y-3">
        {msgs.length === 0 && (
          <p className="font-body text-small text-slate">
            Ask about services, hours, pricing, or anything else.
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'you' ? 'text-right' : ''}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-left font-body text-small ${
                m.role === 'you' ? 'bg-brand text-white' : 'bg-paper-sunken text-ink'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {busy && <p className="font-body text-small text-slate">Thinking…</p>}
      </div>

      {error && (
        <p className="mt-3 font-body text-small text-danger" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={onAsk} className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type your question…"
          aria-label="Your question"
          className="min-w-0 flex-1 rounded border border-line bg-paper px-3 py-2 font-body text-small text-ink placeholder:text-slate focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          aria-label="Send question"
          className="inline-flex items-center gap-1 rounded bg-ink px-3 py-2 font-body text-small font-semibold text-paper transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          <Send size={15} aria-hidden />
        </button>
      </form>
    </div>
  )
}
