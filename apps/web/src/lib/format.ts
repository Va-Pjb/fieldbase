/** Format a dollar amount as whole AUD, or an em dash when absent. */
export function money(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value)
}
