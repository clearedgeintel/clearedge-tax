import { describe, expect, it } from "vitest";
import { CAMPAIGN_TEMPLATES, getTemplate } from "./templates";

describe("Campaign templates", () => {
  it("exports at least one template", () => {
    expect(CAMPAIGN_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("every template has a unique id", () => {
    const ids = CAMPAIGN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template has at least one item", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(t.items.length).toBeGreaterThan(0);
    }
  });

  it("every template item has a non-empty label and a category", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      for (const item of t.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.category).toBeDefined();
      }
    }
  });

  it("getTemplate returns the named template", () => {
    const first = CAMPAIGN_TEMPLATES[0];
    expect(getTemplate(first.id)).toEqual(first);
  });

  it("getTemplate returns undefined for an unknown id", () => {
    expect(getTemplate("does-not-exist")).toBeUndefined();
  });

  it("includes an Individual basics template with W-2 + prior-year return", () => {
    const t = getTemplate("individual-basics");
    expect(t).toBeDefined();
    const categories = t!.items.map((i) => i.category);
    expect(categories).toContain("W2");
    expect(categories).toContain("PRIOR_RETURN");
  });
});
