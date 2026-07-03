/**
 * /design-tokens — a live preview of the locked FieldBase design system
 * (Phase 0, Task 4). Renders every color, type style, and the signature motif
 * so drift is caught by eye. Public route; doubles as a mini style guide.
 */

type Swatch = { name: string; hex: string; className: string; onDark?: boolean }

const CORE: Swatch[] = [
  { name: 'ink', hex: '#14232B', className: 'bg-ink', onDark: true },
  { name: 'ink.soft', hex: '#3A4A52', className: 'bg-ink-soft', onDark: true },
  { name: 'paper', hex: '#F7F6F1', className: 'bg-paper' },
  { name: 'paper.raised', hex: '#FFFFFF', className: 'bg-paper-raised' },
  { name: 'brand', hex: '#1B54C8', className: 'bg-brand', onDark: true },
  { name: 'brand.ink', hex: '#0F3C97', className: 'bg-brand-ink', onDark: true },
  { name: 'signal', hex: '#C7F24A', className: 'bg-signal' },
  { name: 'signal.deep', hex: '#93C013', className: 'bg-signal-deep' },
  { name: 'slate', hex: '#5C6B72', className: 'bg-slate', onDark: true },
  { name: 'line', hex: '#D8DBD3', className: 'bg-line' },
]

const SEMANTIC: Swatch[] = [
  { name: 'positive', hex: '#1E9E5A', className: 'bg-positive', onDark: true },
  { name: 'danger', hex: '#D2462F', className: 'bg-danger', onDark: true },
]

const TYPE: { name: string; className: string; sample: string }[] = [
  { name: 'display / Archivo 700', className: 'font-display text-display', sample: 'Dispatch board' },
  { name: 'title / Archivo 700', className: 'font-display text-title', sample: 'Today’s work orders' },
  { name: 'heading / Archivo 600', className: 'font-display text-heading', sample: 'Upcoming appointments' },
  { name: 'body / Public Sans 400', className: 'font-body text-body', sample: 'Every job, contact, and follow-up in one place.' },
  { name: 'small / Public Sans 400', className: 'font-body text-small', sample: 'Secondary detail and helper text.' },
  { name: 'label / Public Sans 600', className: 'font-body text-label uppercase text-slate', sample: 'Job status' },
  { name: 'mono / JetBrains Mono', className: 'font-mono text-small', sample: 'WO-4817 · 09:24 · +61 4xx' },
]

function SwatchCard({ s }: { s: Swatch }) {
  return (
    <div className="ticket overflow-hidden">
      <div className={`${s.className} h-20 border-b border-line`} />
      <div className="flex items-baseline justify-between px-3 py-2">
        <span className="font-mono text-small text-ink">{s.name}</span>
        <span className="font-mono text-small text-slate">{s.hex}</span>
      </div>
    </div>
  )
}

export default function DesignTokens() {
  return (
    <div className="field-grid min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-label uppercase text-brand">FieldBase · design system</p>
        <h1 className="mt-2 font-display text-display text-ink">
          The <span className="u-marker">field ticket</span>
        </h1>
        <p className="mt-3 max-w-xl font-body text-body text-slate">
          Tokens locked in Phase 0. Work-order paper, blueprint ink, dispatch blue, and a
          hi-vis marker for the one thing that matters on each screen.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-heading text-ink">Color — core</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CORE.map((s) => (
              <SwatchCard key={s.name} s={s} />
            ))}
          </div>

          <h2 className="mt-8 font-display text-heading text-ink">Color — semantic</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {SEMANTIC.map((s) => (
              <SwatchCard key={s.name} s={s} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-heading text-ink">Type scale</h2>
          <div className="ticket mt-4 divide-y divide-line">
            {TYPE.map((t) => (
              <div key={t.name} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-56 shrink-0 font-mono text-small text-slate">{t.name}</span>
                <span className={`${t.className} text-ink`}>{t.sample}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-heading text-ink">Signature motif</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="ticket p-5">
              <p className="text-label uppercase text-slate">Work order</p>
              <p className="mt-1 font-mono text-small text-brand">WO-4817</p>
              <div className="ticket__perf my-3" />
              <p className="font-display text-heading text-ink">Hot water system — no hot water</p>
              <p className="mt-1 font-body text-small text-slate">
                12 Marine Pde · booked <span className="u-marker">today 2:00pm</span>
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded bg-signal px-2 py-1 text-label uppercase text-ink">On-site</span>
                <span className="rounded border border-line px-2 py-1 text-label uppercase text-slate">
                  Callout
                </span>
              </div>
            </div>
            <div className="field-grid rounded-card border border-line p-5">
              <p className="text-label uppercase text-slate">Field grid</p>
              <p className="mt-2 font-body text-small text-ink">
                The ambient surface: faint graph-paper ruling, like a site plan sketched on the
                back of a job sheet. Backs dashboards and empty states.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
