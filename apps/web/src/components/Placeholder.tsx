import type { ReactNode } from 'react'

/** Shared empty-state frame for module pages until each is built out. */
export default function Placeholder({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">{eyebrow}</p>
        <h1 className="mt-1 font-display text-title text-ink">{title}</h1>
      </header>
      <div className="px-6 py-8 md:px-10">
        <div className="field-grid flex min-h-[280px] items-center justify-center rounded-card border border-line">
          <p className="max-w-md px-6 text-center font-body text-body text-slate">{children}</p>
        </div>
      </div>
    </div>
  )
}
