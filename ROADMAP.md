# ClearEdge Tax — Product Roadmap

**Where we are**: the core lifecycle — client intake → conditional interview → document collection (with AI extraction) → multi-level review → JSON export — works end to end on real seed data. Email is wired. PII is encrypted. 130 unit/integration tests pass and a re-runnable smoke script proves the happy path. What remains for v1 ship-readiness is on Phase 2: real vendor-format exports, e-signature, scheduled reminders, broader extraction categories, and a few UX polish items.

---

## Key Constraints (locked for v1)

- **Export-only filing.** The platform produces a reviewer-approved return package exported to external tax software (Drake, UltraTax, Lacerte) for final filing. In-platform e-file is Phase 4.
- **Current tax year only.** v1 supports the current filing season. Prior-year returns, amendments, and multi-year carryforward tracking are deferred.
- **Supported entity types at launch.** Individual (1040, including MFJ/MFS/HOH), S-Corp (1120-S), Partnership/LLC (1065), Sole Proprietorship (Schedule C), and Non-profit (990 family). C-Corp is Phase 3.
- **AI-assisted, staff-reviewed.** Every AI-extracted field and pre-filled answer is a *proposal* — staff sign-off is required before export. The system never auto-files.
- **Multi-state support is scoped.** Initial state coverage (MN, CA, NY, WI, TX) ships in Phase 1; broader coverage in Phase 3.

---

## Definition of Done for v1

A shippable v1 means a client can be onboarded, guided through an intake interview, have their documents collected (with AI assistance), have their return prepared and reviewed by staff, and receive a vendor-software-ready export package — all with deadline tracking and an audit trail. Specifically:

- [x] Client-entity graph stores individuals, households, pass-through entities, and their links
- [x] Conditional intake interview runs end-to-end for every supported entity type
- [x] Business returns (1120-S, 1065) close and issue K-1s before linked 1040s can advance
- [x] Federal deadlines (and initial state set) tracked per return; estimated payment schedules per entity type
- [x] Staff dashboard shows workload queue with per-return countdown
- [x] Bottleneck alerts: returns blocked by K-1 dependencies surface in dashboard (missing-docs and overdue-review escalation still open)
- [x] Client portal displays real-time return status
- [x] Document upload backed by Supabase Storage with signed URLs
- [x] AI extraction of W-2, 1099-INT, 1099-DIV with proposed pre-fill into the interview
- [x] Pre-return document-collection campaigns at the client + tax-year level
- [x] Preparer → manager review/sign-off workflow gates export; optional partner-review tier per firm
- [x] PII (SSN, EIN, sensitive interview answers) encrypted at rest with audit logging on full reads
- [x] Audit trail logs every access, edit, review, approval, and export event
- [x] Internal export package generator produces a complete JSON of return data
- [ ] **Export package adapter to at least one vendor format (Drake CSV/Lacerte XML/UltraTax)**
- [ ] **E-signature on engagement letter and Form 8879 (or comparable workflow)**

The two unchecked items are the gating bar for v1 ship.

---

## Phase 0 — Pre-build artifacts ✅ Done

Phase 0 produces the reference data that every downstream engineering decision depends on. Nothing was coded here — the output is documentation and structured data the tax team signed off on.

- [x] Intake question matrix across all supported entity types, with answer branches and form triggers
- [x] Form dependency map: cascading schedules and cross-entity dependencies (K-1 → Schedule E → Form 8582)
- [x] Entity relationship schema: individuals, pass-through entities, households, ownership chains
- [x] 990 variant decision tree (990-N / 990-EZ / 990 / 990-PF / 990-T)
- [ ] Multi-state nexus rules (only initial five states defined; broader coverage in Phase 3)

---

## Phase 1 — Foundation 🟢 Substantially complete

Phase 1 delivers the minimum viable platform: full lifecycle, multi-tenant, role-gated, with the engines and integrations the rest of the roadmap builds on.

### Data + access layer
- [x] Client-entity graph with relationships (spousal, dependent, ownership)
- [x] Firm-scoped multi-tenancy on every endpoint
- [x] Role-based access control (CLIENT / PREPARER / MANAGER / ADMIN)
- [x] PII encryption at rest (AES-256-GCM, application layer)
- [x] Audit logger with buffered + critical-immediate writes
- [ ] Versioned data storage for in-progress returns (snapshot rollbacks)

### Engines
- [x] Conditional interview engine (operators, condition groups, repeatable instances)
- [x] Form trigger evaluator (interview answers → schedules/forms in real time)
- [x] Question matrix versioning per tax year (loader takes optional taxYear + JSON override)
- [x] Status state machine with K-1 dependency blocking + auto-unblock
- [x] Deadline calculator: federal + initial state set (MN, CA, NY, WI, TX), extensions, estimated payments, weekend roll-forward

