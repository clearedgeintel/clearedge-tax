import { auth } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

interface RoleGateProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export async function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const session = await auth();

  if (!session?.user?.role || !roles.includes(session.user.role as UserRole)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
