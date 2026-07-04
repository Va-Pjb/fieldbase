import { z } from 'zod'

/**
 * Shared Zod schemas / types for FieldBase, consumed by both the web app and
 * the MCP server. Expanded phase by phase; Phase 0 seeds the Contact schema as
 * the cross-package linkage proof.
 */

export const ContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  company: z.string().nullable(),
  source: z.string().nullable(),
  tags: z.array(z.string()).default([]),
})

export type Contact = z.infer<typeof ContactSchema>

export const SHARED_TYPES_VERSION = '0.0.0'

// Generated Supabase database types (single source for web + MCP server).
export * from './database.types'

// AI Migration Wizard plan types (Phase 3).
export * from './migration'

// AI Automation Layer types (Phase 4).
export * from './automation'

// Communication types (Phase 5).
export * from './communication'
