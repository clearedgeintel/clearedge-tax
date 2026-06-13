import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/utils/permissions";
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  EmptyState,
  Button,
} from "@/components/ui";
import { Building2 } from "lucide-react";
import FirmSettingsForm from "./FirmSettingsForm";

export default async function AdminFirm() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/staff/dashboard");

  const firmId = session.user.firmId;
  if (!firmId) {
    return (
      <>
        <PageHeader
          eyebrow="Firm administration"
          title="Firm settings"
          description="Your admin account isn't linked to a firm."
        />
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No firm linked to this account"
          description="Contact support to provision a firm record."
          action={
            <Button href="mailto:support@clearedgeintel.com" variant="primary">
              Contact support
            </Button>
          }
        />
      </>
    );
  }

  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    include: {
      _count: { select: { users: true, clients: true } },
    },
  });

  if (!firm) {
    return (
      <PageHeader
        eyebrow="Firm administration"
        title="Firm settings"
        description="Firm record not found."
      />
    );
  }

  type AddressShape = { street?: string; city?: string; state?: string; zip?: string };
  const address =
    firm.address && typeof firm.address === "object" && !Array.isArray(firm.address)
      ? (firm.address as AddressShape)
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Firm administration"
        title="Firm settings"
        description="Update your firm's identity and contact information."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Firm users" value={firm._count.users} tone="accent" href="/admin/users" />
        <Stat label="Active clients" value={firm._count.clients} tone="brand" href="/staff/clients" />
        <Stat
          label="Firm ID"
          value={<span className="text-xs font-mono">{firm.id.slice(-8)}</span>}
          tone="neutral"
        />
      </div>

      <Card flush>
        <CardHeader
          title="Identity & contact"
          description="Shown on client communications and exported return packages."
        />
        <div className="p-5">
          <FirmSettingsForm
            initial={{
              name: firm.name,
              ein: firm.ein,
              phone: firm.phone,
              address,
            }}
          />
        </div>
      </Card>
    </>
  );
}
