/** Centralized React Query keys so reads and mutations invalidate consistently. */
export const queryKeys = {
  contacts: {
    all: ['contacts'] as const,
    list: (search?: string) => ['contacts', 'list', search ?? ''] as const,
    detail: (id: string) => ['contacts', 'detail', id] as const,
  },
  deals: {
    all: ['deals'] as const,
    list: () => ['deals', 'list'] as const,
    byContact: (contactId: string) => ['deals', 'byContact', contactId] as const,
  },
}
