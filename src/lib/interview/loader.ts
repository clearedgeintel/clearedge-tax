import { readFileSync } from "fs";
import { join } from "path";
import type {
  QuestionFile,
  Section,
  Question,
  ResolvedSection,
  ResolvedInterview,
} from "./types";

// ─── Entity type enum → file ID mapping ────────────────────────────────────

const ENTITY_TYPE_TO_FILE_ID: Record<string, string> = {
  INDIVIDUAL_1040: "individual-1040",
  S_CORP_1120S: "s-corp-1120s",
  PARTNERSHIP_1065: "partnership-1065",
  SOLE_PROP_SCHEDULE_C: "sole-prop-schedule-c",
  NONPROFIT_990N: "nonprofit-990",
  NONPROFIT_990EZ: "nonprofit-990",
  NONPROFIT_990: "nonprofit-990",
  NONPROFIT_990PF: "nonprofit-990",
  NONPROFIT_990T: "nonprofit-990",
};

// Map DB entity type format to the JSON entityTypes format
const ENTITY_TYPE_TO_JSON_ID: Record<string, string> = {
  INDIVIDUAL_1040: "individual-1040",
  S_CORP_1120S: "s-corp-1120s",
  PARTNERSHIP_1065: "partnership-1065",
  SOLE_PROP_SCHEDULE_C: "sole-prop-schedule-c",
  NONPROFIT_990N: "nonprofit-990n",
  NONPROFIT_990EZ: "nonprofit-990ez",
  NONPROFIT_990: "nonprofit-990",
  NONPROFIT_990PF: "nonprofit-990pf",
  NONPROFIT_990T: "nonprofit-990t",
};

const QUESTIONS_DIR = join(process.cwd(), "docs", "phase-0", "questions");

// ─── File cache (avoid re-reading from disk) ────────────────────────────────
// Keyed by `<fileId>` or `<fileId>.<taxYear>` so year-specific overrides
// don't clobber the base cache entry.

const fileCache = new Map<string, QuestionFile>();

function readFromDisk(fileId: string): QuestionFile {
  const filePath = join(QUESTIONS_DIR, `${fileId}.json`);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as QuestionFile;
}

/**
 * Load a question file, preferring a year-specific override when available.
 *
 * Resolution order for `loadQuestionFile("individual-1040", 2024)`:
 *   1. `docs/phase-0/questions/individual-1040.2024.json` (if it exists)
 *   2. `docs/phase-0/questions/individual-1040.json` (base / current rules)
 *
 * Loading without `taxYear` always reads the base file. The cache key
 * matches the file actually loaded, so a year-specific file and the base
 * file occupy independent cache slots.
 */
export function loadQuestionFile(
  fileId: string,
  taxYear?: number
): QuestionFile {
  const candidates: string[] =
    taxYear !== undefined ? [`${fileId}.${taxYear}`, fileId] : [fileId];

  for (const candidate of candidates) {
    if (fileCache.has(candidate)) {
      return fileCache.get(candidate)!;
    }
    try {
      const parsed = readFromDisk(candidate);
      fileCache.set(candidate, parsed);
      return parsed;
    } catch (err: unknown) {
      const e = err as { code?: string };
      // ENOENT on a year-specific candidate is expected when no override
      // exists — fall through to the next candidate. Any other error
      // surfaces immediately.
      if (e.code !== "ENOENT") throw err;
    }
  }

  throw new Error(`Question file not found: ${fileId}`);
}

/** Test helper / runtime escape hatch: drop the cache. */
export function clearQuestionFileCache(): void {
  fileCache.clear();
}

// ─── Section filtering ─────────────────────────────────────────────────────

function sectionAppliesToEntity(
  section: Section,
  entityJsonId: string
): boolean {
  if (!section.appliesToEntityTypes || section.appliesToEntityTypes.length === 0) {
    return true;
  }
  return section.appliesToEntityTypes.includes(entityJsonId);
}

