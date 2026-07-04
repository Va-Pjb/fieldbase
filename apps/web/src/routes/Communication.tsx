import ReviewQueue from '../components/comms/ReviewQueue'

// The Communication module. v1: review requests for completed jobs. Every send
// is drafted by AI, then reviewed and approved by a human here — never silent.
export default function Communication() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised px-6 py-5 md:px-10">
        <p className="font-body text-label uppercase text-brand">Communication</p>
        <h1 className="mt-1 font-display text-title text-ink">Review requests</h1>
        <p className="mt-1 max-w-2xl font-body text-small text-slate">
          Ask happy customers for a review after a completed job. FieldBase drafts each message
          from the job details — you review and approve every send. Nothing goes out on its own.
        </p>
      </header>

      <div className="px-6 py-8 md:px-10">
        <ReviewQueue />
      </div>
    </div>
  )
}
