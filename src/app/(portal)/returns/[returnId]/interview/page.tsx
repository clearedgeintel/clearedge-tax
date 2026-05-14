import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientRecordForUser } from "@/lib/api/helpers";
import InterviewClient from "@/components/interview/InterviewClient";

interface Props {
  params: Promise<{ returnId: string }>;
}

export default async function ClientInterviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { returnId } = await params;

  // Verify the return belongs to this client
  const clientRecord = await getClientRecordForUser(
    session.user.id,
    session.user.firmId!
  );
  if (!clientRecord) redirect("/dashboard");

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: returnId,
      entity: { clientId: clientRecord.id },
    },
    include: {
      entity: { select: { entityType: true, filingStatus: true, legalName: true } },
    },
  });

  if (!taxReturn) redirect("/returns");

  // Clients can only do intake interview during INTAKE status
  const readOnly = taxReturn.status !== "INTAKE";

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Tax Interview — {taxReturn.entity.legalName}
        </h1>
        <p className="text-sm text-gray-500">
          Tax Year {taxReturn.taxYear}
          {readOnly && (
            <span className="ml-2 text-amber-600 font-medium">(Read-only)</span>
          )}
        </p>
      </div>
      <InterviewClient
        returnId={returnId}
        entityType={taxReturn.entity.entityType}
        filingStatus={taxReturn.entity.filingStatus ?? undefined}
        isStaff={false}
      />
    </div>
  );
}
