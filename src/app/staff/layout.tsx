import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  FileText,
} from "lucide-react";
import { Sidebar, type NavSection } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

const SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/staff/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        label: "Work queue",
        href: "/staff/queue",
        icon: <Inbox className="h-4 w-4" />,
      },
      {
        label: "Clients",
        href: "/staff/clients",
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: "Returns",
        href: "/staff/returns",
        icon: <FileText className="h-4 w-4" />,
      },
    ],
  },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar
        brandHref="/staff/dashboard"
        brandLabel="ClearEdge Tax"
        sections={SECTIONS}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          user={{
            name: session.user.name,
            email: session.user.email,
            role: session.user.role,
          }}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
