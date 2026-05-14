import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/utils/permissions";
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
    <div>
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Interview — {taxReturn.entity.legalName}
            </h1>
            <p className="text-sm text-gray-500">
              Tax Year {taxReturn.taxYear} &middot; Status: {taxReturn.status}
              {taxReturn.preparer && (
                <span> &middot; Preparer: {taxReturn.preparer.name}</span>
              )}
            </p>
          </div>
          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
            Staff View
          </span>
        </div>
      </div>
      <InterviewClient
        returnId={returnId}
        entityType={taxReturn.entity.entityType}
        filingStatus={taxReturn.entity.filingStatus ?? undefined}
        isStaff={true}
      />
    </div>
  );
}
