import type { ReturnStatus, DocumentStatus, UserRole } from "@/generated/prisma/enums";
import { Badge } from "./Badge";

const RETURN_STATUS_TONE: Record<ReturnStatus, "neutral" | "info" | "warning" | "brand" | "success" | "danger" | "accent"> = {
  INTAKE: "neutral",
  INTAKE_BLOCKED: "warning",
  PREPARATION: "info",
  PREPARATION_BLOCKED: "warning",
  REVIEW: "brand",
  REVISION: "danger",
  PARTNER_REVIEW: "accent",
  APPROVED: "success",
  EXPORTED: "accent",
};

const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  INTAKE: "Intake",
  INTAKE_BLOCKED: "Intake — blocked",
  PREPARATION: "Preparation",
  PREPARATION_BLOCKED: "Prep — blocked",
  REVIEW: "Review",
  REVISION: "Revision",
  PARTNER_REVIEW: "Partner review",
  APPROVED: "Approved",
  EXPORTED: "Exported",
};

export function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  return <Badge tone={RETURN_STATUS_TONE[status]}>{RETURN_STATUS_LABEL[status]}</Badge>;
}

const DOC_STATUS_TONE: Record<DocumentStatus, "warning" | "info" | "success" | "danger"> = {
  REQUESTED: "warning",
  UPLOADED: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
};

const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  REQUESTED: "Needed",
  UPLOADED: "Uploaded",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

export function DocumentStatusPill({ status }: { status: DocumentStatus }) {
  return <Badge tone={DOC_STATUS_TONE[status]}>{DOC_STATUS_LABEL[status]}</Badge>;
}

const ROLE_TONE: Record<UserRole, "neutral" | "brand" | "accent" | "info"> = {
  CLIENT: "neutral",
  PREPARER: "info",
  MANAGER: "brand",
  ADMIN: "accent",
};

export function RolePill({ role }: { role: UserRole }) {
  const label = role.charAt(0) + role.slice(1).toLowerCase();
  return <Badge tone={ROLE_TONE[role]}>{label}</Badge>;
}
