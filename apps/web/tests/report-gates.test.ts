import { describe, expect, it } from "vitest";
import { NETWORK_MIN_RESPONDENTS, networkAllowed, participation, respondentLabel } from "@/lib/report/gates";

describe("the 60% participation gate", () => {
  it("needs 60% of the roster, rounded up", () => {
    expect(participation(30, 50)).toEqual({ status: "ok", required: 30 });
    expect(participation(29, 50)).toEqual({ status: "below", required: 30, short: 1 });
    expect(participation(18, 29)).toEqual({ status: "ok", required: 18 }); // 17.4 rounds up to 18
    expect(participation(17, 29)).toEqual({ status: "below", required: 18, short: 1 });
  });
  it("cannot be measured without a headcount, and says so instead of guessing", () => {
    expect(participation(40, null)).toEqual({ status: "no-headcount" });
    expect(participation(40, 0)).toEqual({ status: "no-headcount" });
    expect(participation(40, undefined)).toEqual({ status: "no-headcount" });
  });
});

describe("the network minimum", () => {
  it("is 25 respondents", () => {
    expect(NETWORK_MIN_RESPONDENTS).toBe(25);
    expect(networkAllowed(24)).toBe(false);
    expect(networkAllowed(25)).toBe(true);
  });
});

describe("saying who the respondents are", () => {
  it("never calls demo rows real", () => {
    expect(respondentLabel(56, 50)).toBe("n=56 (6 real, 50 demo)");
    expect(respondentLabel(56, 56)).toBe("n=56 · demo");
    expect(respondentLabel(6, 0)).toBe("n=6");
  });
});
