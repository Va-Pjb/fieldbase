// Automation core — dependency-free TS so it runs unchanged in the Deno edge
// runtime AND in a node/tsx unit test. The Claude calls live in the edge
// functions (they need the Anthropic client); this module is the pure,
// deterministic validate/select logic + the prompts + schemas.
//
// Shapes mirror packages/shared-types/src/automation.ts (kept in sync by hand —
// the edge runtime can't import the workspace package).

export const TRIGGER_TYPES = ['lead_no_contact'] as const
export type TriggerType = (typeof TRIGGER_TYPES)[number]

export const ACTION_TYPES = ['draft_followup'] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export const CHANNELS = ['email', 'sms'] as const
export type Channel = (typeof CHANNELS)[number]

const MIN_HOURS = 1
const MAX_HOURS = 720 // 30 days
const DEFAULT_HOURS = 24

export interface AutomationRule {
  name: string
  triggerType: TriggerType
  triggerConfig: { withinHours: number }
  actionType: ActionType
  actionConfig: { channel: Channel; tone?: string }
}

// ---------------------------------------------------------------------------
// Validate the flattened rule object Claude emits → a whitelisted rule.
// Like crm_query, unknown/unsupported requests are refused (recognized=false),
// and every field is clamped to a safe range — never free-form execution.
// ---------------------------------------------------------------------------
export function validateRule(obj: unknown): AutomationRule | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (o.recognized !== true) return null
  if (o.triggerType !== undefined && !TRIGGER_TYPES.includes(o.triggerType as TriggerType)) return null
  if (o.actionType !== undefined && !ACTION_TYPES.includes(o.actionType as ActionType)) return null

  const rawHours = typeof o.withinHours === 'number' ? o.withinHours : Number(o.withinHours)
  const withinHours = Number.isFinite(rawHours)
    ? Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(rawHours)))
    : DEFAULT_HOURS

  const channel = CHANNELS.includes(o.channel as Channel) ? (o.channel as Channel) : 'email'
  const tone = typeof o.tone === 'string' && o.tone.trim() ? o.tone.trim() : undefined
  const name =
    typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Missed-lead follow-up'

  return {
    name,
    triggerType: 'lead_no_contact',
    triggerConfig: { withinHours },
    actionType: 'draft_followup',
    actionConfig: tone ? { channel, tone } : { channel },
  }
}

/** Map a validated rule to an `automations` insert payload. */
export function ruleToAutomationRow(rule: AutomationRule, naturalLanguageSource: string) {
  return {
    name: rule.name,
    trigger_type: rule.triggerType,
    trigger_config: rule.triggerConfig,
    action_type: rule.actionType,
    action_config: rule.actionConfig,
    natural_language_source: naturalLanguageSource,
    is_active: true,
  }
}

export const RULE_SYSTEM =
  'You convert a plain-English automation request into ONE structured rule by ' +
  'calling emit_automation_rule. You never write code or free-form logic.\n\n' +
  'The ONLY supported automation is a missed-lead follow-up:\n' +
  '- trigger "lead_no_contact": a lead with no contact for withinHours hours\n' +
  '- action "draft_followup": draft a follow-up on channel "email" or "sms" ' +
  '(optional tone)\n\n' +
  'Set recognized=true and fill the fields only if the request is clearly this ' +
  'kind of automation. If it asks for anything else (bulk deletes, exports, ' +
  'unrelated tasks), set recognized=false. Give the rule a short human name. ' +
  'Never invent trigger/action types beyond those listed.'

export const RULE_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    recognized: {
      type: 'boolean',
      description: 'true only if this is a supported missed-lead follow-up automation',
    },
    name: { type: 'string', description: 'short human name for the rule' },
    triggerType: { type: 'string', enum: [...TRIGGER_TYPES] },
    withinHours: {
      type: 'integer',
      description: 'hours with no contact before a lead is followed up (e.g. 24)',
    },
    actionType: { type: 'string', enum: [...ACTION_TYPES] },
    channel: { type: 'string', enum: [...CHANNELS] },
    tone: { type: 'string', description: 'optional tone hint, e.g. "warm and brief"' },
  },
  required: ['recognized'],
} as const

