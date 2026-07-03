import { useSetAutomationActive } from '../../hooks/useAutomations'
import type { Automation } from '../../lib/api/automations'

// Render the stored rule as plain English. trigger_config/action_config are
// jsonb, so read them defensively.
function describe(a: Automation): { when: string; then: string } {
  const tc = (a.trigger_config ?? {}) as { withinHours?: number }
  const ac = (a.action_config ?? {}) as { channel?: string; tone?: string }
  const when =
    a.trigger_type === 'lead_no_contact'
      ? `a lead has had no contact for ${tc.withinHours ?? 24}h`
      : a.trigger_type
  const channel = ac.channel ?? 'email'
  const then =
    a.action_type === 'draft_followup'
      ? `draft a${channel === 'email' ? 'n' : ''} ${channel} follow-up${ac.tone ? ` (${ac.tone})` : ''}`
      : a.action_type
  return { when, then }
}

export default function RuleCard({ automation }: { automation: Automation }) {
  const toggle = useSetAutomationActive()
  const { when, then } = describe(automation)
  const active = automation.is_active

  return (
    <div className="ticket p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-heading text-ink">{automation.name}</h3>
          <p className="mt-1 font-body text-small text-slate">
            When <span className="text-ink">{when}</span>, {then}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle.mutate({ id: automation.id, isActive: !active })}
          disabled={toggle.isPending}
          aria-pressed={active}
          className={
            'shrink-0 rounded-full border px-3 py-1 font-body text-label uppercase transition-colors disabled:opacity-60 ' +
            (active
              ? 'border-positive/40 bg-positive/10 text-positive'
              : 'border-line bg-paper-sunken text-slate')
          }
        >
          {active ? 'Active' : 'Paused'}
        </button>
      </div>
      {automation.natural_language_source && (
        <p className="ticket__perf mt-4 pt-3 font-mono text-small text-slate">
          “{automation.natural_language_source}”
        </p>
      )}
    </div>
  )
}
