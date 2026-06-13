import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/utils/permissions";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  RolePill,
} from "@/components/ui";
import NewUserButton from "./NewUserButton";
import UserRowActions from "./UserRowActions";
import { UsersRound } from "lucide-react";

type SearchParams = Promise<{
  role?: string;
  isActive?: string;
  q?: string;
}>;

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/staff/dashboard");

  const firmId = session.user.firmId!;
  const sp = await searchParams;

  const where = {
    firmId,
    ...(sp.role
      ? { role: sp.role as "CLIENT" | "PREPARER" | "MANAGER" | "ADMIN" }
      : {}),
    ...(sp.isActive === "true" ? { isActive: true } : {}),
    ...(sp.isActive === "false" ? { isActive: false } : {}),
    ...(sp.q
      ? {
          OR: [
            { name: { contains: sp.q, mode: "insensitive" as const } },
            { email: { contains: sp.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          assignedReturns: true,
          reviewingReturns: true,
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Firm administration"
        title="Users"
        description="Invite new staff, change roles, or deactivate accounts."
        actions={<NewUserButton />}
      />

      <Card className="mb-4">
        <form
          action="/admin/users"
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="block flex-1 min-w-[160px]">
            <span className="block text-xs font-medium text-ink-muted mb-1">
              Search
            </span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q || ""}
              placeholder="Name or email"
              className="w-full rounded-md border border-border-strong px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="block w-40">
            <span className="block text-xs font-medium text-ink-muted mb-1">
              Role
            </span>
            <select
              name="role"
              defaultValue={sp.role || ""}
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="PREPARER">Preparer</option>
              <option value="CLIENT">Client</option>
            </select>
          </label>
          <label className="block w-40">
            <span className="block text-xs font-medium text-ink-muted mb-1">
              Status
            </span>
            <select
              name="isActive"
              defaultValue={sp.isActive || ""}
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Deactivated</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            Filter
          </button>
        </form>
      </Card>

      {users.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" />}
          title="No users match"
          description="Adjust your filters or invite someone new."
        />
      ) : (
        <Card flush>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th className="text-left px-5 py-3 font-medium">User</th>
                <th className="text-left px-5 py-3 font-medium">Role</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Workload</th>
                <th className="text-left px-5 py-3 font-medium">Joined</th>
                <th className="text-right px-5 py-3 font-medium">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-muted/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-xs text-ink-subtle">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <RolePill role={u.role} />
                  </td>
                  <td className="px-5 py-3">
                    {u.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Deactivated</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-muted">
                    {u._count.assignedReturns} prep · {u._count.reviewingReturns} review
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-muted">
                    {format(u.createdAt, "MMM d, yyyy")}
                  </td>
                  <td className="px-5 py-3">
                    <UserRowActions
                      userId={u.id}
                      role={u.role}
                      isActive={u.isActive}
                      isCurrentUser={u.id === session.user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
