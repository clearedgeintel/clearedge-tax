import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/utils/permissions";
import {
  PageHeader,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Button,
  DocumentStatusPill,
} from "@/components/ui";
import { FileText, ArrowLeft } from "lucide-react";
import SendCampaignButton from "../SendCampaignButton";
import CancelCampaignButton from "./CancelCampaignButton";
import DeleteItemButton from "./DeleteItemButton";
import AcceptRejectButtons from "./AcceptRejectButtons";
import AddItemForm from "./AddItemForm";

const STATUS_TONE: Record<
  string,
  "neutral" | "warning" | "info" | "success" | "danger"
> = {
  DRAFT: "neutral",
  SENT: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const EXTRACTION_TONE: Record<
  string,
  "neutral" | "info" | "success" | "danger"
> = {
  PENDING: "info",
  SUCCESS: "success",
  REVIEWED: "success",
  FAILED: "danger",
  UNSUPPORTED: "neutral",
};

const EXTRACTION_LABEL: Record<string, string> = {
  PENDING: "Extracting…",
  SUCCESS: "Extracted",
  REVIEWED: "Reviewed",
  FAILED: "Extract failed",
  UNSUPPORTED: "Not supported",
};

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) redirect("/login");

  const { campaignId } = await params;

  const campaign = await prisma.documentCampaign.findFirst({
    where: {
      id: campaignId,
      client: { firmId: session.user.firmId! },
    },
    include: {
      client: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      documents: {
        orderBy: { createdAt: "asc" },
        include: {
          extraction: { select: { status: true } },
        },
      },
    },
  });

  if (!campaign) redirect("/staff/campaigns");

  const requested = campaign.documents.filter((d) => d.status === "REQUESTED");
  const uploaded = campaign.documents.filter((d) => d.status === "UPLOADED");
  const accepted = campaign.documents.filter((d) => d.status === "ACCEPTED");
  const rejected = campaign.documents.filter((d) => d.status === "REJECTED");
  const total = campaign.documents.length;
  const resolved = accepted.length + rejected.length;

  const isMutable =
    campaign.status === "DRAFT" ||
    campaign.status === "SENT" ||
    campaign.status === "IN_PROGRESS";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/staff/campaigns"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            <ArrowLeft className="h-3 w-3" /> Campaigns
          </Link>
        }
        title={`${campaign.client.displayName} · Tax year ${campaign.taxYear}`}
        description={
          campaign.message ||
          "No client message attached. Documents still appear on the client portal."
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={STATUS_TONE[campaign.status]}>
              {STATUS_LABEL[campaign.status]}
            </Badge>
            {campaign.sentAt && (
              <span className="text-ink-subtle">
                Sent {format(campaign.sentAt, "MMM d, yyyy")}
              </span>
            )}
            {campaign.deadline && (
              <span className="text-ink-subtle">
                Due {format(campaign.deadline, "MMM d, yyyy")}
              </span>
            )}
            {campaign.completedAt && (
              <span className="text-ink-subtle">
                Completed {format(campaign.completedAt, "MMM d, yyyy")}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {campaign.status === "DRAFT" && (
              <SendCampaignButton campaignId={campaign.id} />
            )}
            {isMutable && <CancelCampaignButton campaignId={campaign.id} />}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCell label="Requested" value={requested.length} />
        <SummaryCell label="Uploaded" value={uploaded.length} tone="info" />
        <SummaryCell label="Accepted" value={accepted.length} tone="success" />
        <SummaryCell
          label="Resolved / total"
          value={`${resolved} / ${total}`}
        />
      </div>

      <Card flush>
        <CardHeader
          title="Items"
          description="Per-document state, AI extraction status, and review actions."
        />
        {campaign.documents.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No items in this campaign"
              description={
                campaign.status === "DRAFT"
                  ? "Add the first item below to get started."
                  : "This campaign has no document items."
              }
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Label</th>
                <th className="text-left px-5 py-2.5 font-medium">Category</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
                <th className="text-left px-5 py-2.5 font-medium">
                  Extraction
                </th>
                <th className="text-left px-5 py-2.5 font-medium">Updated</th>
                <th className="text-right px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {campaign.documents.map((doc) => {
                const extractionStatus = doc.extraction?.status;
                return (
                  <tr key={doc.id} className="hover:bg-surface-muted/60">
                    <td className="px-5 py-2.5 text-sm text-ink">
                      {doc.label}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-ink-muted">
                      {doc.category.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-2.5">
                      <DocumentStatusPill status={doc.status} />
                    </td>
                    <td className="px-5 py-2.5">
                      {extractionStatus ? (
                        <Badge tone={EXTRACTION_TONE[extractionStatus]}>
                          {EXTRACTION_LABEL[extractionStatus]}
                        </Badge>
                      ) : doc.status === "REQUESTED" ? (
                        <span className="text-xs text-ink-subtle">—</span>
                      ) : (
                        <Badge tone="neutral">Not run</Badge>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-ink-muted">
                      {format(doc.updatedAt, "MMM d")}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {doc.status === "REQUESTED" &&
                        campaign.status === "DRAFT" && (
                          <DeleteItemButton documentId={doc.id} />
                        )}
                      {doc.status === "UPLOADED" && (
                        <AcceptRejectButtons documentId={doc.id} />
                      )}
                      {doc.status === "ACCEPTED" && (
                        <span className="text-xs text-ink-subtle">
                          Accepted
                        </span>
                      )}
                      {doc.status === "REJECTED" && (
                        <span className="text-xs text-danger">Rejected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {campaign.status === "DRAFT" && <AddItemForm campaignId={campaign.id} />}
      </Card>

      <Card flush className="mt-4">
        <CardHeader title="Client" />
        <div className="px-5 py-3 text-sm text-ink-muted">
          <p>
            <span className="text-ink-subtle">Name:</span>{" "}
            <span className="text-ink font-medium">
              {campaign.client.displayName}
            </span>
          </p>
          <p className="mt-1">
            <span className="text-ink-subtle">Email:</span>{" "}
            {campaign.client.email ? (
              <span className="text-ink">{campaign.client.email}</span>
            ) : (
              <span className="text-ink-subtle italic">none on file</span>
            )}
          </p>
          <p className="mt-3">
            <Button
              href={`/staff/returns?clientId=${campaign.client.id}`}
              variant="secondary"
              size="sm"
            >
              See this client&apos;s returns
            </Button>
          </p>
        </div>
      </Card>
    </>
  );
}

function SummaryCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "info" | "success";
}) {
  const barColor =
    tone === "info"
      ? "bg-info"
      : tone === "success"
        ? "bg-success"
        : "bg-neutral-300";
  return (
    <Card flush className="overflow-hidden">
      <div className="flex">
        <div className={`w-1 ${barColor}`} aria-hidden />
        <div className="flex-1 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-ink-subtle">
            {label}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
