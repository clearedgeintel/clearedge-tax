import type {
  UserRole,
  EntityType,
  FilingStatus,
  ReturnStatus,
  RelationshipType,
  DocumentStatus,
  DocumentCategory,
  DeadlineType,
  ReviewActionType,
} from "@/generated/prisma/enums";

export type {
  UserRole,
  EntityType,
  FilingStatus,
  ReturnStatus,
  RelationshipType,
  DocumentStatus,
  DocumentCategory,
  DeadlineType,
  ReviewActionType,
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  INDIVIDUAL_1040: "Individual (1040)",
  S_CORP_1120S: "S-Corporation (1120-S)",
  PARTNERSHIP_1065: "Partnership / LLC (1065)",
  SOLE_PROP_SCHEDULE_C: "Sole Proprietorship (Sch C)",
  NONPROFIT_990N: "Non-profit (990-N)",
  NONPROFIT_990EZ: "Non-profit (990-EZ)",
  NONPROFIT_990: "Non-profit (990)",
  NONPROFIT_990PF: "Private Foundation (990-PF)",
  NONPROFIT_990T: "Non-profit UBIT (990-T)",
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  SINGLE: "Single",
  MFJ: "Married Filing Jointly",
  MFS: "Married Filing Separately",
  HOH: "Head of Household",
  QSS: "Qualifying Surviving Spouse",
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  INTAKE: "Intake",
  INTAKE_BLOCKED: "Intake (Blocked)",
  PREPARATION: "Preparation",
  PREPARATION_BLOCKED: "Preparation (Blocked)",
  REVIEW: "In Review",
  REVISION: "Revision Needed",
  APPROVED: "Approved",
  EXPORTED: "Exported",
};

export const K1_ISSUING_ENTITY_TYPES: EntityType[] = [
  "S_CORP_1120S",
  "PARTNERSHIP_1065",
];
