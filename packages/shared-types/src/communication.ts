/**
 * Communication types (Phase 5). Shared by the web UI and the MCP server; the
 * Supabase edge functions validate against equivalent checks.
 *
 * Covers the never-silent review-request spine (draft -> approve -> send,
 * mirroring the Phase 4 follow-up spine), the unified contact timeline, and the
 * public booking / FAQ widget.
 */

export const REVIEW_CHANNELS = ['email', 'sms'] as const
export type ReviewChannel = (typeof REVIEW_CHANNELS)[number]

export const REVIEW_STATUSES = ['draft', 'approved', 'sending', 'sent', 'failed'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const APPOINTMENT_STATUSES = [
  'requested',
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const INTERACTION_TYPES = ['call', 'email', 'note', 'sms'] as const
export type InteractionType = (typeof INTERACTION_TYPES)[number]

/**
 * One drafted review request, returned by review_request_draft. Persisted as a
 * review_requests row with status='draft' — nothing is sent until an explicit
 * review_request_send call names its reviewId.
 */
export interface ReviewDraft {
  reviewId: string
  contactId: string
  contactName: string
  /** Title of the won deal (completed job) the review is for. */
  dealTitle: string
  channel: ReviewChannel
  body: string
}

export interface ReviewDraftResult {
  drafts: ReviewDraft[]
  /** Eligible won deals found (may exceed drafts.length when capped). */
  scanned: number
  /** True if the batch was capped below `scanned`. */
  capped: boolean
}

export interface ReviewSendResult {
  reviewId: string
  contactId: string
  interactionId: string
  channel: ReviewChannel
}

/**
 * A single event in the unified contact timeline — a merge of interactions,
 * appointments, and review_requests, sorted by `at` (desc). Discriminated on
 * `kind`.
 */
interface TimelineEventBase {
  id: string
  /** ISO timestamp used to sort the merged stream. */
  at: string
}
export interface InteractionTimelineEvent extends TimelineEventBase {
  kind: 'interaction'
  interactionType: InteractionType
  content: string | null
  aiSummary: string | null
}
export interface AppointmentTimelineEvent extends TimelineEventBase {
  kind: 'appointment'
  status: AppointmentStatus
  startTime: string
  endTime: string
  notes: string | null
}
export type TimelineEvent = InteractionTimelineEvent | AppointmentTimelineEvent

/** Raw interaction row (subset) fed into buildTimeline (type as it comes from the DB). */
export interface TimelineInteractionRow {
  id: string
  type: string
  content: string | null
  ai_summary: string | null
  occurred_at: string
}
/** Raw appointment row (subset) fed into buildTimeline (status as it comes from the DB). */
export interface TimelineAppointmentRow {
  id: string
  status: string
  start_time: string
  end_time: string
  notes: string | null
}

/**
 * Merge interactions + appointments into one timeline, most-recent first.
 * review_requests are intentionally NOT merged: a sent review is already an
 * interactions row (see review-request-send), so merging it too would
 * double-count. Appointments are their own table and must be merged.
 */
export function buildTimeline(
  interactions: TimelineInteractionRow[],
  appointments: TimelineAppointmentRow[],
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  for (const i of interactions) {
    events.push({
      kind: 'interaction',
      id: i.id,
      at: i.occurred_at,
      interactionType: i.type as InteractionType,
      content: i.content,
      aiSummary: i.ai_summary,
    })
  }
  for (const a of appointments) {
    events.push({
      kind: 'appointment',
      id: a.id,
      at: a.start_time,
      status: a.status as AppointmentStatus,
      startTime: a.start_time,
      endTime: a.end_time,
      notes: a.notes,
    })
  }
  return events.sort((x, y) => Date.parse(y.at) - Date.parse(x.at))
}

export interface ContactSummaryResult {
  /** Claude-generated relationship summary, or null if none generated yet. */
  summary: string | null
  /** ISO timestamp the summary was generated, or null. */
  updatedAt: string | null
}

/** Owner-configured profile backing the public booking / FAQ widget. */
export interface WidgetConfig {
  publicToken: string
  businessName: string | null
  services: string | null
  hours: string | null
  faq: string | null
  reviewLink: string | null
  isEnabled: boolean
}

/**
 * A visitor's booking request captured by the widget. The widget writes it as a
 * status='requested' appointment; the owner confirms it (-> 'scheduled') in-app.
 */
export interface WidgetBookingInput {
  name: string
  email?: string
  phone?: string
  /** ISO start time requested by the visitor. */
  startTime: string
  /** ISO end time; optional — the server defaults it to start + 1h. */
  endTime?: string
  notes?: string
}

export interface WidgetAskResult {
  answer: string
}

export interface WidgetBookingResult {
  status: 'requested'
  appointmentId: string
}
