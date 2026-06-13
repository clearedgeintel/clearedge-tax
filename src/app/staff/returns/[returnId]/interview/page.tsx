import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/utils/permissions";
import { PageHeader, Badge, Button, ReturnStatusPill } from "@/components/ui";
import InterviewClient from "@/components/interview/InterviewClient";

interface Props {
  params: Promise<{ returnId: string }>;
}

export default async function StaffInterviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    redirect("/login");
  }

  const { returnId } = await params;

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: returnId,
      entity: { client: { firmId: session.user.firmId! } },
    },
    include: {
      entity: {
        select: { entityType: true, filingStatus: true, legalName: true },
      },
      preparer: { select: { name: true } },
    },
  });

  if (!taxReturn) redirect("/staff/returns");

  return (
    <>
      <PageHeader
        eyebrow={`Tax year ${taxReturn.taxYear}`}
        title={`Interview — ${taxReturn.entity.legalName}`}
        description={
          taxReturn.preparer
            ? `Preparer: ${taxReturn.preparer.name}`
            : "No preparer assigned"
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusPill status={taxReturn.status} />
            <Badge tone="brand">Staff view</Badge>
          </div>
        }
        actions={
          <Button
            href={`/staff/returns/${returnId}`}
            variant="secondary"
            size="sm"
          >
            Back to return
          </Button>
        }
      />

      <InterviewClient
        returnId={returnId}
        entityType={taxReturn.entity.entityType}
        filingStatus={taxReturn.entity.filingStatus ?? undefined}
        isStaff={true}
      />
    </>
  );
}
