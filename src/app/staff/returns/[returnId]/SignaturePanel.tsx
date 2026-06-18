"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardHeader, Button, Badge } from "@/components/ui";
import { FileSignature, RefreshCcw, X } from "lucide-react";

type SignatureStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "SIGNED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED";

type SignatureDocumentType =
  | "ENGAGEMENT_LETTER"
  | "FORM_8879"
  | "FORM_8453"
  | "OTHER";

interface SignatureRequest {
  id: string;
  documentType: SignatureDocumentType;
  status: SignatureStatus;
  signerEmail: string;
  signerName: string;
  subject: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiresAt: string | null;
  errorMessage: string | null;
  providerDocumentId: string | null;
  createdAt: string;
}

interface Props {
  returnId: string;
  clientId: string;
  defaultSignerEmail: string;
  defaultSignerName: string;
  initialRequests: SignatureRequest[];
}

const STATUS_TONE: Record<
  SignatureStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "info",
  SIGNED: "success",
  DECLINED: "danger",
  EXPIRED: "warning",
  CANCELLED: "neutral",
  FAILED: "danger",
};

const DOC_TYPE_LABEL: Record<SignatureDocumentType, string> = {
  ENGAGEMENT_LETTER: "Engagement letter",
  FORM_8879: "Form 8879",
  FORM_8453: "Form 8453",
  OTHER: "Document",
};

