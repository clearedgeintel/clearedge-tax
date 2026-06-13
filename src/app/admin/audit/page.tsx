import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/utils/permissions";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  EmptyState,
} from "@/components/ui";
import { ScrollText } from "lucide-react";

const PAGE_SIZE = 50;

type SearchParams = Promise<{
  user?: string;
  category?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

export default async function AdminAuditLog({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/staff/dashboard");

  const firmId = session.user.firmId!;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const fromDate = sp.from ? new Date(sp.from) : undefined;
  const toDate = sp.to ? new Date(sp.to + "T23:59:59") : undefined;

  const baseFilter = {
    OR: [
      { user: { firmId } },
      { taxReturn: { entity: { client: { firmId } } } },
    ],
  };

  const where = {
    AND: [
      baseFilter,
      ...(sp.user ? [{ userId: sp.user }] : []),
      ...(sp.category ? [{ eventCategory: sp.category }] : []),
      ...(sp.type ? [{ eventType: sp.type }] : []),
      ...(fromDate || toDate
        ? [
            {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            },
          ]
        : []),
    ],
  };

  const [events, total, users, categoryRows, typeRows] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        taxReturn: {
          select: {
            id: true,
            entity: { select: { legalName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
    prisma.user.findMany({
      where: { firmId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditEvent.groupBy({
      by: ["eventCategory"],
      where: baseFilter,
      orderBy: { eventCategory: "asc" },
    }),
    prisma.auditEvent.groupBy({
      by: ["eventType"],
      where: baseFilter,
      orderBy: { eventType: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    !!sp.user || !!sp.category || !!sp.type || !!sp.from || !!sp.to;

  return (
    <>
      <PageHeader
        eyebrow="Firm administration"
        title="Audit log"
        description={`${total.toLocaleString()} event${total === 1 ? "" : "s"} recorded across all firm activity.`}
        actions={
          hasFilters ? (
            <Button href="/admin/audit" variant="secondary" size="sm">
              Clear filters
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <form
          action="/admin/audit"
          method="get"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
        >
          <FilterField label="User">
            <select
              name="user"
              defaultValue={sp.user || ""}
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Category">
            <select
              name="category"
              defaultValue={sp.category || ""}
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All categories</option>
              {categoryRows.map((c) => (
                <option key={c.eventCategory} value={c.eventCategory}>
                  {c.eventCategory}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Event type">
            <select
              name="type"
              defaultValue={sp.type || ""}
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All types</option>
              {typeRows.map((t) => (
                <option key={t.eventType} value={t.eventType}>
                  {t.eventType.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="From">
            <input
              type="date"
              name="from"
              defaultValue={sp.from || ""}
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
            />
          </FilterField>

          <FilterField label="To">
            <div className="flex gap-2">
              <input
                type="date"
                name="to"
                defaultValue={sp.to || ""}
                className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
              />
              <button
                type="submit"
                className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
              >
                Apply
              </button>
            </div>
          </FilterField>
        </form>
      </Card>

      {events.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title={hasFilters ? "No events match these filters" : "No activity yet"}
          description={
            hasFilters
              ? "Try widening the time range or removing a filter."
              : "Once your team starts working, audit events will appear here."
          }
        />
      ) : (
        <Card flush>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border-subtle text-xs text-ink-subtle uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-medium">When</th>
                <th className="text-left px-5 py-3 font-medium">User</th>
                <th className="text-left px-5 py-3 font-medium">Category</th>
                <th className="text-left px-5 py-3 font-medium">Event</th>
                <th className="text-left px-5 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-surface-muted/60">
                  <td className="px-5 py-3 text-xs text-ink-muted whitespace-nowrap">
                    {format(e.createdAt, "MMM d, yyyy")}
                    <span className="text-ink-subtle"> · {format(e.createdAt, "HH:mm")}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-ink whitespace-nowrap">
                    {e.user?.name || (
                      <span className="text-ink-subtle italic">System</span>
                    )}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Badge tone="neutral">{e.eventCategory}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-ink-muted whitespace-nowrap">
                    {e.eventType}
                  </td>
                  <td className="px-5 py-3 text-sm text-ink">
                    {e.description}
                    {e.taxReturn && (
                      <Link
                        href={`/staff/returns/${e.taxReturn.id}`}
                        className="ml-2 text-xs text-brand-700 hover:text-brand-800"
                      >
                        {e.taxReturn.entity.legalName} →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3 text-sm">
              <span className="text-ink-subtle">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button
                    href={buildPageHref(sp, page - 1)}
                    variant="secondary"
                    size="sm"
                  >
                    Previous
                  </Button>
                )}
                {page < totalPages && (
                  <Button
                    href={buildPageHref(sp, page + 1)}
                    variant="secondary"
                    size="sm"
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-muted mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function buildPageHref(
  sp: Record<string, string | undefined>,
  page: number
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") params.set(k, v);
  }
  params.set("page", String(page));
  return `/admin/audit?${params.toString()}`;
}
