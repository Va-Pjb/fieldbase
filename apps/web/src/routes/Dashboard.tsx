import { useDashboard } from '../hooks/useDashboard'
import { money } from '../lib/format'
import QueryBar from '../components/insights/QueryBar'
import StatTile from '../components/insights/StatTile'
import PipelineByStage from '../components/insights/PipelineByStage'
import SourceBreakdown from '../components/insights/SourceBreakdown'
import TrendSparkline from '../components/insights/TrendSparkline'

function LoadingState() {
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ticket h-[104px] animate-pulse bg-paper-sunken" />
      ))}
    </section>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3">
      <p className="font-body text-small text-danger">Couldn’t load analytics: {message}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard()

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">Insights</p>
        <h1 className="mt-1 font-display text-title text-ink">Dashboard</h1>
      </header>

      <div className="space-y-10 px-6 py-8 md:px-10">
        <QueryBar />

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={(error as Error).message} />
        ) : data ? (
          <>
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Open pipeline" value={money(data.openPipelineValue)} sub="in progress" />
              <StatTile label="Won" value={money(data.wonValue)} sub="closed won" />
              <StatTile
                label="Win rate"
                value={`${Math.round(data.winRate.rate * 100)}%`}
                sub={`${data.winRate.won} won · ${data.winRate.lost} lost`}
              />
              <StatTile
                label="Activity"
                value={String(data.interactionsLast30d)}
                sub="last 30 days"
              />
            </section>

            <section className="space-y-4">
              <h2 className="font-display text-heading text-ink">Pipeline value by stage</h2>
              <PipelineByStage data={data.pipelineByStage} counts={data.dealsByStage} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="font-display text-heading text-ink">Leads by source</h2>
                <SourceBreakdown data={data.contactsBySource} />
              </div>
              <div className="space-y-4">
                <h2 className="font-display text-heading text-ink">New contacts</h2>
                <TrendSparkline data={data.monthlyNewContacts} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
