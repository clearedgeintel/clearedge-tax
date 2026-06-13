import { afterEach, describe, expect, it } from "vitest";
import {
  clearQuestionFileCache,
  loadQuestionFile,
  loadInterview,
} from "./loader";

afterEach(() => {
  clearQuestionFileCache();
});

describe("loadQuestionFile — base file (no tax year)", () => {
  it("loads the canonical individual-1040 file", () => {
    const file = loadQuestionFile("individual-1040");
    expect(file.metadata.fileId).toBe("individual-1040");
    expect(file.sections.length).toBeGreaterThan(0);
  });

  it("throws for an unknown file id", () => {
    expect(() => loadQuestionFile("no-such-file")).toThrow();
  });
});

describe("loadQuestionFile — tax-year override fallback", () => {
  it("falls back to the base file when no year-specific override exists", () => {
    // No `individual-1040.2024.json` ships today, so the loader must
    // fall back to `individual-1040.json` without throwing.
    const fileBase = loadQuestionFile("individual-1040");
    const fileForYear = loadQuestionFile("individual-1040", 2024);
    expect(fileForYear.metadata.fileId).toBe(fileBase.metadata.fileId);
    expect(fileForYear.sections.length).toBe(fileBase.sections.length);
  });

  it("still throws when neither year-specific nor base file exists", () => {
    expect(() => loadQuestionFile("no-such-file", 2024)).toThrow();
  });
});

describe("loadInterview — versioning surface", () => {
  it("preserves the original entityType-based behavior when called with no year", () => {
    const interview = loadInterview("INDIVIDUAL_1040");
    expect(interview.sections.length).toBeGreaterThan(0);
    expect(interview.questionIndex.size).toBeGreaterThan(0);
  });

  it("accepts a tax year and falls back to base files when no overrides exist", () => {
    const a = loadInterview("INDIVIDUAL_1040", 2024);
    const b = loadInterview("INDIVIDUAL_1040", 2025);
    // Both years should resolve to the same base file today.
    expect(a.metadata.fileId).toBe(b.metadata.fileId);
    expect(a.sections.length).toBe(b.sections.length);
  });

  it("rejects unknown entity types regardless of tax year", () => {
    expect(() => loadInterview("NOT_A_TYPE", 2024)).toThrow();
  });
});
