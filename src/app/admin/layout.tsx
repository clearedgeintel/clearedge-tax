import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <Link href="/admin/users" className="text-lg font-bold text-gray-900">
            ClearEdge Admin
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-3 text-sm">
          <Link
            href="/admin/users"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Users
          </Link>
          <Link
            href="/admin/firm"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Firm Settings
          </Link>
          <Link
            href="/staff/dashboard"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Staff Dashboard
          </Link>
        </nav>
        <div className="mt-auto border-t border-gray-200 p-3">
          <div className="text-xs text-gray-500">{session.user.name}</div>
          <div className="text-xs text-gray-400">Admin</div>
          <form
            action={async () => {
              "use server";
              const { signOut } = await import("@/lib/auth");
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="mt-2 text-xs text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 bg-gray-50">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
