import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import UploadButton from "./UploadButton";
import ViewDocumentLink from "./ViewDocumentLink";

export default async function ClientDocuments() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-2 text-gray-600">Your account is being set up.</p>
      </div>
    );
  }

  const documents = await prisma.document.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    include: {
      taxReturn: {
        select: {
          taxYear: true,
          entity: { select: { legalName: true } },
        },
      },
    },
  });

  const requested = documents.filter((d) => d.status === "REQUESTED");
  const uploaded = documents.filter((d) => d.status === "UPLOADED");
  const reviewed = documents.filter(
    (d) => d.status === "ACCEPTED" || d.status === "REJECTED"
  );

  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    REQUESTED: { bg: "bg-orange-100", text: "text-orange-700", label: "Needed" },
    UPLOADED: { bg: "bg-blue-100", text: "text-blue-700", label: "Uploaded" },
    ACCEPTED: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    REJECTED: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      <p className="mt-2 text-gray-600">
        Upload requested documents and view your submissions.
      </p>

      {documents.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No document requests yet.
        </div>
      ) : (
        <>
          {/* Requested (action needed) */}
          {requested.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                Action Needed
                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                  {requested.length}
                </span>
              </h2>
              <div className="mt-3 space-y-2">
                {requested.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-orange-200 bg-orange-50"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">{doc.label}</h3>
                      <p className="text-xs text-gray-500">
                        {doc.category.replace(/_/g, " ")}
                        {doc.taxReturn && (
                          <span>
                            {" "}&middot; {doc.taxReturn.entity.legalName} ({doc.taxReturn.taxYear})
                          </span>
                        )}
                      </p>
                      {doc.requestNote && (
                        <p className="mt-1 text-xs text-gray-600">{doc.requestNote}</p>
                      )}
                    </div>
                    <UploadButton documentId={doc.id} label={doc.label} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All documents */}
          {(uploaded.length > 0 || reviewed.length > 0) && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Submitted Documents</h2>
              <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">For</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...uploaded, ...reviewed].map((doc) => {
                      const style = statusStyles[doc.status];
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {doc.label}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {doc.category.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {doc.taxReturn?.entity.legalName || "--"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {doc.uploadedAt
                              ? format(doc.uploadedAt, "MMM d, yyyy")
                              : format(doc.createdAt, "MMM d, yyyy")}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {doc.storageKey ? (
                              <ViewDocumentLink documentId={doc.id} />
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
