/**
 * AI Migration Wizard plan types (Phase 3). Shared by the web UI and the MCP
 * server; the Supabase edge functions validate against an equivalent zod schema.
 */

export type MigrationTargetEntity = 'contacts'

/** Contact fields a CSV column may map to (null target = ignore the column). */
export const CONTACT_TARGET_FIELDS = [
  'name',
  'phone',
  'email',
  'company',
  'source',
  'tags',
] as const
export type ContactTargetField = (typeof CONTACT_TARGET_FIELDS)[number]

export interface MigrationColumnMapping {
  /** CSV header. */
  source: string
  /** Mapped contact field, or null to ignore the column. */
  target: ContactTargetField | null
  /** Human-readable transform note, e.g. "trim whitespace", "split into tags". */
  note?: string
}

export interface MigrationPlan {
  targetEntity: MigrationTargetEntity
  columnMappings: MigrationColumnMapping[]
  warnings: string[]
  stats: {
    totalRows: number
    mappedColumns: number
    unmappedColumns: number
  }
}

export interface MigrationPreviewResult {
  jobId: string
  plan: MigrationPlan
  /** A few transformed contacts, for the review step. */
  sample: Record<string, string | null>[]
}

export interface MigrationExecuteResult {
  jobId: string
  imported: number
  skipped: number
  warnings: string[]
}
