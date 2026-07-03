/**
 * AI Automation Layer types (Phase 4). Shared by the web UI and the MCP server;
 * the Supabase edge functions validate against an equivalent check.
 *
 * Like crm_query's query plan, the AI fills in a **validated, whitelisted** rule
 * shape — it never emits free-form or executable logic. v1 supports one recipe
 * (missed-lead follow-up); the shapes are structured to extend later.
 */

export const AUTOMATION_TRIGGER_TYPES = ['lead_no_contact'] as const
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number]

export const AUTOMATION_ACTION_TYPES = ['draft_followup'] as const
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number]

export const FOLLOWUP_CHANNELS = ['email', 'sms'] as const
export type FollowupChannel = (typeof FOLLOWUP_CHANNELS)[number]

/** trigger_config for `lead_no_contact`. */
export interface LeadNoContactConfig {
  /** Hours since the lead's last interaction before it counts as cold. */
  withinHours: number
}

/** action_config for `draft_followup`. */
export interface DraftFollowupConfig {
  channel: FollowupChannel
  /** Optional tone hint for the drafted message, e.g. "warm and brief". */
  tone?: string
}

/**
 * A validated, whitelisted automation rule — the only shape automation_create
 * will store. Unknown trigger/action types are rejected, never persisted.
 */
export interface AutomationRule {
  name: string
  triggerType: AutomationTriggerType
  triggerConfig: LeadNoContactConfig
  actionType: AutomationActionType
  actionConfig: DraftFollowupConfig
}

export interface AutomationCreateResult {
  automationId: string
  rule: AutomationRule
}

export interface FollowupDraft {
  draftId: string
  contactId: string
  contactName: string
  channel: FollowupChannel
  body: string
  /** Why this lead was flagged, e.g. "No contact in the last 24h". */
  reason: string
}

export interface FollowupDraftResult {
  drafts: FollowupDraft[]
  /** Total cold leads found (may exceed drafts.length when capped). */
  scanned: number
  /** True if the batch was capped below `scanned`. */
  capped: boolean
}

export interface FollowupSendResult {
  draftId: string
  contactId: string
  interactionId: string
  channel: FollowupChannel
}
