import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatDocumentListDate } from "./formatDocumentListDate";

const normalizeSpaces = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

describe("formatDocumentListDate", () => {
  beforeAll(() => { vi.stubEnv("TZ", "America/Costa_Rica"); });
  afterAll(() => { vi.unstubAllEnvs(); });

  it.each([
    ["2026-10-24T00:35:00Z", "23 oct 2026, 06:35 p. m."],
    ["2026-10-23T12:35:00Z", "23 oct 2026, 06:35 a. m."],
    ["2026-10-24T06:00:00Z", "24 oct 2026, 12:00 a. m."],
    ["2026-10-24T18:00:00Z", "24 oct 2026, 12:00 p. m."],
  ])("preserves Audit's existing output for %s in an explicit timezone", (iso, expected) => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Costa_Rica");
    expect(normalizeSpaces(formatDocumentListDate(iso))).toBe(expected);
  });

  it("preserves the instant when the input specifies an offset", () => {
    expect(formatDocumentListDate("2026-10-23T18:35:00-06:00"))
      .toBe(formatDocumentListDate("2026-10-24T00:35:00Z"));
  });

  it("uses the runtime timezone instead of imposing a product timezone", () => {
    vi.stubEnv("TZ", "UTC");
    try {
      expect(normalizeSpaces(formatDocumentListDate("2026-10-24T00:35:00Z")))
        .toBe("24 oct 2026, 12:35 a. m.");
    } finally {
      vi.stubEnv("TZ", "America/Costa_Rica");
    }
  });
});