function questionAppliesToEntity(
  question: Question,
  entityJsonId: string
): boolean {
  if (!question.appliesToEntityTypes || question.appliesToEntityTypes.length === 0) {
    return true;
  }
  return question.appliesToEntityTypes.includes(entityJsonId);
}

// ─── Section include resolution ─────────────────────────────────────────────

function resolveIncludes(
  section: Section,
  sourceFileId: string,
  entityJsonId: string,
  taxYear: number | undefined,
  depth = 0
): ResolvedSection {
  if (depth > 3) {
    // Prevent infinite recursion
    return { ...section, sourceFileId };
  }

  const includedSections: ResolvedSection[] = [];

  for (const question of section.questions) {
    if (question.inputType === "section_include" && question.includeSection) {
      const targetFile = loadQuestionFile(question.includeSection.fileId, taxYear);
      const targetSection = targetFile.sections.find(
        (s) => s.sectionId === question.includeSection!.sectionId
      );
      if (targetSection && sectionAppliesToEntity(targetSection, entityJsonId)) {
        const resolved = resolveIncludes(
          targetSection,
          question.includeSection.fileId,
          entityJsonId,
          taxYear,
          depth + 1
        );
        includedSections.push(resolved);
      }
    }
  }

  return {
    ...section,
    sourceFileId,
    ...(includedSections.length > 0 ? { includedSections } : {}),
  };
}

// ─── Question index builder ─────────────────────────────────────────────────

function buildQuestionIndex(
  sections: ResolvedSection[]
): Map<string, Question> {
  const index = new Map<string, Question>();

  function indexSection(section: ResolvedSection) {
    for (const q of section.questions) {
      index.set(q.questionId, q);
    }
    if (section.includedSections) {
      for (const inc of section.includedSections) {
        indexSection(inc);
      }
    }
  }

  for (const section of sections) {
    indexSection(section);
  }
  return index;
}

// ─── Main loader ────────────────────────────────────────────────────────────

/**
 * Load and merge all question files for a given entity type.
 *
 * When `taxYear` is provided, the loader prefers year-specific files
 * (e.g. `individual-1040.2024.json`) and falls back to the base file
 * if no year-specific override exists. Without `taxYear`, the base
 * file is always used. The resolved metadata reflects whichever file
 * was actually loaded, so consumers can see the version they got.
 */
export function loadInterview(
  entityType: string,
  taxYear?: number
): ResolvedInterview {
  const fileId = ENTITY_TYPE_TO_FILE_ID[entityType];
  if (!fileId) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const entityJsonId = ENTITY_TYPE_TO_JSON_ID[entityType];
  const primaryFile = loadQuestionFile(fileId, taxYear);
  const sharedFile = loadQuestionFile("shared", taxYear);

  // Filter shared sections to those applicable to this entity type
  const applicableSharedSections = sharedFile.sections.filter((s) =>
    sectionAppliesToEntity(s, entityJsonId)
  );

  // Filter questions within sections by entity type
  const filterQuestions = (sections: Section[]): Section[] =>
    sections.map((s) => ({
      ...s,
      questions: s.questions.filter((q) => questionAppliesToEntity(q, entityJsonId)),
    }));

  // Merge: primary sections + applicable shared sections, sorted by sortOrder
  const allSections = [
    ...filterQuestions(primaryFile.sections),
    ...filterQuestions(applicableSharedSections),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  // Resolve section_include references
  const resolvedSections = allSections.map((s) =>
    resolveIncludes(s, primaryFile.metadata.fileId, entityJsonId, taxYear)
  );

  const questionIndex = buildQuestionIndex(resolvedSections);

  return {
    metadata: primaryFile.metadata,
    sections: resolvedSections,
    questionIndex,
  };
}

/**
 * Convert a filing status from DB enum format to JSON format.
 * e.g., "SINGLE" → "single", "MFJ" → "mfj"
 */
export function filingStatusToJsonId(filingStatus: string): string {
  return filingStatus.toLowerCase();
}
