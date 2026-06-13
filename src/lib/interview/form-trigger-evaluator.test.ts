import { describe, expect, it } from "vitest";
import {
  evaluateFormTriggers,
  getQuestionsWithTriggers,
} from "./form-trigger-evaluator";
import type { AnswerMap, Question } from "./types";

const map = (entries: Record<string, unknown>): AnswerMap =>
  new Map(Object.entries(entries));

const q = (overrides: Partial<Question>): Question => ({
  questionId: "q",
  text: "test",
  inputType: "text",
  sortOrder: 0,
  ...overrides,
});

describe("evaluateFormTriggers", () => {
  it("returns empty when no questions have triggers", () => {
    const questions = [q({ questionId: "q1" }), q({ questionId: "q2" })];
    expect(evaluateFormTriggers(questions, map({}))).toEqual([]);
  });

  it("marks trigger active when the condition matches", () => {
    const questions = [
      q({
        questionId: "rental_income",
        formTriggers: [
          {
            formId: "Schedule_E",
            formName: "Schedule E",
            triggerWhen: { operator: "eq", value: "yes" },
          },
        ],
      }),
    ];

    const records = evaluateFormTriggers(questions, map({ rental_income: "yes" }));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      formId: "Schedule_E",
      formName: "Schedule E",
      action: "include",
      triggeredByQuestionId: "rental_income",
      isActive: true,
    });
  });

  it("marks trigger inactive when the condition does not match", () => {
    const questions = [
      q({
        questionId: "rental_income",
        formTriggers: [
          {
            formId: "Schedule_E",
            triggerWhen: { operator: "eq", value: "yes" },
          },
        ],
      }),
    ];

    const records = evaluateFormTriggers(questions, map({ rental_income: "no" }));
    expect(records).toHaveLength(1);
    expect(records[0].isActive).toBe(false);
  });

  it("falls back to formId when formName is missing, and to 'include' when action is missing", () => {
    const questions = [
      q({
        questionId: "x",
        formTriggers: [
          { formId: "F1", triggerWhen: { operator: "exists", value: null } },
        ],
      }),
    ];
    const [record] = evaluateFormTriggers(questions, map({ x: "anything" }));
    expect(record.formName).toBe("F1");
    expect(record.action).toBe("include");
  });

  it("respects an explicit 'exclude' action", () => {
    const questions = [
      q({
        questionId: "x",
        formTriggers: [
          {
            formId: "F1",
            triggerWhen: { operator: "eq", value: "skip" },
            action: "exclude",
          },
        ],
      }),
    ];
    const [record] = evaluateFormTriggers(questions, map({ x: "skip" }));
    expect(record.action).toBe("exclude");
    expect(record.isActive).toBe(true);
  });

  it("evaluates multiple triggers on a single question independently", () => {
    const questions = [
      q({
        questionId: "has_business",
        formTriggers: [
          { formId: "Schedule_C", triggerWhen: { operator: "eq", value: "yes" } },
          { formId: "Schedule_SE", triggerWhen: { operator: "eq", value: "yes" } },
        ],
      }),
    ];
    const records = evaluateFormTriggers(questions, map({ has_business: "yes" }));
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.isActive)).toBe(true);
  });
});

describe("getQuestionsWithTriggers", () => {
  it("filters to questions that declare at least one trigger", () => {
    const index = new Map<string, Question>([
      ["q1", q({ questionId: "q1" })],
      [
        "q2",
        q({
          questionId: "q2",
          formTriggers: [
            { formId: "F1", triggerWhen: { operator: "exists", value: null } },
          ],
        }),
      ],
      ["q3", q({ questionId: "q3", formTriggers: [] })],
    ]);

    const result = getQuestionsWithTriggers(index);
    expect(result.map((q) => q.questionId)).toEqual(["q2"]);
  });
});
