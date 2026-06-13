"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  documentId: string;
  label: string;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress?: number }
  | { phase: "error"; message: string };

export default function UploadButton({ documentId, label }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });

  async function handleFile(file: File) {
    setState({ phase: "uploading" });

    try {
      // 1. Ask the server for a signed upload URL.
      const initRes = await fetch(`/api/documents/${documentId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to start upload (${initRes.status})`);
      }
      const init = (await initRes.json()) as {
        uploadUrl: string;
        storageKey: string;
        maxFileSize: number;
      };

      if (file.size > init.maxFileSize) {
        throw new Error(
          `File too large. Max ${Math.round(init.maxFileSize / 1024 / 1024)}MB.`
        );
      }

      // 2. PUT the file directly to Supabase Storage.
      const putRes = await fetch(init.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(`Upload to storage failed (${putRes.status}): ${text}`);
      }

      // 3. Mark the document UPLOADED and stamp the storage metadata.
      const patchRes = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "UPLOADED",
          storageKey: init.storageKey,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      if (!patchRes.ok) {
        const body = await patchRes.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to record upload (${patchRes.status})`);
      }

      setState({ phase: "idle" });
      router.refresh();
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={`Upload file for ${label}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state.phase === "uploading"}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {state.phase === "uploading" ? "Uploading..." : "Upload"}
      </button>
      {state.phase === "error" && (
        <p className="text-xs text-red-600 max-w-xs text-right">{state.message}</p>
      )}
    </div>
  );
}