export default function SignaturePanel({
  returnId,
  clientId,
  defaultSignerEmail,
  defaultSignerName,
  initialRequests,
}: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [composing, setComposing] = useState(false);

  // Poll in-flight requests every 15s so terminal transitions land in the UI
  // even without a webhook delivery.
  useEffect(() => {
    const pending = requests.filter(
      (r) => r.status === "SENT" || r.status === "VIEWED"
    );
    if (pending.length === 0) return;
    const id = setInterval(async () => {
      let dirty = false;
      const next = await Promise.all(
        requests.map(async (r) => {
          if (r.status !== "SENT" && r.status !== "VIEWED") return r;
          const res = await fetch(`/api/signatures/${r.id}?sync=1`);
          if (!res.ok) return r;
          const { signatureRequest } = await res.json();
          if (signatureRequest && signatureRequest.status !== r.status) {
            dirty = true;
            return signatureRequest as SignatureRequest;
          }
          return r;
        })
      );
      if (dirty) {
        setRequests(next);
        router.refresh();
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [requests, router]);

  return (
    <Card flush>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-brand-700" />
            E-signature requests
          </span>
        }
        description="Send the client an engagement letter or Form 8879 via BoldSign."
        actions={
          composing ? null : (
            <Button size="sm" onClick={() => setComposing(true)}>
              Send for signature
            </Button>
          )
        }
      />

      {composing && (
        <ComposeForm
          returnId={returnId}
          clientId={clientId}
          defaultEmail={defaultSignerEmail}
          defaultName={defaultSignerName}
          onCancel={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            router.refresh();
          }}
        />
      )}

      {requests.length === 0 ? (
        !composing && (
          <p className="px-5 py-4 text-sm text-ink-muted">
            No signature requests yet for this return.
          </p>
        )
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Document</th>
              <th className="text-left px-5 py-2.5 font-medium">Signer</th>
              <th className="text-left px-5 py-2.5 font-medium">Status</th>
              <th className="text-left px-5 py-2.5 font-medium">Timeline</th>
              <th className="text-right px-5 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-surface-muted/60 align-top">
                <td className="px-5 py-2.5 text-sm text-ink">
                  <div className="font-medium">{DOC_TYPE_LABEL[r.documentType]}</div>
                  {r.subject && (
                    <div className="text-xs text-ink-subtle truncate max-w-xs">
                      {r.subject}
                    </div>
                  )}
                </td>
                <td className="px-5 py-2.5 text-xs text-ink-muted">
                  <div className="text-ink">{r.signerName}</div>
                  <div className="text-ink-subtle">{r.signerEmail}</div>
                </td>
                <td className="px-5 py-2.5">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  {r.errorMessage && (
                    <div className="mt-0.5 text-[10px] text-danger max-w-xs">
                      {r.errorMessage}
                    </div>
                  )}
                </td>
                <td className="px-5 py-2.5 text-[11px] text-ink-subtle">
                  {r.sentAt && <div>Sent {format(new Date(r.sentAt), "MMM d, h:mm a")}</div>}
                  {r.viewedAt && <div>Viewed {format(new Date(r.viewedAt), "MMM d, h:mm a")}</div>}
                  {r.signedAt && <div>Signed {format(new Date(r.signedAt), "MMM d, h:mm a")}</div>}
                  {r.declinedAt && <div>Declined {format(new Date(r.declinedAt), "MMM d, h:mm a")}</div>}
                  {r.expiresAt && <div>Expires {format(new Date(r.expiresAt), "MMM d")}</div>}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <RowActions request={r} onChange={() => router.refresh()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function RowActions({
  request,
  onChange,
}: {
  request: SignatureRequest;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const canCancel =
    request.status === "SENT" ||
    request.status === "VIEWED" ||
    request.status === "DRAFT" ||
    request.status === "FAILED";

  async function sync() {
    setBusy(true);
    await fetch(`/api/signatures/${request.id}?sync=1`);
    setBusy(false);
    onChange();
  }

  async function cancel() {
    if (!confirm("Cancel this signature request?")) return;
    setBusy(true);
    await fetch(`/api/signatures/${request.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Cancelled by staff" }),
    });
    setBusy(false);
    onChange();
  }

  return (
    <div className="inline-flex items-center gap-2">
      {(request.status === "SENT" || request.status === "VIEWED") && (
        <button
          type="button"
          onClick={sync}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand-700 disabled:opacity-50"
          title="Refresh status from provider"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {busy ? "…" : "Refresh"}
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-danger disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      )}
    </div>
  );
}

function ComposeForm({
  returnId,
  clientId,
  defaultEmail,
  defaultName,
  onCancel,
  onSent,
}: {
  returnId: string;
  clientId: string;
  defaultEmail: string;
  defaultName: string;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [docType, setDocType] = useState<SignatureDocumentType>("ENGAGEMENT_LETTER");
  const [signerName, setSignerName] = useState(defaultName);
  const [signerEmail, setSignerEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Pick a PDF to send for signature.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const uploadRes = await fetch(`/api/signatures/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, filename: file.name }),
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body?.error || `upload-url failed (${uploadRes.status})`);
      }
      const upload = (await uploadRes.json()) as {
        uploadUrl: string;
        storageKey: string;
        maxFileSize: number;
      };
      if (file.size > upload.maxFileSize) {
        throw new Error(
          `File too large. Max ${Math.round(upload.maxFileSize / 1024 / 1024)}MB.`
        );
      }

      const putRes = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload to storage failed (${putRes.status})`);

      const createRes = await fetch(`/api/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnId,
          clientId,
          documentType: docType,
          sourceStorageKey: upload.storageKey,
          documentName:
            subject ||
            (docType === "ENGAGEMENT_LETTER"
              ? "Engagement letter"
              : docType === "FORM_8879"
                ? "Form 8879"
                : docType === "FORM_8453"
                  ? "Form 8453"
                  : "Document for signature"),
          signerEmail,
          signerName,
          subject: subject || undefined,
          message: message || undefined,
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body?.error || `create failed (${createRes.status})`);
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-b border-border-subtle bg-surface-muted/50 px-5 py-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Document type" required>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as SignatureDocumentType)}
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="ENGAGEMENT_LETTER">Engagement letter</option>
            <option value="FORM_8879">Form 8879</option>
            <option value="FORM_8453">Form 8453</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="PDF file" required>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-ink"
          />
        </Field>
        <Field label="Signer name" required>
          <input
            type="text"
            required
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-sm text-ink"
          />
        </Field>
        <Field label="Signer email" required>
          <input
            type="email"
            required
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-sm text-ink"
          />
        </Field>
      </div>

      <Field label="Subject (optional)">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="E.g. Engagement letter for tax year 2025"
          className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-sm text-ink"
        />
      </Field>

      <Field label="Message to signer (optional)">
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-sm text-ink"
        />
      </Field>

      {error && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || !file}>
          {busy ? "Sending..." : "Send for signature"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
