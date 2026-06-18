import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { __test, boldsign } from "./boldsign";

describe("BoldSign status mapping", () => {
  it("translates the documented BoldSign statuses to our SignatureStatus enum", () => {
    expect(__test.mapStatus("Sent")).toBe("SENT");
    expect(__test.mapStatus("Delivered")).toBe("SENT");
    expect(__test.mapStatus("Viewed")).toBe("VIEWED");
    expect(__test.mapStatus("InProgress")).toBe("VIEWED");
    expect(__test.mapStatus("Completed")).toBe("SIGNED");
    expect(__test.mapStatus("Signed")).toBe("SIGNED");
    expect(__test.mapStatus("Declined")).toBe("DECLINED");
    expect(__test.mapStatus("Expired")).toBe("EXPIRED");
    expect(__test.mapStatus("Revoked")).toBe("CANCELLED");
    expect(__test.mapStatus("Failed")).toBe("FAILED");
  });

  it("falls back to SENT for unknown statuses (won't claim Completed by mistake)", () => {
    expect(__test.mapStatus("WeirdNewStatus")).toBe("SENT");
  });
});

describe("isConfigured", () => {
  const SAVED = process.env.BOLDSIGN_API_KEY;
  afterEach(() => {
    if (SAVED === undefined) {
      delete process.env.BOLDSIGN_API_KEY;
    } else {
      process.env.BOLDSIGN_API_KEY = SAVED;
    }
  });

  it("is false without a key set", () => {
    delete process.env.BOLDSIGN_API_KEY;
    expect(boldsign.isConfigured()).toBe(false);
  });

  it("is true with a key set", () => {
    process.env.BOLDSIGN_API_KEY = "abc";
    expect(boldsign.isConfigured()).toBe(true);
  });
});

describe("parseWebhook — signature verification", () => {
  const SAVED = process.env.BOLDSIGN_WEBHOOK_SECRET;
  beforeEach(() => {
    process.env.BOLDSIGN_WEBHOOK_SECRET = "test-secret-32-bytes-or-so-xxxxxx";
  });
  afterEach(() => {
    if (SAVED === undefined) {
      delete process.env.BOLDSIGN_WEBHOOK_SECRET;
    } else {
      process.env.BOLDSIGN_WEBHOOK_SECRET = SAVED;
    }
  });

  function sign(payload: object): string {
    return createHmac("sha256", process.env.BOLDSIGN_WEBHOOK_SECRET!)
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  it("accepts a payload with a valid signature", () => {
    const payload = { documentId: "doc-1", status: "Completed" };
    const sig = sign(payload);
    const out = boldsign.parseWebhook(payload, `sha256=${sig}`);
    expect(out).not.toBeNull();
    expect(out!.providerDocumentId).toBe("doc-1");
    expect(out!.status.status).toBe("SIGNED");
  });

  it("accepts unprefixed sha256 signatures", () => {
    const payload = { documentId: "doc-2", status: "Viewed" };
    const sig = sign(payload);
    const out = boldsign.parseWebhook(payload, sig);
    expect(out).not.toBeNull();
    expect(out!.status.status).toBe("VIEWED");
  });

  it("rejects a tampered payload", () => {
    const sig = sign({ documentId: "doc-1", status: "Viewed" });
    const tampered = { documentId: "doc-1", status: "Completed" };
    expect(() => boldsign.parseWebhook(tampered, sig)).toThrow(
      /signature mismatch/i
    );
  });

  it("returns null for payloads missing documentId", () => {
    const payload = { status: "Viewed" };
    const sig = sign(payload);
    expect(boldsign.parseWebhook(payload, sig)).toBeNull();
  });

  it("returns null for unknown event shapes (still secret-verified)", () => {
    const payload = { documentId: "doc-x" };
    const sig = sign(payload);
    // No status field → ignored.
    expect(boldsign.parseWebhook(payload, sig)).toBeNull();
  });
});

describe("parseWebhook — when no secret is configured", () => {
  const SAVED = process.env.BOLDSIGN_WEBHOOK_SECRET;
  beforeEach(() => {
    delete process.env.BOLDSIGN_WEBHOOK_SECRET;
  });
  afterEach(() => {
    if (SAVED !== undefined) process.env.BOLDSIGN_WEBHOOK_SECRET = SAVED;
  });

  it("parses without enforcing a signature", () => {
    const out = boldsign.parseWebhook(
      { documentId: "doc-1", status: "Signed" },
      undefined
    );
    expect(out).not.toBeNull();
    expect(out!.status.status).toBe("SIGNED");
  });
});
