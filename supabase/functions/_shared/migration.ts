// Migration core — dependency-free TS so it runs unchanged in the Deno edge
// runtime AND in a node/tsx unit test. The Claude call itself lives in the
// preview function (needs the Anthropic client); this module is the pure,
// deterministic parse/validate/apply logic + the prompt.
//
// The plan shape mirrors packages/shared-types/src/migration.ts (kept in sync by
// hand — the edge runtime can't import the workspace package).

export const CONTACT_TARGET_FIELDS = [
  'name',
  'phone',
  'email',
  'company',
  'source',
  'tags',
] as const
export type ContactTargetField = (typeof CONTACT_TARGET_FIELDS)[number]

export interface ColumnMapping {
  source: string
  target: ContactTargetField | null
  note?: string
}

export interface MigrationPlan {
  targetEntity: 'contacts'
  columnMappings: ColumnMapping[]
  warnings: string[]
  stats: { totalRows: number; mappedColumns: number; unmappedColumns: number }
}

export interface ContactPayload {
  name: string
  phone: string | null
  email: string | null
  company: string | null
  source: string | null
  tags: string[]
}

// ---------------------------------------------------------------------------
// CSV parsing (minimal RFC-4180: quoted fields, escaped quotes, CRLF).
// ---------------------------------------------------------------------------
function parseRecords(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const records = parseRecords(text)
  if (records.length === 0) return { headers: [], rows: [] }
  const headers = records[0].map((h) => h.trim())
  const rows = records
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? '').trim()
      })
      return obj
    })
  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Validate the plan object Claude returns (no zod — dependency-free).
// ---------------------------------------------------------------------------
export function validatePlan(
  obj: unknown,
  totalRows: number,
): MigrationPlan | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (o.targetEntity !== 'contacts') return null
  if (!Array.isArray(o.columnMappings)) return null

  const mappings: ColumnMapping[] = []
  for (const m of o.columnMappings) {
    if (!m || typeof m !== 'object') return null
    const mm = m as Record<string, unknown>
    if (typeof mm.source !== 'string') return null
    const target = mm.target
    if (target !== null && !CONTACT_TARGET_FIELDS.includes(target as ContactTargetField)) {
      return null
    }
    mappings.push({
      source: mm.source,
      target: target as ContactTargetField | null,
      note: typeof mm.note === 'string' ? mm.note : undefined,
    })
  }
  const warnings = Array.isArray(o.warnings)
    ? (o.warnings.filter((w) => typeof w === 'string') as string[])
    : []
  const mapped = mappings.filter((m) => m.target !== null).length
  return {
    targetEntity: 'contacts',
    columnMappings: mappings,
    warnings,
    stats: { totalRows, mappedColumns: mapped, unmappedColumns: mappings.length - mapped },
  }
}

// ---------------------------------------------------------------------------
// Apply a plan to rows → contact insert payloads (+ per-row warnings).
// ---------------------------------------------------------------------------
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function applyPlan(
  plan: MigrationPlan,
  rows: Record<string, string>[],
): { contacts: ContactPayload[]; warnings: string[]; skipped: number } {
  const warnings: string[] = []
  const contacts: ContactPayload[] = []
  let skipped = 0

  const byTarget: Partial<Record<ContactTargetField, string>> = {}
  for (const m of plan.columnMappings) if (m.target) byTarget[m.target] = m.source

  const get = (row: Record<string, string>, t: ContactTargetField): string => {
    const col = byTarget[t]
    return col ? (row[col] ?? '').trim() : ''
  }

  rows.forEach((row, idx) => {
    const line = idx + 2 // +1 for header, +1 for 1-based
    const name = get(row, 'name')
    if (!name) {
      skipped++
      warnings.push(`Row ${line}: no name — skipped.`)
      return
    }
    const rawEmail = get(row, 'email')
    let email: string | null = rawEmail || null
    if (email && !isEmail(email)) {
      warnings.push(`Row ${line}: invalid email "${email}" — imported without it.`)
      email = null
    }
    const rawTags = get(row, 'tags')
    const tags = rawTags
      ? rawTags
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : []
    contacts.push({
      name,
      phone: get(row, 'phone') || null,
      email,
      company: get(row, 'company') || null,
      source: get(row, 'source') || null,
      tags,
    })
  })

  return { contacts, warnings, skipped }
}

// ---------------------------------------------------------------------------
// Prompt + tool schema for the Claude planning call (used by migration-preview).
// ---------------------------------------------------------------------------
export const PLAN_SYSTEM =
  'You map a CSV of CRM contacts to FieldBase contact fields for an import preview. ' +
  'Fields: name (required), phone, email, company, source, tags (comma/semicolon-separated). ' +
  'Map each column by its header meaning and the sample values; use a null target to ignore a ' +
  'column. Never invent fields outside that set. Be conservative and surface concerns as warnings.'

export const PLAN_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    targetEntity: { type: 'string', enum: ['contacts'] },
    columnMappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { anyOf: [{ type: 'string', enum: [...CONTACT_TARGET_FIELDS] }, { type: 'null' }] },
          note: { type: 'string' },
        },
        required: ['source', 'target'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['targetEntity', 'columnMappings'],
} as const

export function buildPlanUserMessage(
  headers: string[],
  sampleRows: Record<string, string>[],
  instructions: string,
): string {
  return [
    `CSV headers: ${headers.join(', ')}`,
    'Sample rows (up to 5):',
    JSON.stringify(sampleRows.slice(0, 5), null, 2),
    '',
    `Import instructions: ${instructions || '(none provided)'}`,
    '',
    'Map each CSV column to a contact field or null to ignore it, then call emit_migration_plan.',
  ].join('\n')
}
