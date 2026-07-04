import { useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarCheck } from 'lucide-react'
import { bookWidget } from '../../lib/api/widget'

const inputClass =
  'w-full rounded border border-line bg-paper px-3 py-2 font-body text-small text-ink placeholder:text-slate focus:border-brand focus:outline-none'

// Public booking form. Submits to the widget-public 'book' path, which creates a
// pending (status='requested') appointment the owner confirms later.
export default function BookingForm({ token }: { token: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', when: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!form.name.trim()) return setError('Please add your name.')
    if (!form.email.trim() && !form.phone.trim()) {
      return setError('Add an email or phone so we can reach you.')
    }
    if (!form.when) return setError('Pick a preferred date and time.')
    const startMs = new Date(form.when).getTime()
    if (Number.isNaN(startMs)) return setError('That date and time looks invalid.')

    setBusy(true)
    try {
      await bookWidget(token, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        startTime: new Date(startMs).toISOString(),
        notes: form.notes.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <CalendarCheck size={28} className="mx-auto text-positive" aria-hidden />
        <p className="mt-2 font-display text-heading text-ink">Request received</p>
        <p className="mt-1 font-body text-small text-slate">
          We'll be in touch to confirm your time. Thanks!
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        className={inputClass}
        placeholder="Your name"
        aria-label="Your name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className={inputClass}
        type="email"
        placeholder="Email"
        aria-label="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        className={inputClass}
        placeholder="Phone"
        aria-label="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <label className="block">
        <span className="font-body text-label uppercase text-slate">Preferred time</span>
        <input
          type="datetime-local"
          className={`${inputClass} mt-1`}
          value={form.when}
          onChange={(e) => setForm({ ...form, when: e.target.value })}
        />
      </label>
      <textarea
        className={`${inputClass} min-h-[80px]`}
        placeholder="What do you need help with?"
        aria-label="What do you need help with?"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />

      {error && (
        <p className="font-body text-small text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Request booking'}
      </button>
    </form>
  )
}
