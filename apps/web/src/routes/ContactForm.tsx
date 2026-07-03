import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useContact } from '../hooks/useContacts'
import { useCreateContact, useUpdateContact } from '../hooks/useContactMutations'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  company: z.string(),
  phone: z.string(),
  email: z.union([z.literal(''), z.string().email('Enter a valid email')]),
  source: z.string(),
  tags: z.string(),
})

type FormValues = z.infer<typeof schema>
const EMPTY: FormValues = { name: '', company: '', phone: '', email: '', source: '', tags: '' }

const inputClass =
  'w-full rounded border border-line bg-paper-raised px-3 py-2 font-body text-small text-ink placeholder:text-slate'

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="font-body text-label uppercase text-slate">
        {label}
        {required && ' *'}
      </span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 font-body text-small text-danger">{error}</p>}
    </label>
  )
}

export default function ContactForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const existing = useContact(id)
  const create = useCreateContact()
  const update = useUpdateContact()

  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  useEffect(() => {
    if (existing.data) {
      setValues({
        name: existing.data.name,
        company: existing.data.company ?? '',
        phone: existing.data.phone ?? '',
        email: existing.data.email ?? '',
        source: existing.data.source ?? '',
        tags: existing.data.tags.join(', '),
      })
    }
  }, [existing.data])

  const busy = create.isPending || update.isPending

  function set<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    const payload = {
      name: values.name.trim(),
      company: values.company.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      source: values.source.trim() || null,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
    const saved =
      isEdit && id
        ? await update.mutateAsync({ id, patch: payload })
        : await create.mutateAsync(payload)
    navigate(`/contacts/${saved.id}`)
  }

  if (isEdit && existing.isLoading) {
    return <div className="p-10 font-body text-small text-slate">Loading…</div>
  }
  if (isEdit && !existing.isLoading && !existing.data) {
    return <div className="p-10 font-body text-small text-slate">Contact not found.</div>
  }

  const mutationError = (create.error ?? update.error) as Error | null

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">People</p>
        <h1 className="mt-1 font-display text-title text-ink">
          {isEdit ? 'Edit contact' : 'New contact'}
        </h1>
      </header>

      <div className="px-6 py-8 md:px-10">
        <form onSubmit={onSubmit} className="ticket max-w-lg space-y-4 p-6" noValidate>
          <Field label="Name" required error={errors.name}>
            <input
              className={inputClass}
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Company">
            <input
              className={inputClass}
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input
                className={inputClass}
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                inputMode="tel"
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <input
                className={inputClass}
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                inputMode="email"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source">
              <input
                className={inputClass}
                value={values.source}
                onChange={(e) => set('source', e.target.value)}
                placeholder="referral, google, website…"
              />
            </Field>
            <Field label="Tags">
              <input
                className={inputClass}
                value={values.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="comma, separated"
              />
            </Field>
          </div>

          {mutationError && (
            <p className="font-body text-small text-danger">{mutationError.message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-brand px-4 py-2 font-body text-small font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
            >
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create contact'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded border border-line px-4 py-2 font-body text-small text-slate hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
