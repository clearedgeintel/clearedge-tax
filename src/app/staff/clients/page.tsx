import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
} from "@/components/ui";
import { UsersRound, Mail, Phone, FileText, FolderOpen } from "lucide-react";
import NewClientButton from "./NewClientButton";

export default async function StaffClients() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;

  const clients = await prisma.client.findMany({
    where: { firmId },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    include: {
      _count: { select: { entities: true, documents: true } },
      entities: {
        where: { isActive: true },
        select: {
          id: true,
          legalName: true,
          entityType: true,
          _count: { select: { taxReturns: true } },
        },
        orderBy: { legalName: "asc" },
      },
    },
  });

  const activeCount = clients.filter((c) => c.isActive).length;

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="Clients"
        description={`${activeCount} active client${activeCount === 1 ? "" : "s"} in your firm.`}
        actions={<NewClientButton />}
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" />}
          title="No clients yet"
          description="Add your first client and they'll appear here with their entities and returns."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clients.map((client) => (
            <Card key={client.id} flush>
              <div className="px-5 py-4 border-b border-border-subtle">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink truncate">
                      {client.displayName}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                      {client.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {!client.isActive && <Badge tone="neutral">Inactive</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-border-subtle border-b border-border-subtle text-center">
                <div className="px-5 py-3">
                  <div className="text-xs text-ink-subtle">Entities</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                    {client._count.entities}
                  </div>
                </div>
                <div className="px-5 py-3">
                  <div className="text-xs text-ink-subtle">Documents</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                    {client._count.documents}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3">
                {client.entities.length === 0 ? (
                  <p className="text-xs text-ink-subtle italic">
                    No entities yet
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {client.entities.map((entity) => (
                      <li key={entity.id}>
                        <Link
                          href={`/staff/returns?entityId=${entity.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-muted px-2 py-1 text-xs text-ink-muted hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          <span className="font-medium">
                            {entity.legalName}
                          </span>
                          {entity._count.taxReturns > 0 && (
                            <span className="text-ink-subtle">
                              · {entity._count.taxReturns} return
                              {entity._count.taxReturns === 1 ? "" : "s"}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {client._count.documents > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-subtle">
                    <Link
                      href={`/staff/returns?clientId=${client.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                    >
                      <FolderOpen className="h-3 w-3" /> View all returns
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
