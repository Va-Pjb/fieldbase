import { DEAL_STAGES, type Deal } from '../../lib/api/deals'
import Column from './Column'

export default function Board({
  deals,
  contactNames,
}: {
  deals: Deal[]
  contactNames: Record<string, string>
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {DEAL_STAGES.map((stage) => (
        <Column
          key={stage}
          stage={stage}
          deals={deals.filter((d) => d.stage === stage)}
          contactNames={contactNames}
        />
      ))}
    </div>
  )
}
