import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  evaluateConditions,
  evaluateConditionGroups,
  isQuestionVisible,
  isSectionVisible,
  getAnswerKey,
  getScopedAnswer,
} from "./condition-evaluator";
import type {
  AnswerMap,
  Condition,
  ConditionGroup,
  Question,
  Section,
} from "./types";

const map = (entries: Record<string, unknown>): AnswerMap =>
  new Map(Object.entries(entries));

describe("evaluateCondition", () => {
  it("eq: returns true on equal value, false otherwise", () => {
    const c: Condition = { questionId: "q1", operator: "eq", value: "yes" };
    expect(evaluateCondition(c, map({ q1: "yes" }))).toBe(true);
    expect(evaluateCondition(c, map({ q1: "no" }))).toBe(false);
    expect(evaluateCondition(c, map({}))).toBe(false);
  });

  it("neq: returns true when not equal, including for missing answer", () => {
    const c: Condition = { questionId: "q1", operator: "neq", value: "yes" };
    expect(evaluateCondition(c, map({ q1: "no" }))).toBe(true);
    expect(evaluateCondition(c, map({ q1: "yes" }))).toBe(false);
    expect(evaluateCondition(c, map({}))).toBe(true);
  });

  it("gt/gte/lt/lte: only true for numeric answers", () => {
    expect(
      evaluateCondition({ questionId: "q1", operator: "gt", value: 10 }, map({ q1: 11 }))
    ).toBe(true);
    expect(
      evaluateCondition({ questionId: "q1", operator: "gt", value: 10 }, map({ q1: 10 }))
    ).toBe(false);
    expect(
      evaluateCondition({ questionId: "q1", operator: "gte", value: 10 }, map({ q1: 10 }))
    ).toBe(true);
    expect(
      evaluateCondition({ questionId: "q1", operator: "lt", value: 10 }, map({ q1: 9 }))
    ).toBe(true);
    expect(
      evaluateCondition({ questionId: "q1", operator: "lte", value: 10 }, map({ q1: 10 }))
    ).toBe(true);
    expect(
      evaluateCondition({ questionId: "q1", operator: "gt", value: 10 }, map({ q1: "11" }))
    ).toBe(false);
  });

  it("in/not_in: array membership", () => {
    const inC: Condition = { questionId: "q1", operator: "in", value: ["a", "b"] };
    const notInC: Condition = { questionId: "q1", operator: "not_in", value: ["a", "b"] };
    expect(evaluateCondition(inC, map({ q1: "a" }))).toBe(true);
    expect(evaluateCondition(inC, map({ q1: "c" }))).toBe(false);
    expect(evaluateCondition(notInC, map({ q1: "c" }))).toBe(true);
    expect(evaluateCondition(notInC, map({ q1: "a" }))).toBe(false);
    expect(
      evaluateCondition(
        { questionId: "q1", operator: "in", value: "not-an-array" },
        map({ q1: "x" })
      )
    ).toBe(false);
  });

  it("contains: works for strings and arrays", () => {
    expect(
      evaluateCondition(
        { questionId: "q1", operator: "contains", value: "foo" },
        map({ q1: "barfoobaz" })
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { questionId: "q1", operator: "contains", value: "MN" },
        map({ q1: ["MN", "WI"] })
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { questionId: "q1", operator: "contains", value: "foo" },
        map({ q1: 123 })
      )
    ).toBe(false);
  });

  it("exists/not_exists: handle empty string, null, undefined", () => {
    const ex: Condition = { questionId: "q1", operator: "exists", value: null };
    const nex: Condition = { questionId: "q1", operator: "not_exists", value: null };
    expect(evaluateCondition(ex, map({ q1: "yes" }))).toBe(true);
    expect(evaluateCondition(ex, map({ q1: "" }))).toBe(false);
    expect(evaluateCondition(ex, map({ q1: null }))).toBe(false);
    expect(evaluateCondition(ex, map({}))).toBe(false);
    expect(evaluateCondition(nex, map({}))).toBe(true);
    expect(evaluateCondition(nex, map({ q1: "yes" }))).toBe(false);
  });
});

describe("evaluateConditions (AND)", () => {
  it("empty array is true", () => {
    expect(evaluateConditions([], map({}))).toBe(true);
  });

  it("all must pass", () => {
    const conditions: Condition[] = [
      { questionId: "q1", operator: "eq", value: "yes" },
      { questionId: "q2", operator: "eq", value: "yes" },
    ];
    expect(evaluateConditions(conditions, map({ q1: "yes", q2: "yes" }))).toBe(true);
    expect(evaluateConditions(conditions, map({ q1: "yes", q2: "no" }))).toBe(false);
  });
});

