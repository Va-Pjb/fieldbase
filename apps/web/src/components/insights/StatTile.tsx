/** A quiet KPI tile: uppercase label, a large mono figure, an optional sub-line. */
export default function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="ticket p-5">
      <p className="font-body text-label uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-2 font-mono text-title tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-1 font-body text-small text-slate">{sub}</p> : null}
    </div>
  )
}
