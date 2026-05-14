// ─── Input Types ────────────────────────────────────────────────────────────

export type InputType =
  | "yes_no"
  | "multiple_choice"
  | "multi_select"
  | "text"
  | "number"
  | "currency"
  | "date"
  | "ein"
  | "ssn"
  | "phone"
  | "email"
  | "address"
  | "percentage"
  | "file_upload"
  | "state_select"
  | "state_multi_select"
  | "section_include";

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "exists"
  | "not_exists";

// ─── Question Schema Types ─────────────────────────────────────────────────

export interface Condition {
  questionId: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: Condition[];
}

export interface FormTrigger {
  formId: string;
  formName?: string;
  triggerWhen: {
    operator: ConditionOperator;
    value: unknown;
  };
  action?: "include" | "exclude" | "require";
}

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
}

export interface QuestionOption {
  value: string;
  label: string;
}

export interface SectionReference {
  fileId: string;
  sectionId: string;
}

export interface Question {
  questionId: string;
  text: string;
  helpText?: string;
  inputType: InputType;
  sortOrder: number;
  options?: QuestionOption[];
  validation?: ValidationRule;
  defaultValue?: unknown;
  appliesToEntityTypes?: string[];
  appliesToFilingStatuses?: string[];
  conditions?: Condition[];
  conditionGroups?: ConditionGroup[];
  formTriggers?: FormTrigger[];
  includeSection?: SectionReference;
  repeatable?: boolean;
  staffOnly?: boolean;
  tags?: string[];
}

export interface Section {
  sectionId: string;
  title: string;
  description?: string;
  sortOrder: number;
  appliesToEntityTypes?: string[];
  appliesToFilingStatuses?: string[];
  repeatable?: boolean;
  conditions?: Condition[];
  questions: Question[];
}

export interface QuestionFileMetadata {
  fileId: string;
  entityTypes: string[];
  version: string;
  taxYear: number;
  description?: string;
}

export interface QuestionFile {
  metadata: QuestionFileMetadata;
  sections: Section[];
}

// ─── Engine Runtime Types ───────────────────────────────────────────────────

/** Flat map of questionId (or questionId:instanceIndex) → answer value */
export type AnswerMap = Map<string, unknown>;

/** A section with included sections resolved inline */
export interface ResolvedSection extends Section {
  sourceFileId: string;
  includedSections?: ResolvedSection[];
}

export interface ResolvedInterview {
  metadata: QuestionFileMetadata;
  sections: ResolvedSection[];
  questionIndex: Map<string, Question>;
}

export interface TriggeredFormRecord {
  formId: string;
  formName: string;
  action: "include" | "exclude" | "require";
  triggeredByQuestionId: string;
  isActive: boolean;
}

export interface SectionProgress {
  sectionId: string;
  total: number;
  answered: number;
  complete: boolean;
}
