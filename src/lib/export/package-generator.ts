import { prisma } from "@/lib/db";
import { ENTITY_TYPE_LABELS, RETURN_STATUS_LABELS } from "@/types/entities";
import { format } from "date-fns";

export interface ExportPackage {
  metadata: {
    exportedAt: string;
    returnId: string;
    entityType: string;
    entityName: string;
    taxYear: number;
    clientName: string;
    preparerName: string | null;
    reviewerName: string | null;
    approvedAt: string | null;
  };
  entityInfo: {
    legalName: string;
    tin: string | null;
    tinType: string | null;
    filingStatus: string | null;
    address: unknown;
    dateOfBirth: string | null;
    dateOfFormation: string | null;
    stateOfFormation: string | null;
  };
  interviewData: Record<string, {
    sectionId: string;
    questionId: string;
    value: unknown;
    instanceIndex: number;
  }[]>;
  triggeredForms: {
    formId: string;
    formName: string;
    action: string;
  }[];
  documents: {
    id: string;
    category: string;
    label: string;
    status: string;
    storageKey: string | null;
  }[];
  k1Data: {
    issuedK1s: {
      recipientEntity: string;
      ownershipPct: number | null;
      k1Data: unknown;
    }[];
    receivedK1s: {
      issuingEntity: string;
      ownershipPct: number | null;
      k1Data: unknown;
    }[];
  };
  deadlines: {
    type: string;
    jurisdiction: string;
    dueDate: string;
    isExtended: boolean;
  }[];
  reviewHistory: {
    action: string;
    reviewer: string;
    notes: string | null;
    date: string;
  }[];
}

/**
 * Generate an export package for a return.
 * The return must be in APPROVED or EXPORTED status.
 */
export async function generateExportPackage(returnId: string): Promise<ExportPackage> {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: returnId },
    include: {
      entity: {
        include: {
          client: { select: { displayName: true } },
        },
      },
      preparer: { select: { name: true } },
      reviewer: { select: { name: true } },
      interviewResponses: {
        orderBy: [{ sectionId: "asc" }, { questionId: "asc" }, { instanceIndex: "asc" }],
      },
      triggeredForms: { where: { isActive: true } },
      documents: true,
      deadlines: { orderBy: { dueDate: "asc" } },
      reviewActions: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
      k1sIssuedByReturn: {
        include: {
          targetReturn: { select: { entity: { select: { legalName: true } } } },
        },
      },
      k1sReceivedByReturn: {
        include: {
          sourceReturn: { select: { entity: { select: { legalName: true } } } },
        },
      },
    },
  });

  if (!taxReturn) {
    throw new Error("Return not found");
  }

  if (taxReturn.status !== "APPROVED" && taxReturn.status !== "EXPORTED") {
    throw new Error(`Cannot export return in ${taxReturn.status} status`);
  }

  // Group interview responses by section
  const interviewData: ExportPackage["interviewData"] = {};
  for (const r of taxReturn.interviewResponses) {
    if (!interviewData[r.sectionId]) {
      interviewData[r.sectionId] = [];
    }
    interviewData[r.sectionId].push({
      sectionId: r.sectionId,
      questionId: r.questionId,
      value: r.value,
      instanceIndex: r.instanceIndex,
    });
  }

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      returnId: taxReturn.id,
      entityType: ENTITY_TYPE_LABELS[taxReturn.entity.entityType],
      entityName: taxReturn.entity.legalName,
      taxYear: taxReturn.taxYear,
      clientName: taxReturn.entity.client.displayName,
      preparerName: taxReturn.preparer?.name || null,
      reviewerName: taxReturn.reviewer?.name || null,
      approvedAt: taxReturn.approvedAt?.toISOString() || null,
    },
    entityInfo: {
      legalName: taxReturn.entity.legalName,
      tin: taxReturn.entity.tin,
      tinType: taxReturn.entity.tinType,
      filingStatus: taxReturn.entity.filingStatus,
      address: taxReturn.entity.address,
      dateOfBirth: taxReturn.entity.dateOfBirth?.toISOString() || null,
      dateOfFormation: taxReturn.entity.dateOfFormation?.toISOString() || null,
      stateOfFormation: taxReturn.entity.stateOfFormation,
    },
    interviewData,
    triggeredForms: taxReturn.triggeredForms.map((f) => ({
      formId: f.formId,
      formName: f.formName,
      action: f.action,
    })),
    documents: taxReturn.documents.map((d) => ({
      id: d.id,
      category: d.category,
      label: d.label,
      status: d.status,
      storageKey: d.storageKey,
    })),
    k1Data: {
      issuedK1s: taxReturn.k1sIssuedByReturn.map((k1) => ({
        recipientEntity: k1.targetReturn.entity.legalName,
        ownershipPct: k1.ownershipPct ? Number(k1.ownershipPct) : null,
        k1Data: k1.k1Data,
      })),
      receivedK1s: taxReturn.k1sReceivedByReturn.map((k1) => ({
        issuingEntity: k1.sourceReturn.entity.legalName,
        ownershipPct: k1.ownershipPct ? Number(k1.ownershipPct) : null,
        k1Data: k1.k1Data,
      })),
    },
    deadlines: taxReturn.deadlines.map((d) => ({
      type: d.deadlineType,
      jurisdiction: d.jurisdiction,
      dueDate: d.dueDate.toISOString(),
      isExtended: d.isExtended,
    })),
    reviewHistory: taxReturn.reviewActions.map((a) => ({
      action: a.action,
      reviewer: a.user.name,
      notes: a.notes,
      date: a.createdAt.toISOString(),
    })),
  };
}