### API + workflows
- [x] CRUD: clients, entities, returns, interview responses
- [x] Document request and status management
- [x] Review action endpoints driving status transitions
- [x] Admin: users, firm settings, audit-log viewer
- [x] Multi-level review (optional partner tier per firm)
- [x] Pre-return document-collection campaigns (client + tax-year scoped)

### Intake
- [x] Conditional question tree driven by Phase 0 matrix
- [x] Dual view: client-facing guided interview and staff-facing data entry
- [x] All supported entity types

### Staff dashboard
- [x] Workload queue + per-return deadline countdown with severity colors
- [x] K-1-blocked returns surface in dashboard
- [ ] Missing-document blocking surface (today: shown per return only, not as a dashboard bucket)
- [ ] Overdue-review escalation (today: surface returns past N days in REVIEW)

### Client portal
- [x] Real-time status display with progress bars
- [x] Notification center driven by document/deadline/status state
- [x] Document upload with signed-URL flow
- [x] Secure login + session management

### Document collection
- [x] Per-return request triggers driven by entity type + active forms
- [x] Pre-return collection campaigns at the client+year level
- [x] AI extraction for W-2, 1099-INT, 1099-DIV (Claude vision + tool-use)
- [x] Pre-fill interview answers from extracted fields with staff review

### Comms layer
- [x] Resend-backed outbound email with Communication-row audit
- [x] Document request emails (per-return and per-campaign)
- [x] Status change emails (APPROVED, REVISION, EXPORTED, BLOCKED)
- [ ] Deadline-reminder cron (template exists; scheduler does not)

### Export
- [x] Internal JSON export package (every interview answer, document metadata, K-1 links, deadlines, review history)
- [ ] **Vendor-format adapter (Drake / UltraTax / Lacerte)** — v1 ship gate

### Engineering quality
- [x] Vitest unit-test suite (130 tests across 10 files)
- [x] Re-runnable E2E smoke script (`scripts/e2e-happy-path.ts`)
- [ ] CI: run tests + typecheck on every push

---

## Phase 2 — v1 ship-ready polish 🚧 Up next

The bar to call v1 done. Most items here are well-scoped and would close in days, not weeks.

### Export adapters (highest leverage)
- [ ] Drake CSV / CDR adapter for individual returns (1040)
- [ ] One additional adapter (UltraTax XML or Lacerte) — choose based on existing user base
- [ ] Adapter test fixtures: round-trip a seeded return through each format

### Signatures
- [ ] DocuSign (or comparable) integration for engagement letters
- [ ] Form 8879 e-signature collection gated behind manager approval
- [ ] Signature status surfaced on return detail

### Scheduling
- [ ] Deadline-reminder cron (Vercel cron, Railway cron, or external scheduler)
- [ ] Daily sweep: find deadlines within configurable warning window, send reminders, mark as reminded
- [ ] Communication-row backed so reminders are deduped

### Extraction extensions
- [ ] K-1 extractor (1065 K-1 + 1120-S K-1) — schema is the hard part
- [ ] 1099-NEC / 1099-MISC extractors
- [ ] Mortgage interest (Form 1098) extractor
- [ ] Bank-statement extractor (transaction totals for Schedule C)
- [ ] "Mark reviewed" UX to flip extraction SUCCESS → REVIEWED
- [ ] Inline editor on extracted-fields modal (currently view-only)

### Pre-fill polish
- [ ] Multi-instance W-2 pre-fill (currently sums into a single answer)
- [ ] Auto-notification when a fresh extraction creates available pre-fills
- [ ] Per-row edit before apply in the PrefillPanel preview

### Review workflow polish
- [ ] Per-return partner override on the return detail page
- [ ] Richer audit description for partner-approval events
- [ ] PARTNER_REVIEW email to the assigned partner

### Dashboard
- [ ] Missing-document blocking bucket
- [ ] Overdue-review escalation surface

### Engineering
- [ ] GitHub Actions running tests + typecheck on PRs
- [ ] One vendor-format adapter test integrated into E2E walkthrough

---

## Phase 3 — Coverage expansion 📅

Beyond v1's locked scope. Each item here is its own initiative; they can ship independently.

### Broader entity + jurisdiction coverage
- [ ] C-Corporation (Form 1120) support
- [ ] Wider state deadline coverage (next ~15 states)
- [ ] Multi-state nexus auto-inference from entity data (registered states, revenue apportionment, employee locations)
- [ ] Hard-block logic for unsupported states at intake

### Prior year + amendments
- [ ] Prior-year return preparation (1040-X, 1120-X)
- [ ] Amendment workflow with change-tracking against the original filed return
- [ ] Carryforward ledger: NOL, passive activity losses, credit carryforwards

