import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ScrollText,
  ExternalLink,
} from "lucide-react";
import { Sidebar, type NavSection } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

const SECTIONS: NavSection[] = [
  {
    heading: "Firm administration",
    items: [
      {
        label: "Overview",
        href: "/admin/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        label: "Users",
        href: "/admin/users",
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: "Firm settings",
        href: "/admin/firm",
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        label: "Audit log",
        href: "/admin/audit",
        icon: <ScrollText className="h-4 w-4" />,
      },
    ],
  },
  {
    heading: "Cross-references",
    items: [
      {
        label: "Staff view",
        href: "/staff/dashboard",
        icon: <ExternalLink className="h-4 w-4" />,
      },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar
        brandHref="/admin/dashboard"
        brandLabel="ClearEdge Admin"
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
