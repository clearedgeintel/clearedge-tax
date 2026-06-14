import type { DocumentCategory } from "@/generated/prisma/enums";

/**
 * Pre-baked campaign templates. Each is just a list of (category, label)
 * pairs that get turned into REQUESTED Document rows when the campaign is
 * created. Staff can add/remove items before sending — these are starting
 * points, not requirements.
 */

export interface CampaignDocItem {
  category: DocumentCategory;
  label: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  items: CampaignDocItem[];
}

const INDIVIDUAL_BASICS: CampaignTemplate = {
  id: "individual-basics",
  name: "Individual basics",
  description:
    "W-2s, the most common 1099s, and a prior-year return. Use for wage-earners with simple investment income.",
  items: [
    { category: "W2", label: "W-2 wage statements" },
    { category: "F1099_INT", label: "1099-INT interest statements" },
    { category: "F1099_DIV", label: "1099-DIV dividend statements" },
    { category: "PRIOR_RETURN", label: "Prior year tax return" },
  ],
};

const SELF_EMPLOYED: CampaignTemplate = {
  id: "self-employed",
  name: "Self-employed / Schedule C",
  description:
    "Adds business income records, business bank statements, and depreciation. For sole proprietors and single-member LLCs.",
  items: [
    { category: "F1099_NEC", label: "1099-NEC contractor income" },
    { category: "F1099_MISC", label: "1099-MISC miscellaneous income" },
    { category: "BANK_STATEMENT", label: "Business bank statements (full year)" },
    { category: "FINANCIAL_STATEMENT", label: "Business income & expense summary" },
    { category: "DEPRECIATION_SCHEDULE", label: "Asset depreciation schedule" },
    { category: "PRIOR_RETURN", label: "Prior year tax return" },
  ],
};

const INVESTOR: CampaignTemplate = {
  id: "investor",
  name: "Investor",
  description:
    "Brokerage 1099s, retirement distributions, K-1s. For clients with meaningful investment activity.",
  items: [
    { category: "F1099_INT", label: "1099-INT interest statements" },
    { category: "F1099_DIV", label: "1099-DIV dividend statements" },
    { category: "F1099_B", label: "1099-B brokerage sale statements" },
    { category: "F1099_R", label: "1099-R retirement distributions" },
    { category: "K1_1065", label: "K-1 from any partnerships" },
    { category: "K1_1120S", label: "K-1 from any S-corps" },
    { category: "PRIOR_RETURN", label: "Prior year tax return" },
  ],
};

const HOMEOWNER: CampaignTemplate = {
  id: "homeowner",
  name: "Homeowner",
  description:
    "Mortgage, property tax, and charitable receipts. Use with Individual basics for itemizers.",
  items: [
    { category: "MORTGAGE_STATEMENT", label: "Mortgage interest statement (Form 1098)" },
    { category: "PROPERTY_TAX", label: "Property tax statements" },
    { category: "CHARITABLE_RECEIPT", label: "Charitable donation receipts" },
  ],
};

const BUSINESS_RETURN: CampaignTemplate = {
  id: "business-return",
  name: "Business return (S-corp / partnership)",
  description:
    "Year-end financials, bank statements, prior return. For pass-through entity engagements.",
  items: [
    { category: "FINANCIAL_STATEMENT", label: "Year-end financial statements" },
    { category: "BANK_STATEMENT", label: "Business bank statements (full year)" },
    { category: "DEPRECIATION_SCHEDULE", label: "Asset depreciation schedule" },
    { category: "PRIOR_RETURN", label: "Prior year business return" },
  ],
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  INDIVIDUAL_BASICS,
  SELF_EMPLOYED,
  INVESTOR,
  HOMEOWNER,
  BUSINESS_RETURN,
];

export function getTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
