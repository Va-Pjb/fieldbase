import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useUpdateWidgetConfig, useWidgetConfig } from '../../hooks/useWidgetConfig'

const inputClass =
  'w-full rounded border border-line bg-paper px-3 py-2 font-body text-small text-ink placeholder:text-slate focus:border-brand focus:outline-none'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-body text-label uppercase text-slate">{label}</span>
      {hint && <span className="ml-2 font-body text-small text-slate">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

// Owner-facing widget configuration (rendered in Settings). Edits the caller's
// single widget_config row; shows the public embed link.
export default function WidgetSettings() {
  const config = useWidgetConfig()
  const update = useUpdateWidgetConfig(config.data?.id)
  const [form, setForm] = useState({
    business_name: '',
    services: '',
    hours: '',
    faq: '',
    review_link: '',
    is_enabled: true,
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (config.data) {
      setForm({
        business_name: config.data.business_name ?? '',
        services: config.data.services ?? '',
        hours: config.data.hours ?? '',
        faq: config.data.faq ?? '',
        review_link: config.data.review_link ?? '',
        is_enabled: config.data.is_enabled,
      })
    }
  }, [config.data])

  if (config.isLoading) {
    return (
      <section className="ticket max-w-2xl p-6">
        <p className="font-body text-small text-slate">Loading widget settings…</p>
      </section>
    )
  }
  if (config.isError || !config.data) {
    return (
      <section className="ticket max-w-2xl p-6">
        <p className="font-body text-small text-danger">Could not load widget settings.</p>
      </section>
    )
  }

  const widgetUrl = `${window.location.origin}/widget/${config.data.public_token}`

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(widgetUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the link is visible to copy manually */
    }
  }

  function onSave() {
    update.mutate({
      business_name: form.business_name.trim() || null,
      services: form.services.trim() || null,
      hours: form.hours.trim() || null,
      faq: form.faq.trim() || null,
      review_link: form.review_link.trim() || null,
      is_enabled: form.is_enabled,
    })
  }

  return (
    <section className="ticket max-w-2xl p-6">
      <h2 className="font-display text-heading text-ink">Booking &amp; FAQ widget</h2>
      <p className="mt-1 font-body text-small text-slate">
        A public page where prospects ask questions (answered only from the details below) and
        request a booking. Requests arrive as pending appointments for you to confirm.
      </p>

      <div className="mt-5 rounded border border-line bg-paper-sunken p-3">
        <p className="font-body text-label uppercase text-slate">Public widget link</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <code className="min-w-0 break-all font-mono text-small text-ink">{widgetUrl}</code>
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="inline-flex items-center gap-1 font-body text-small text-brand hover:text-brand-ink"
          >
            {copied ? (
              <>
                <Check size={14} aria-hidden /> Copied
              </>
            ) : (
              <>
                <Copy size={14} aria-hidden /> Copy
              </>
            )}
          </button>
          <a
            href={widgetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-body text-small text-brand hover:text-brand-ink"
          >
            <ExternalLink size={14} aria-hidden /> Open
          </a>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Business name">
          <input
            className={inputClass}
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            placeholder="Northwind Plumbing Co"
          />
        </Field>
        <Field label="Services">
          <input
            className={inputClass}
            value={form.services}
            onChange={(e) => setForm({ ...form, services: e.target.value })}
            placeholder="Blocked drains, hot water, leak repairs"
          />
        </Field>
        <Field label="Hours">
          <input
            className={inputClass}
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="Mon–Fri 7am–5pm; 24/7 emergencies"
          />
        </Field>
        <Field label="FAQ" hint="what the assistant can answer">
          <textarea
            className={`${inputClass} min-h-[110px]`}
            value={form.faq}
            onChange={(e) => setForm({ ...form, faq: e.target.value })}
            placeholder="Q: Are quotes free? A: Yes, all quotes are free…"
          />
        </Field>
        <Field label="Review link" hint="used in review requests">
          <input
            className={inputClass}
            value={form.review_link}
            onChange={(e) => setForm({ ...form, review_link: e.target.value })}
            placeholder="https://g.page/r/…/review"
          />
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
            className="h-4 w-4 accent-brand"
          />
          <span className="font-body text-small text-ink">
            Widget enabled (visitors can use the public link)
          </span>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={update.isPending}
          className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
        >
          {update.isPending ? 'Saving…' : 'Save widget'}
        </button>
        {update.isSuccess && !update.isPending && (
          <span className="font-body text-small text-positive">Saved.</span>
        )}
        {update.isError && (
          <span className="font-body text-small text-danger">
            {update.error instanceof Error ? update.error.message : 'Save failed.'}
          </span>
        )}
      </div>
    </section>
  )
}
