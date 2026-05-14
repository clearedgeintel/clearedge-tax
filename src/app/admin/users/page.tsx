import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminUsers() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-gray-600">Manage user accounts and roles.</p>
        </div>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Add User
        </button>
      </div>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        User management will be available here.
      </div>
    </div>
  );
}
