import { describe, expect, it } from "vitest";
import {
  deadlineReminderEmail,
  documentRequestEmail,
  statusChangeEmail,
} from "./templates";

describe("documentRequestEmail", () => {
  it("singular vs plural subject", () => {
    const one = documentRequestEmail({
      clientName: "John",
      documentLabels: ["W-2"],
      portalUrl: "https://example.test/documents",
    });
    expect(one.subject).toContain("a document");

    const many = documentRequestEmail({
      clientName: "John",
      documentLabels: ["W-2", "1099-INT", "Prior return"],
      portalUrl: "https://example.test/documents",
    });
    expect(many.subject).toContain("3 documents");
  });

  it("includes every document label in both text and html", () => {
    const r = documentRequestEmail({
      clientName: "Jane",
      documentLabels: ["W-2", "Mortgage statement"],
      returnLegalName: "Jane Smith",
      portalUrl: "https://example.test/documents",
    });
    expect(r.text).toContain("W-2");
    expect(r.text).toContain("Mortgage statement");
    expect(r.text).toContain("Jane Smith");
    expect(r.html).toContain("W-2");
    expect(r.html).toContain("Mortgage statement");
    expect(r.html).toContain("https://example.test/documents");
  });

  it("escapes HTML in user-supplied content", () => {
    const r = documentRequestEmail({
      clientName: "<script>x</script>",
      documentLabels: ["<b>label</b>"],
      portalUrl: "https://example.test/documents",
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("&lt;b&gt;label&lt;/b&gt;");
  });

  it("uses a stable template id", () => {
    expect(
      documentRequestEmail({
        clientName: "X",
        documentLabels: ["Y"],
        portalUrl: "z",
      }).templateId
    ).toBe("document-request@v1");
  });
});

describe("statusChangeEmail", () => {
  const base = {
    clientName: "John",
    returnLegalName: "John Smith",
    taxYear: 2025,
    portalUrl: "https://example.test/returns",
  };

  it("uses an action-needed subject for REVISION", () => {
    const r = statusChangeEmail({ ...base, newStatus: "REVISION" });
    expect(r.subject).toMatch(/revisions requested/i);
    expect(r.templateId).toBe("status-change-revision@v1");
  });

  it("APPROVED template congratulates", () => {
    const r = statusChangeEmail({ ...base, newStatus: "APPROVED" });
    expect(r.subject).toMatch(/approved/i);
    expect(r.text).toContain("approved");
  });

  it("includes preparer note when present, omits when not", () => {
    const withNote = statusChangeEmail({
      ...base,
      newStatus: "REVISION",
      note: "Need updated W-2",
    });
    expect(withNote.text).toContain("Need updated W-2");

    const withoutNote = statusChangeEmail({
      ...base,
      newStatus: "REVISION",
    });
    expect(withoutNote.text).not.toContain("Preparer note");
  });

  it("escapes the note in HTML", () => {
    const r = statusChangeEmail({
      ...base,
      newStatus: "REVISION",
      note: "<img src=x onerror=1>",
    });
    expect(r.html).not.toContain("<img");
    expect(r.html).toContain("&lt;img");
  });
});

describe("deadlineReminderEmail", () => {
  it("uses 'overdue' subject for negative days", () => {
    const r = deadlineReminderEmail({
      clientName: "John",
      returnLegalName: "John Smith",
      deadlineLabel: "FILING",
      dueDate: "April 15, 2026",
      daysRemaining: -3,
      portalUrl: "https://example.test/returns",
    });
    expect(r.subject).toMatch(/overdue/i);
    expect(r.text).toContain("3 days ago");
  });

  it("uses 'today' for 0 days", () => {
    const r = deadlineReminderEmail({
      clientName: "John",
      returnLegalName: "John Smith",
      deadlineLabel: "FILING",
      dueDate: "April 15, 2026",
      daysRemaining: 0,
      portalUrl: "https://example.test/returns",
    });
    expect(r.text).toContain("that's today");
  });

  it("pluralizes days correctly", () => {
    const one = deadlineReminderEmail({
      clientName: "John",
      returnLegalName: "John Smith",
      deadlineLabel: "FILING",
      dueDate: "April 15, 2026",
      daysRemaining: 1,
      portalUrl: "https://example.test/returns",
    });
    expect(one.subject).toContain("1 day until");

    const many = deadlineReminderEmail({
      clientName: "John",
      returnLegalName: "John Smith",
      deadlineLabel: "FILING",
      dueDate: "April 15, 2026",
      daysRemaining: 7,
      portalUrl: "https://example.test/returns",
    });
    expect(many.subject).toContain("7 days until");
  });
});
