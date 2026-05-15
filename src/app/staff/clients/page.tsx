import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import NewClientButton from "./NewClientButton";

export default async function StaffClients() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;

  const clients = await prisma.client.findMany({
    where: { firmId },
    orderBy: { displayName: "asc" },
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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-gray-600">
            {clients.length} client{clients.length !== 1 ? "s" : ""} in your firm.
          </p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[28rem]">
          <NewClientButton />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No clients yet. Add your first client to get started.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{client.displayName}</h3>
                  <div className="mt-1 flex gap-4 text-xs text-gray-500">
                    {client.email && <span>{client.email}</span>}
                    {client.phone && <span>{client.phone}</span>}
                    <span>{client._count.entities} entities</span>
                    <span>{client._count.documents} documents</span>
                  </div>
                </div>
                {!client.isActive && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                    Inactive
                  </span>
                )}
              </div>

              {client.entities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {client.entities.map((entity) => (
                    <Link
                      key={entity.id}
                      href={`/staff/returns?entityId=${entity.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    >
                      {entity.legalName}
                      {entity._count.taxReturns > 0 && (
                        <span className="text-gray-400">({entity._count.taxReturns})</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