### Communication ops
- [ ] Staff exception queue: failed sends, bounces, delivery errors
- [ ] Unresponsive-client tracking with configurable thresholds
- [ ] Overdue-action escalation to manager
- [ ] Do-not-automate flag per client
- [ ] Template editor for staff to customize per-entity-type copy
- [ ] Per-client communication history view

### AI assist beyond pre-fill
- [ ] Anomaly detection (year-over-year deltas, missing-schedule prompts)
- [ ] Question-by-question copilot during interview
- [ ] Bulk operations across many clients (mass campaign, batch deadline check)

### Admin
- [ ] Admin rule editor for the question matrix (no-code yearly updates)
- [ ] Version-controlled rule changes with rollback
- [ ] Audit log for rule modifications

### Data + retention
- [ ] Data retention policies (per-firm configurable)
- [ ] Client data export (GDPR/CCPA)
- [ ] Redaction policies on audit-log views

---

## Phase 4 — Filing & advanced 📅

The deep-integration tier. Each item here is gated by external requirements (ERO, MeF, vendor partnerships) and is meaningful on its own.

### In-platform filing
- [ ] IRS MeF integration for direct e-filing (requires ERO agreement + EFIN)
- [ ] State e-file integration for supported states
- [ ] Filing status tracking + IRS acknowledgment handling
- [ ] Rejection workflow with re-submission tracking

### International module
- [ ] FBAR (FinCEN 114) with its own deadline calendar and thresholds
- [ ] Form 5471 (foreign corporation reporting)
- [ ] FATCA / Form 8938 with threshold-based triggering

### Consolidated returns
- [ ] Consolidated return support for affiliated C-Corp groups
- [ ] Inter-entity allocation tracking

---

## Decisions Resolved

These were open during early Phase 1 and are now locked.

1. **Two UIs or one?** — Single application with role-based views. Implemented across staff/portal/admin layouts.
2. **Document storage backend.** — Supabase Storage with server-issued signed URLs. Clients never touch storage credentials.
3. **Tax year semantics.** — IRS income-year convention (taxYear = year of income; FILING deadlines fall in taxYear + 1). Calculator and seed are aligned.
4. **Multi-level review configurability.** — Per-firm toggle (`requirePartnerReview`) with an optional default partner; per-return override available via API.
5. **AI extraction provider.** — Anthropic Claude Sonnet (vision + tool-use) for structured output. Forced tool-use prevents prose responses.
6. **PII encryption scope.** — Entity.tin and SSN/EIN interview answers encrypted at rest. Full reads audit-logged.
7. **Pre-return collection model.** — One DocumentCampaign per (client, tax year); campaign documents auto-link to matching returns at return-creation time.
8. **Comms provider.** — Resend. No-op stub when API key is missing (logs to Communication table without sending).

---

## Open Decisions

Still to resolve.

1. **Which vendor format(s) first?** Drake CSV is the most common starting point, but the choice should reflect the existing user base (or pilot firm preference). Decision needed before Phase 2 export-adapter work starts.

2. **Who maintains the intake question matrix?** Today the JSON files are edited directly. Phase 3's admin rule editor is the long-term answer, but the interim: does the internal tax team get a CLI tool, a private staging environment, or stay manual?

3. **Multi-state nexus: automatic or manual?** Phase 3 item. Automatic from entity data is more powerful but requires significant upfront rule engineering. Manual staff-flagging is simpler but error-prone.

4. **E-signature provider.** DocuSign is the safest pick but expensive; HelloSign / Dropbox Sign and BoldSign are cheaper. The integration shape is similar — decision is commercial.

5. **Deadline-reminder cadence + content.** How many touches per deadline? When? Tone? These are template decisions that affect deliverability and client perception.

6. **Bulk campaigns.** Should the firm be able to launch a campaign across multiple clients with one action ("send Individual basics to every active 1040 client for 2025")? This is a Phase 3 differentiator but worth deciding the data model now.

---

## Engineering practices

How the platform stays healthy as it grows.

- **Tests**: 130 unit/integration tests run via `npm test`. Re-runnable E2E walkthrough at `scripts/e2e-happy-path.ts` exercises the full lifecycle on seed data. Adding new engines should come with tests.
- **Migrations**: Prisma schema is the source of truth; production migrations applied via Supabase MCP (`apply_migration`) with explicit reviewable SQL.
- **Secrets**: never committed. `.mcp.json` is gitignored and reads from env. PII encryption keys, Anthropic and Supabase keys live in `.env` (gitignored) and Railway's env settings.
- **Audit trail**: every state-changing endpoint writes to AuditEvent. PII reads (full-tin views, export packages) are logged critically.
- **Observability**: standard Next.js logs. A future addition would be structured event logging to a dedicated sink.
