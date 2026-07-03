import { useAutomations } from '../hooks/useAutomations'
import RuleBuilder from '../components/automations/RuleBuilder'
import RuleCard from '../components/automations/RuleCard'
import FollowupQueue from '../components/automations/FollowupQueue'

export default function Automations() {
  const { data: automations, isLoading, isError, error } = useAutomations()

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">Automate</p>
        <h1 className="mt-1 font-display text-title text-ink">Automations</h1>
      </header>

      <div className="space-y-10 px-6 py-8 md:px-10">
        <section className="space-y-5">
          <h2 className="font-display text-heading text-ink">Build an automation</h2>
          <RuleBuilder />

          {isLoading ? (
            <p className="font-body text-small text-slate">Loading automations…</p>
          ) : isError ? (
            <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3">
              <p className="font-body text-small text-danger">
                Couldn’t load automations: {(error as Error).message}
              </p>
            </div>
          ) : automations && automations.length > 0 ? (
            <div className="grid gap-4 md:max-w-3xl">
              {automations.map((a) => (
                <RuleCard key={a.id} automation={a} />
              ))}
            </div>
          ) : (
            <div className="field-grid flex min-h-[160px] items-center justify-center rounded-card border border-line">
              <p className="max-w-md px-6 text-center font-body text-body text-slate">
                No automations yet. Describe one above — e.g. “follow up with leads we haven’t
                contacted in a day”.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="font-display text-heading text-ink">Missed-lead follow-ups</h2>
            <p className="mt-1 max-w-2xl font-body text-small text-slate">
              Scan for leads that have gone quiet. The assistant drafts a message for each — you
              review and approve before anything sends.
            </p>
          </div>
          <FollowupQueue />
        </section>
      </div>
    </div>
  )
}