describe("evaluateConditionGroups (OR between groups)", () => {
  it("empty array is true", () => {
    expect(evaluateConditionGroups([], map({}))).toBe(true);
  });

  it("any group passing is enough", () => {
    const groups: ConditionGroup[] = [
      {
        operator: "AND",
        conditions: [{ questionId: "q1", operator: "eq", value: "a" }],
      },
      {
        operator: "AND",
        conditions: [{ questionId: "q2", operator: "eq", value: "b" }],
      },
    ];
    expect(evaluateConditionGroups(groups, map({ q1: "a" }))).toBe(true);
    expect(evaluateConditionGroups(groups, map({ q2: "b" }))).toBe(true);
    expect(evaluateConditionGroups(groups, map({ q1: "x", q2: "y" }))).toBe(false);
  });

  it("OR-typed group: any condition in the group satisfies the group", () => {
    const groups: ConditionGroup[] = [
      {
        operator: "OR",
        conditions: [
          { questionId: "q1", operator: "eq", value: "a" },
          { questionId: "q1", operator: "eq", value: "b" },
        ],
      },
    ];
    expect(evaluateConditionGroups(groups, map({ q1: "a" }))).toBe(true);
    expect(evaluateConditionGroups(groups, map({ q1: "b" }))).toBe(true);
    expect(evaluateConditionGroups(groups, map({ q1: "c" }))).toBe(false);
  });
});

describe("isQuestionVisible", () => {
  const baseQuestion = (overrides: Partial<Question> = {}): Question => ({
    questionId: "q1",
    text: "test",
    inputType: "text",
    sortOrder: 0,
    ...overrides,
  });

  it("question with no conditions is always visible", () => {
    expect(isQuestionVisible(baseQuestion(), map({}))).toBe(true);
  });

  it("hides when AND conditions fail", () => {
    const q = baseQuestion({
      conditions: [{ questionId: "q2", operator: "eq", value: "yes" }],
    });
    expect(isQuestionVisible(q, map({ q2: "no" }))).toBe(false);
    expect(isQuestionVisible(q, map({ q2: "yes" }))).toBe(true);
  });

  it("hides when condition groups fail", () => {
    const q = baseQuestion({
      conditionGroups: [
        { operator: "AND", conditions: [{ questionId: "q2", operator: "eq", value: "yes" }] },
      ],
    });
    expect(isQuestionVisible(q, map({ q2: "no" }))).toBe(false);
  });

  it("both conditions AND groups must pass", () => {
    const q = baseQuestion({
      conditions: [{ questionId: "q2", operator: "eq", value: "yes" }],
      conditionGroups: [
        { operator: "AND", conditions: [{ questionId: "q3", operator: "eq", value: "yes" }] },
      ],
    });
    expect(isQuestionVisible(q, map({ q2: "yes", q3: "yes" }))).toBe(true);
    expect(isQuestionVisible(q, map({ q2: "yes", q3: "no" }))).toBe(false);
    expect(isQuestionVisible(q, map({ q2: "no", q3: "yes" }))).toBe(false);
  });
});

describe("isSectionVisible", () => {
  const baseSection = (overrides: Partial<Section> = {}): Section => ({
    sectionId: "s1",
    title: "test",
    sortOrder: 0,
    questions: [],
    ...overrides,
  });

  it("entity-type filter excludes non-matching entities", () => {
    const s = baseSection({ appliesToEntityTypes: ["INDIVIDUAL_1040"] });
    expect(isSectionVisible(s, map({}), "INDIVIDUAL_1040")).toBe(true);
    expect(isSectionVisible(s, map({}), "S_CORP_1120S")).toBe(false);
  });

  it("filing-status filter: missing status hides the section", () => {
    const s = baseSection({ appliesToFilingStatuses: ["MFJ"] });
    expect(isSectionVisible(s, map({}), "INDIVIDUAL_1040", "MFJ")).toBe(true);
    expect(isSectionVisible(s, map({}), "INDIVIDUAL_1040", "Single")).toBe(false);
    expect(isSectionVisible(s, map({}), "INDIVIDUAL_1040")).toBe(false);
  });

  it("conditions are evaluated", () => {
    const s = baseSection({
      conditions: [{ questionId: "q1", operator: "eq", value: "yes" }],
    });
    expect(isSectionVisible(s, map({ q1: "yes" }), "INDIVIDUAL_1040")).toBe(true);
    expect(isSectionVisible(s, map({ q1: "no" }), "INDIVIDUAL_1040")).toBe(false);
  });
});

describe("getAnswerKey / getScopedAnswer", () => {
  it("instance 0 uses the bare questionId", () => {
    expect(getAnswerKey("q1", 0)).toBe("q1");
    expect(getAnswerKey("q1", 3)).toBe("q1:3");
  });

  it("scoped answer prefers instance-keyed entry; falls back to bare key", () => {
    const answers = map({ q1: "default", "q1:2": "instance-two" });
    expect(getScopedAnswer(answers, "q1", 2)).toBe("instance-two");
    expect(getScopedAnswer(answers, "q1", 1)).toBe("default");
    expect(getScopedAnswer(answers, "missing", 0)).toBeUndefined();
  });
});
