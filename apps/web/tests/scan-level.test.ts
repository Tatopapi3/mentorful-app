import { describe, expect, it } from "vitest";
import { LEVEL_WORD, LOW_BELOW, WATCH_BELOW, scanLevel } from "@/lib/admin/scan-level";

describe("the Culture Scan warning levels", () => {
  it("calls an average under the scale's middle (3.5) low", () => {
    expect(scanLevel(2.6)).toBe("low");
    expect(scanLevel(3.49)).toBe("low");
  });
  it("calls 3.5 up to 4.5 watch, and 4.5 and above on track", () => {
    expect(scanLevel(3.5)).toBe("watch");
    expect(scanLevel(4.2)).toBe("watch");
    expect(scanLevel(4.49)).toBe("watch");
    expect(scanLevel(4.5)).toBe("ok");
    expect(scanLevel(5.1)).toBe("ok");
  });
  it("keeps the cutoffs and words in one place", () => {
    expect([LOW_BELOW, WATCH_BELOW]).toEqual([3.5, 4.5]);
    expect(LEVEL_WORD).toEqual({ low: "Low", watch: "Watch", ok: "On track" });
  });
});
