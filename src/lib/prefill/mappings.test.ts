import { describe, expect, it } from "vitest";
import {
  aggregate,
  allMappings,
  mappingsForCategory,
  readFieldPath,
} from "./mappings";

describe("readFieldPath", () => {
  it("walks a dot-path into nested objects", () => {
    const obj = { boxes: { box1_wages: 75000, box15_state: "TX" } };
    expect(readFieldPath(obj, "boxes.box1_wages")).toBe(75000);
    expect(readFieldPath(obj, "boxes.box15_state")).toBe("TX");
  });

  it("returns undefined for a missing segment", () => {
    const obj = { boxes: { box1_wages: 75000 } };
    expect(readFieldPath(obj, "boxes.box2_federalTaxWithheld")).toBeUndefined();
  });

  it("returns undefined when an intermediate value is null", () => {
    expect(readFieldPath({ a: null }, "a.b.c")).toBeUndefined();
    expect(readFieldPath(null, "a.b")).toBeUndefined();
    expect(readFieldPath(undefined, "a.b")).toBeUndefined();
  });

  it("treats a final null as undefined (skips it during aggregation)", () => {
    expect(readFieldPath({ a: { b: null } }, "a.b")).toBeUndefined();
  });
});

describe("aggregate", () => {
  it("sum: totals all numeric values, ignores null/undefined", () => {
    expect(aggregate([1000, null, 2000, undefined, 500], "sum")).toBe(3500);
  });

  it("sum: returns undefined when no numerics are present", () => {
    expect(aggregate([null, undefined], "sum")).toBeUndefined();
    expect(aggregate([], "sum")).toBeUndefined();
  });

  it("sum: ignores non-numeric (string) values entirely", () => {
    expect(aggregate(["75000", 1000], "sum")).toBe(1000);
  });

  it("first: returns the first non-null value", () => {
    expect(aggregate([null, undefined, "TX", "CA"], "first")).toBe("TX");
  });

  it("first: returns undefined when nothing is present", () => {
    expect(aggregate([null, undefined], "first")).toBeUndefined();
  });
});

describe("mappings registry", () => {
  it("exposes W-2 → individual 1040 wage mappings", () => {
    const w2 = mappingsForCategory("W2");
    expect(w2.length).toBeGreaterThan(0);
    expect(w2.some((m) => m.questionId === "1040-WS-005")).toBe(true);
  });

  it("exposes 1099-INT mappings", () => {
    const int = mappingsForCategory("F1099_INT");
    expect(int.length).toBeGreaterThan(0);
  });

  it("every mapping has aggregation mode + non-empty fieldPath", () => {
    for (const m of allMappings()) {
      expect(m.aggregation === "first" || m.aggregation === "sum").toBe(true);
      expect(m.fieldPath.length).toBeGreaterThan(0);
      expect(m.questionId.length).toBeGreaterThan(0);
    }
  });
});
