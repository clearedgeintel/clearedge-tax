import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminFirm() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Firm Settings</h1>
      <p className="mt-2 text-gray-600">
        Configure your firm details and preferences.
      </p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        Firm settings will be available here.
      </div>
    </div>
  );
}
