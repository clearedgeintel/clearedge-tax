import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-gray-900">
              ClearEdge Tax
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/returns"
                className="text-gray-600 hover:text-gray-900"
              >
                My Returns
              </Link>
              <Link
                href="/documents"
                className="text-gray-600 hover:text-gray-900"
              >
                Documents
              </Link>
              <Link
                href="/notifications"
                className="text-gray-600 hover:text-gray-900"
              >
                Notifications
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                const { signOut } = await import("@/lib/auth");
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-gray-500 hover:text-gray-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
