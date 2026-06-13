import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Bell,
} from "lucide-react";
import { Sidebar, type NavSection } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

const SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        label: "My returns",
        href: "/returns",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: "Documents",
        href: "/documents",
        icon: <FolderOpen className="h-4 w-4" />,
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: <Bell className="h-4 w-4" />,
      },
    ],
  },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar
        brandHref="/dashboard"
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
