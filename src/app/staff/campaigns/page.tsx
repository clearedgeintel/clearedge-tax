import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/utils/permissions";
import {
  PageHeader,
  Card,
  CardHeader,
  Badge,
  EmptyState,
} from "@/components/ui";
import { FolderInput } from "lucide-react";
import NewCampaignButton from "./NewCampaignButton";
import SendCampaignButton from "./SendCampaignButton";

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

export default async function StaffCampaigns() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) redirect("/login");

  const firmId = session.user.firmId!;

  const [campaigns, clients] = await Promise.all([
    prisma.documentCampaign.findMany({
      where: { client: { firmId } },
      orderBy: [{ taxYear: "desc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, displayName: true, email: true } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.client.findMany({
      where: { firmId, isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="Pre-return campaigns"
        description="Send a client a batch of document requests for a tax year before any return is created. Documents collected this way auto-attach to the matching return when it's created."
        actions={<NewCampaignButton clients={clients} />}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<FolderInput className="h-5 w-5" />}
          title="No campaigns yet"
          description="Start by creating a campaign for a client. Use a template like Individual basics or Self-employed; you can edit the item list before sending."
        />
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <Card key={c.id} flush>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {c.client.displayName} · Tax year {c.taxYear}
                    <Badge tone={STATUS_TONE[c.status]}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </span>
                }
                description={
                  <span>
                    {c._count.documents} item
                    {c._count.documents === 1 ? "" : "s"} requested
                    {c.sentAt && ` · sent ${format(c.sentAt, "MMM d, yyyy")}`}
                    {c.deadline && ` · due ${format(c.deadline, "MMM d, yyyy")}`}
                  </span>
                }
                actions={
                  c.status === "DRAFT" ? (
                    <SendCampaignButton campaignId={c.id} />
                  ) : null
                }
              />
              {c.message && (
                <p className="px-5 py-3 text-sm text-ink-muted border-b border-border-subtle">
                  {c.message}
                </p>
              )}
              <div className="px-5 py-3 text-xs text-ink-subtle flex flex-wrap gap-x-4 gap-y-1">
                <span>Client email: {c.client.email || "—"}</span>
                <span>Created {format(c.createdAt, "MMM d, yyyy")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
