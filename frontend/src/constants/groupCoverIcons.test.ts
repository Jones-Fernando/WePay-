import { GROUP_COVER_ICONS } from "./groupCoverIcons";

describe("group cover icon options", () => {
  it("provides a broad, unique palette for custom group options", () => {
    const icons = GROUP_COVER_ICONS.map(({ icone }) => icone);

    expect(icons.length).toBeGreaterThanOrEqual(50);
    expect(new Set(icons).size).toBe(icons.length);
    expect(GROUP_COVER_ICONS.every(({ label }) => label.length > 0)).toBe(true);
    expect(icons).toContain("👥");
    expect(icons).toContain("✈️");
    expect(icons).toContain("🏖️");
    expect(icons).toContain("🎲");
    expect(icons).toContain("🚇");
    expect(icons).toContain("🧾");
    expect(icons).toContain("💳");
    expect(icons).toContain("🎭");
    expect(icons).toContain("🧩");
    expect(icons).toContain("🌲");
    expect(icons).toContain("🏝️");
    expect(icons).toContain("🌊");
    expect(icons).toContain("🏞️");
    expect(icons).toContain("🦋");
  });
});
