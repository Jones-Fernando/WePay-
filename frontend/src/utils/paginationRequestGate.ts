export type PaginationRequestTicket = {
  generation: number;
  requestId: number;
};

export function createPaginationRequestGate() {
  let generation = 0;
  let requestId = 0;
  let active = false;
  let firstPagePending = false;
  let activePageRequest: PaginationRequestTicket | null = null;

  function isCurrent(currentGeneration: number) {
    return active && generation === currentGeneration;
  }

  return {
    activate() {
      active = true;
    },

    beginFirstPage() {
      generation += 1;
      firstPagePending = true;
      activePageRequest = null;
      return generation;
    },

    finishFirstPage(currentGeneration: number) {
      if (isCurrent(currentGeneration)) firstPagePending = false;
    },

    beginNextPage(): PaginationRequestTicket | null {
      if (!active || firstPagePending || activePageRequest) return null;
      activePageRequest = { generation, requestId: ++requestId };
      return activePageRequest;
    },

    isCurrent(currentGeneration: number) {
      return isCurrent(currentGeneration);
    },

    isCurrentPage(ticket: PaginationRequestTicket) {
      return (
        isCurrent(ticket.generation)
        && activePageRequest === ticket
      );
    },

    finishNextPage(ticket: PaginationRequestTicket) {
      if (activePageRequest === ticket) activePageRequest = null;
    },

    invalidate() {
      active = false;
      generation += 1;
      firstPagePending = false;
      activePageRequest = null;
    },
  };
}

export function appendUniqueById<T extends { id: number | string }>(
  current: T[],
  incoming: T[],
): T[] {
  const knownIds = new Set(current.map((item) => String(item.id)));
  return [
    ...current,
    ...incoming.filter((item) => {
      const id = String(item.id);
      if (knownIds.has(id)) return false;
      knownIds.add(id);
      return true;
    }),
  ];
}