export function buildRuleMessage(instructions: string): string {
  return `Automation request:\n${instructions}\n\nCall emit_automation_rule.`
}

// ---------------------------------------------------------------------------
// Cold-lead selection (pure + deterministic; `now` is injected for testing).
// A contact is a cold lead when it is a lead (has an open 'lead'-stage deal, or
// has never been interacted with) AND its last activity — last interaction, or
// creation if none — is older than the window.
// ---------------------------------------------------------------------------
export interface LeadContext {
  contacts: { id: string; name: string; created_at: string }[]
  deals: { contact_id: string; stage: string }[]
  interactions: { contact_id: string; occurred_at: string }[]
}

export interface ColdLead {
  contactId: string
  name: string
  reason: string
  lastActivityMs: number
}

export function selectColdLeads(ctx: LeadContext, withinHours: number, nowMs: number): ColdLead[] {
  const cutoff = nowMs - withinHours * 3_600_000
  const leadContactIds = new Set(
    ctx.deals.filter((d) => d.stage === 'lead').map((d) => d.contact_id),
  )
  const lastByContact = new Map<string, number>()
  const countByContact = new Map<string, number>()
  for (const i of ctx.interactions) {
    countByContact.set(i.contact_id, (countByContact.get(i.contact_id) ?? 0) + 1)
    const t = Date.parse(i.occurred_at)
    if (!Number.isNaN(t)) {
      lastByContact.set(i.contact_id, Math.max(lastByContact.get(i.contact_id) ?? 0, t))
    }
  }

  const cold: ColdLead[] = []
  for (const c of ctx.contacts) {
    const interactionCount = countByContact.get(c.id) ?? 0
    const isLead = leadContactIds.has(c.id) || interactionCount === 0
    if (!isLead) continue
    const createdMs = Date.parse(c.created_at)
    const lastActivityMs = lastByContact.get(c.id) ?? (Number.isNaN(createdMs) ? 0 : createdMs)
    if (lastActivityMs < cutoff) {
      cold.push({
        contactId: c.id,
        name: c.name,
        reason:
          interactionCount === 0
            ? 'New lead, never contacted'
            : `No contact in the last ${withinHours}h`,
        lastActivityMs,
      })
    }
  }
  cold.sort((a, b) => a.lastActivityMs - b.lastActivityMs) // most overdue first
  return cold
}

// ---------------------------------------------------------------------------
// Draft prompt — one Claude call drafts a message per lead (echoing contactId).
// ---------------------------------------------------------------------------
export const DRAFT_SYSTEM =
  'You draft short follow-up messages for a home-service business (trades, ' +
  'clinics) reaching out to leads it has not contacted recently. For each lead ' +
  'write ONE message of 2-3 sentences suited to the channel: use the person\'s ' +
  'first name, sound warm and professional, offer to help or answer questions, ' +
  'and invite a reply. Do not invent specifics (prices, dates, appointment ' +
  'times) and do not use placeholders like [Name]. Call emit_followup_drafts ' +
  'with one entry per lead, echoing each contactId exactly.'

export const DRAFT_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['contactId', 'body'],
      },
    },
  },
  required: ['drafts'],
} as const

export function buildDraftMessage(
  leads: { contactId: string; name: string; company?: string | null; reason: string }[],
  channel: Channel,
  tone?: string,
): string {
  return [
    `Channel: ${channel}`,
    tone ? `Tone: ${tone}` : '',
    '',
    'Leads to follow up (write one message each, echo the contactId):',
    JSON.stringify(
      leads.map((l) => ({
        contactId: l.contactId,
        name: l.name,
        company: l.company ?? null,
        reason: l.reason,
      })),
      null,
      2,
    ),
  ]
    .filter((line) => line !== '')
    .join('\n')
}
