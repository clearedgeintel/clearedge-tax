import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultRedirect } from "@/lib/utils/permissions";
import type { UserRole } from "@/generated/prisma/enums";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(getDefaultRedirect(session.user.role as UserRole));
}
