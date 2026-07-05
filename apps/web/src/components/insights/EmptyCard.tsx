import type { ReactNode } from 'react'

/** Quiet empty state on the signature field-grid surface (matches other modules). */
export default function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="field-grid flex min-h-[120px] items-center justify-center rounded-card border border-line">
      <p className="max-w-sm px-6 text-center font-body text-small text-slate">{children}</p>
    </div>
  )
}
