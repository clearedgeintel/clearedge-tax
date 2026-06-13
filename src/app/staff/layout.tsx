import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <Link href="/staff/dashboard" className="flex items-center">
            <Image
              src="/ClearEdge_Tax_Logo.png"
              alt="ClearEdge Tax"
              width={40}
              height={40}
              priority
              unoptimized
            />
            <span className="ml-2 text-sm font-semibold text-gray-900">
              ClearEdge Tax
            </span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-3 text-sm">
          <Link
            href="/staff/dashboard"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </Link>
          <Link
            href="/staff/queue"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Work Queue
          </Link>
          <Link
            href="/staff/clients"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Clients
          </Link>
          <Link
            href="/staff/returns"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Returns
          </Link>
        </nav>
        <div className="mt-auto border-t border-gray-200 p-3">
          <div className="text-xs font-medium text-gray-900">{session.user.name}</div>
          <div className="text-xs text-gray-600 capitalize">
            {session.user.role.toLowerCase()}
          </div>
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

      {/* Main content */}
      <div className="flex-1 bg-gray-50">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
