import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useContacts } from '../../hooks/useContacts'
import { useCreateDeal, useUpdateDeal } from '../../hooks/useDealMutations'
import { DEAL_STAGES, STAGE_LABELS, type Deal, type DealStage } from '../../lib/api/deals'

const inputClass =
  'w-full rounded border border-line bg-paper-raised px-3 py-2 font-body text-small text-ink placeholder:text-slate'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="font-body text-label uppercase text-slate">
        {label}
        {required && ' *'}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export default function DealForm({
  deal,
  defaultStage,
  onClose,
}: {
  deal?: Deal | null
  defaultStage?: DealStage
  onClose: () => void
}) {
  const isEdit = Boolean(deal)
  const contacts = useContacts()
  const create = useCreateDeal()
  const update = useUpdateDeal()

  const [title, setTitle] = useState(deal?.title ?? '')
  const [contactId, setContactId] = useState(deal?.contact_id ?? '')
  const [value, setValue] = useState(deal?.value != null ? String(deal.value) : '')
  const [probability, setProbability] = useState(
    deal?.probability != null ? String(deal.probability) : '',
  )
  const [stage, setStage] = useState<DealStage>((deal?.stage as DealStage) ?? defaultStage ?? 'lead')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const busy = create.isPending || update.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!contactId) {
      setError('Choose a contact.')
      return
    }
    const numValue = value.trim() === '' ? null : Number(value)
    const numProb = probability.trim() === '' ? null : Number(probability)
    if (numValue != null && Number.isNaN(numValue)) {
      setError('Value must be a number.')
      return
    }
    if (numProb != null && (Number.isNaN(numProb) || numProb < 0 || numProb > 100)) {
      setError('Probability must be between 0 and 100.')
      return
    }
    setError(null)
    const payload = {
      title: title.trim(),
      contact_id: contactId,
      value: numValue,
      probability: numProb,
      stage,
    }
    if (isEdit && deal) await update.mutateAsync({ id: deal.id, patch: payload })
    else await create.mutateAsync(payload)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit deal' : 'New deal'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="ticket w-full max-w-md space-y-4 p-6"
        noValidate
      >
        <h2 className="font-display text-heading text-ink">{isEdit ? 'Edit deal' : 'New deal'}</h2>

        <Field label="Title" required>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Contact" required>
          <select
            className={inputClass}
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">Select a contact…</option>
            {(contacts.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Value (AUD)">
            <input
              className={inputClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
          <Field label="Probability %">
            <input
              className={inputClass}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              inputMode="numeric"
              placeholder="0–100"
            />
          </Field>
        </div>

        <Field label="Stage">
          <select
            className={inputClass}
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStage)}
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="font-body text-small text-danger">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-line px-4 py-2 font-body text-small text-slate hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
