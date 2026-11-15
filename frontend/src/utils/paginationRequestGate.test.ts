import {
  appendUniqueById,
  createPaginationRequestGate,
} from "@/utils/paginationRequestGate";

describe("pagination request gate", () => {
  it("discards old pages after refresh and keeps the new page lock intact", () => {
    const gate = createPaginationRequestGate();
    gate.activate();

    const firstGeneration = gate.beginFirstPage();
    gate.finishFirstPage(firstGeneration);
    const oldPage = gate.beginNextPage();
    expect(oldPage).not.toBeNull();
    expect(gate.beginNextPage()).toBeNull();

    const refreshedGeneration = gate.beginFirstPage();
    expect(gate.isCurrent(firstGeneration)).toBe(false);
    expect(gate.beginNextPage()).toBeNull();
    gate.finishFirstPage(refreshedGeneration);
    const currentPage = gate.beginNextPage();
    expect(currentPage).not.toBeNull();

    expect(gate.isCurrentPage(oldPage!)).toBe(false);
    gate.finishNextPage(oldPage!);
    expect(gate.beginNextPage()).toBeNull();
    expect(gate.isCurrentPage(currentPage!)).toBe(true);

    gate.finishNextPage(currentPage!);
    expect(gate.beginNextPage()).not.toBeNull();
  });

  it("rejects requests from a screen that is no longer focused", () => {
    const gate = createPaginationRequestGate();
    gate.activate();
    const generation = gate.beginFirstPage();

    gate.invalidate();

    expect(gate.isCurrent(generation)).toBe(false);
    gate.finishFirstPage(generation);
    expect(gate.beginNextPage()).toBeNull();
  });
});

describe("appendUniqueById", () => {
  it("does not duplicate rows repeated across pages", () => {
    const current = [{ id: 1, descricao: "A" }, { id: "2", descricao: "B" }];
    const incoming = [
      { id: 2, descricao: "B duplicada" },
      { id: 3, descricao: "C" },
    ];

    expect(appendUniqueById(current, incoming)).toEqual([
      ...current,
      { id: 3, descricao: "C" },
    ]);
  });
});
