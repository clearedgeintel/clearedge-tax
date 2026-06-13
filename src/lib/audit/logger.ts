import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

interface AuditEventInput {
  returnId?: string;
  userId?: string;
  eventType: string;
  eventCategory: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  critical?: boolean;
}

const BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

type BufferedEvent = Omit<AuditEventInput, "critical"> & {
  createdAt: Date;
};

let buffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
}

async function flushBuffer(): Promise<void> {
  if (buffer.length === 0) return;
  const toWrite = [...buffer];
  buffer = [];
  try {
    await prisma.auditEvent.createMany({ data: toWrite });
  } catch (error) {
    // If flush fails, re-add events to buffer for retry
    buffer.unshift(...toWrite);
    console.error("Failed to flush audit events:", error);
  }
}

export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  const { critical, ...eventData } = event;
  const record: BufferedEvent = {
    ...eventData,
    createdAt: new Date(),
  };

  if (critical) {
    await prisma.auditEvent.create({ data: record });
    return;
  }

  buffer.push(record);
  ensureFlushTimer();
  if (buffer.length >= BUFFER_SIZE) {
    await flushBuffer();
  }
}

// Convenience functions for common event types
export async function logStatusChange(
  returnId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  note?: string
): Promise<void> {
  await logAuditEvent({
    returnId,
    userId,
    eventType: "RETURN_STATUS_CHANGED",
    eventCategory: "RETURN",
    description: `Return status changed from ${oldStatus} to ${newStatus}${note ? `: ${note}` : ""}`,
    metadata: { oldStatus, newStatus, note },
    critical: true,
  });
}

export async function logInterviewSave(
  returnId: string,
  userId: string,
  questionId: string,
  sectionId: string
): Promise<void> {
  await logAuditEvent({
    returnId,
    userId,
    eventType: "INTERVIEW_ANSWER_SAVED",
    eventCategory: "INTERVIEW",
    description: `Answer saved for question ${questionId}`,
    metadata: { questionId, sectionId },
  });
}

export async function logDocumentEvent(
  returnId: string,
  userId: string,
  eventType: string,
  documentId: string,
  label: string
): Promise<void> {
  await logAuditEvent({
    returnId,
    userId,
    eventType,
    eventCategory: "DOCUMENT",
    description: `Document "${label}" — ${eventType.toLowerCase().replace(/_/g, " ")}`,
    metadata: { documentId, label },
    critical: eventType === "DOCUMENT_ACCEPTED" || eventType === "DOCUMENT_REJECTED",
  });
}

export async function logPIIAccess(
  userId: string,
  field: string,
  subject: { entityId?: string; returnId?: string; clientId?: string },
  reason?: string
): Promise<void> {
  const subjectStr =
    subject.entityId
      ? `entity ${subject.entityId}`
      : subject.returnId
        ? `return ${subject.returnId}`
        : subject.clientId
          ? `client ${subject.clientId}`
          : "unknown";
  await logAuditEvent({
    userId,
    returnId: subject.returnId,
    eventType: "PII_FULL_VIEW",
    eventCategory: "PII",
    description: `Viewed full ${field} for ${subjectStr}${reason ? ` (${reason})` : ""}`,
    metadata: { field, ...subject, reason },
    critical: true,
  });
}

export async function logAuthEvent(
  userId: string,
  eventType: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType,
    eventCategory: "AUTH",
    description: `${eventType.toLowerCase().replace(/_/g, " ")}`,
    ipAddress,
    userAgent,
    critical: true,
  });
}
