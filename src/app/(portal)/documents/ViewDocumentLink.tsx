"use client";

import { useState } from "react";

interface Props {
  documentId: string;
}

export default function ViewDocumentLink({ documentId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/download-url`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load (${res.status})`);
      }
      const { downloadUrl } = (await res.json()) as { downloadUrl: string };
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
      >
        {loading ? "Loading..." : "View"}
      </button>
      {error && <span className="text-xs text-red-600 mt-0.5">{error}</span>}
    </div>
  );
}
