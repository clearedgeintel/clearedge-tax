import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import {
  PageHeader,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  DocumentStatusPill,
} from "@/components/ui";
import { FolderOpen, AlertCircle } from "lucide-react";
import UploadButton from "./UploadButton";
import ViewDocumentLink from "./ViewDocumentLink";

export default async function ClientDocuments() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <>
        <PageHeader
          title="Documents"
          description="Your account is being set up."
        />
        <EmptyState
          icon={<FolderOpen className="h-5 w-5" />}
          title="No engagement yet"
        />
      </>
    );
  }

  const documents = await prisma.document.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    include: {
      taxReturn: {
        select: {
          taxYear: true,
          entity: { select: { legalName: true } },
        },
      },
    },
  });

  const requested = documents.filter((d) => d.status === "REQUESTED");
  const uploaded = documents.filter((d) => d.status === "UPLOADED");
  const reviewed = documents.filter(
    (d) => d.status === "ACCEPTED" || d.status === "REJECTED"
  );

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload requested documents and view what you've already shared."
        meta={
          requested.length > 0 && (
            <Badge tone="warning">{requested.length} action needed</Badge>
          )
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-5 w-5" />}
          title="No document requests yet"
          description="When your preparer asks for documents, they'll show up here."
        />
      ) : (
        <div className="space-y-6">
          {requested.length > 0 && (
            <Card flush>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    Action needed
                    <Badge tone="warning">{requested.length}</Badge>
                  </span>
                }
                description="Your preparer is waiting on these items."
              />
              <ul className="divide-y divide-border-subtle">
                {requested.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-start justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                        <h3 className="text-sm font-semibold text-ink truncate">
                          {doc.label}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {doc.category.replace(/_/g, " ")}
                        {doc.taxReturn && (
                          <>
                            {" · "}
                            {doc.taxReturn.entity.legalName} ({doc.taxReturn.taxYear})
                          </>
                        )}
                      </p>
                      {doc.requestNote && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {doc.requestNote}
                        </p>
                      )}
                    </div>
                    <UploadButton documentId={doc.id} label={doc.label} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(uploaded.length > 0 || reviewed.length > 0) && (
            <Card flush>
              <CardHeader
                title="Submitted"
                description={`${uploaded.length + reviewed.length} item${uploaded.length + reviewed.length === 1 ? "" : "s"} shared with your preparer`}
              />
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">
                      Document
                    </th>
                    <th className="text-left px-5 py-2.5 font-medium">
                      Category
                    </th>
                    <th className="text-left px-5 py-2.5 font-medium">For</th>
                    <th className="text-left px-5 py-2.5 font-medium">Status</th>
                    <th className="text-left px-5 py-2.5 font-medium">Date</th>
                    <th className="text-left px-5 py-2.5 font-medium">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {[...uploaded, ...reviewed].map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-muted/60">
                      <td className="px-5 py-2.5 font-medium text-ink">
                        {doc.label}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-muted">
                        {doc.category.replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-muted">
                        {doc.taxReturn?.entity.legalName || "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <DocumentStatusPill status={doc.status} />
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-muted">
                        {format(doc.uploadedAt || doc.createdAt, "MMM d, yyyy")}
                      </td>
                      <td className="px-5 py-2.5 text-xs">
                        {doc.storageKey ? (
                          <ViewDocumentLink documentId={doc.id} />
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
