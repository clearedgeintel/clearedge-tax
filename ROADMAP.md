# ClearEdge Tax — Product Roadmap

## Key Constraints (locked for v1)

- **Export-only filing.** ClearEdge does not file returns. It produces a reviewer-approved return package that is exported to external tax software (Drake, UltraTax, or Lacerte) for final filing.
- **Current tax year only.** v1 supports the current filing season. Prior-year returns, amendments, and multi-year carryforward tracking are deferred to Phase 3.
- **No IRS MeF integration.** In-platform e-file and e-sign require an ERO agreement and EFIN. This is a Phase 3 milestone.
- **Supported entity types at launch.** Individual (1040, including MFJ/MFS/HOH), S-Corp (1120-S), Partnership/LLC (1065), Sole Proprietorship (Schedule C), and Non-profit (990 family).
- **Multi-state support is scoped.** Supported states must be defined before build begins; unsupported states are hard-blocked at intake.

---

## Definition of Done for v1

A shippable v1 means a client can be onboarded, guided through an intake interview, have their documents collected, have their return prepared and reviewed by staff, and receive an export-ready return package — all with deadline tracking and an audit trail. Specifically:

- [x] Client-entity graph stores individuals, households, pass-through entities, and their links
- [x] Conditional intake interview runs end-to-end for every supported entity type, surfacing the correct questions and triggering the correct forms
- [x] Business returns (1120-S, 1065) close and issue K-1s before linked 1040s can advance
- [x] Federal and state deadlines (including extensions) are tracked per return; estimated payment reminders fire on schedule
- [x] Staff dashboard shows workload queue with per-return countdown and bottleneck alerts
- [x] Client portal displays real-time return status
- [x] Document upload and document-request triggers work for all entity types
- [x] Preparer → manager review/sign-off workflow gates export
- [x] Export package generator produces output accepted by Drake, UltraTax, or Lacerte
- [x] Audit trail logs every access, edit, review, and approval with timestamps

---

## Phase 0 — Pre-build (accounting deliverables, no code)

Phase 0 produces the reference artifacts that every downstream engineering decision depends on. Nothing is coded here — the output is documentation, decision trees, and data schemas that the tax and product teams must sign off on before development begins.

### Intake question matrix

- [x] Catalog every intake question across all supported entity types
- [x] Map every answer branch and its downstream consequences
- [x] Identify every form trigger (which answers cause which forms/schedules to be included)

### Form dependency map

- [x] Document cascading schedule and conditional logic (e.g., K-1 → Schedule E → Form 8582)
- [x] Map cross-entity dependencies (business K-1 feeds into individual return)
- [x] Identify all conditional schedules and when they activate

### Entity relationship schema

- [x] Define how individuals, pass-through entities, and households link
- [x] Model spousal relationships (MFJ, MFS), dependent chains, and ownership stakes
- [x] Document pass-through ownership chains (partner → partnership → S-Corp)

### 990 variant decision tree

- [x] Map gross receipts and asset thresholds to the correct 990 variant (990-N, 990-EZ, 990, 990-PF, 990-T)
- [x] Define the intake questions that drive variant selection
- [x] Document edge cases (e.g., organization changes size mid-year)

### Multi-state nexus rules

- [ ] Define the list of supported states at v1 launch
- [ ] Document nexus triggers for each supported state (physical presence, economic nexus, factor-based)
- [ ] Build hard-block logic for unsupported states at intake

---

## Phase 1 — Foundation (v1 core)

Phase 1 delivers the minimum viable product. At the end of this phase, the platform handles the full lifecycle — intake through export — for all supported entity types. Staff can manage workload, enforce review gates, and produce export-ready return packages.

### Data model

- [x] Client-entity graph: individuals, households, pass-through entities, dependency links
- [x] Entity ownership and relationship modeling (spousal, dependent, partner/shareholder)
- [ ] Versioned data storage for in-progress returns

### API layer

- [x] CRUD endpoints for clients, entities, and entity relationships
- [x] CRUD endpoints for tax returns with auto-computed deadlines
- [x] Firm-scoped multi-tenant data isolation on all endpoints
- [x] Role-based access control (CLIENT, PREPARER, MANAGER, ADMIN)
- [x] Interview response bulk save/retrieve endpoints
- [x] Document request and status management endpoints
- [x] Review action endpoints with status transition triggers
- [x] Admin endpoints for user and firm management

### Intake interview engine

- [x] Conditional question tree driven by Phase 0 intake matrix
- [x] Form trigger logic: answers activate or deactivate schedules and forms in real time
- [x] Dual view: client-facing guided interview and staff-facing data entry/override
- [x] Support for all entity types: 1040, 1120-S, 1065, Schedule C, 990 family

### Return sequencing engine

- [x] Enforce ordering: business returns must close and issue K-1s before linked 1040s can advance
- [x] K-1 data flows automatically into the recipient's individual return
- [x] Return status state machine (intake → preparation → review → approved → exported)

### Deadline engine

- [x] Standard federal deadlines per entity type (April 15, March 15, May 15 for 990s, etc.)
- [ ] State filing deadlines for all supported states
- [x] Extension tracking (Form 4868 for individuals, Form 7004 for businesses/990s)
- [x] Estimated tax payment reminders (quarterly schedule)
- [x] Automated alerts as deadlines approach (configurable warning thresholds)

### Staff dashboard

- [x] Workload queue: all active returns assigned to the logged-in preparer or manager
- [x] Per-return deadline countdown with color-coded urgency
- [x] Bottleneck alerts: returns blocked by missing documents, pending K-1s, or overdue reviews
- [x] Filter and sort by entity type, deadline, status, assigned staff

### Client portal

- [x] Real-time status display showing current phase of each return
- [x] Notification center for action items (documents needed, signature requests, etc.)
- [x] Secure login and session management

### Document collection

- [x] Client-facing upload interface with categorization (W-2, 1099, bank statements, etc.)
- [x] Document request triggers: system generates requests based on intake answers and form requirements
- [x] Staff view of received vs. outstanding documents per return

### Export package generator

- [x] Compile reviewer-approved return data into export format
- [x] Support output compatible with Drake, UltraTax, and Lacerte
- [x] Export is locked behind review/sign-off gate — cannot export unapproved returns

### Review and approval workflow

- [x] Preparer submits return for manager review
- [x] Manager review interface with annotation and rejection capability
- [x] Sign-off unlocks export; rejection routes back to preparer with notes
- [ ] Multi-level review support (preparer → reviewer → partner, if configured)

### Audit trail

- [x] Timestamped log of every access, edit, review, approval, and export event
- [x] Per-return and per-user audit history views
- [x] Immutable log storage (append-only)

---

## Phase 2 — Communication & Polish

Phase 2 layers automated client communication on top of the working platform. Staff no longer need to manually chase documents or send reminders — the system handles routine outreach and escalates exceptions.

### Automated communication layer

- [ ] Document request emails triggered by missing items
- [ ] Upload confirmation notifications to clients
- [ ] Deadline reminder emails (configurable timing per deadline type)
- [ ] Signature request emails when returns are ready for client approval
- [ ] Per-entity-type communication templates (990 clients receive different language than 1040 clients)

### Staff exception queue

- [ ] Dashboard for failed email sends, bounced messages, and delivery errors
- [ ] Unresponsive client tracking: flag clients who haven't acted on requests within configurable windows
- [ ] Overdue escalation workflows: auto-escalate to manager after N days without response

### Communication controls

- [ ] Do-not-automate flag per client (staff-set; disables all automated outreach for that client)
- [ ] Communication log per client: full history of sent messages, opens, and responses
- [ ] Template editor for staff to customize message content per entity type

---

## Phase 3 — Expansion

Phase 3 broadens the platform's capabilities beyond the v1 tax-year and entity-type boundaries. Each item in this phase is a significant initiative that may be prioritized independently.

### International module

- [ ] FBAR (FinCEN 114) support with separate filing calendar and thresholds
- [ ] Form 5471 (Information Return of U.S. Persons With Respect to Certain Foreign Corporations)
- [ ] FATCA reporting (Form 8938) with threshold-based triggering
- [ ] Separate international filing deadline tracking

### Additional entity types

- [ ] C-Corporation support (Form 1120)
- [ ] Consolidated return support for affiliated C-Corp groups (if demand warrants)

### Prior year and amendments

- [ ] Prior-year return preparation (1040-X, 1120-X)
- [ ] Amendment workflow with change-tracking against original filed return

### Multi-year carryforward tracking

- [ ] Net Operating Loss (NOL) carryforward ledger
- [ ] Passive activity loss tracking and release logic
- [ ] Credit carryforward tracking (general business credit, foreign tax credit, etc.)
- [ ] Carryforward balances surface automatically during current-year intake

### In-platform e-sign and e-file

- [ ] Electronic signature collection (8879, 8453, etc.)
- [ ] IRS MeF integration for direct e-filing (requires ERO agreement and EFIN)
- [ ] State e-file integration for supported states
- [ ] Filing status tracking and IRS acknowledgment handling

### Admin rule editor

- [ ] No-code interface for updating form trigger logic when tax law changes annually
- [ ] Intake question matrix maintenance without developer involvement
- [ ] Version control for rule changes with rollback capability
- [ ] Audit log for all rule modifications

---

## Open Decisions

These questions must be resolved before or during early Phase 1. Each has meaningful downstream impact on architecture, staffing, and timeline.

1. **Two UIs or one?** Build separate client and staff applications sharing a data layer, or a single application with role-based views? Separate apps offer cleaner UX per audience but double the frontend surface area. A shared app reduces duplication but risks complexity in permission logic and layout.

2. **Who maintains the intake question matrix as tax law changes?** If the internal tax team maintains it manually each year, Phase 0 artifacts need to be structured for easy annual updates. If the admin rule editor (Phase 3) is the long-term answer, the Phase 1 data model must anticipate that interface.

3. **Non-profit v1 scope.** Support all 990 variants (990-N, 990-EZ, 990, 990-PF, 990-T) at launch, or start with 990 and 990-EZ only? The full family adds complexity to the intake interview and form logic; a narrower scope reduces v1 delivery risk.

4. **Multi-state nexus: automatic or manual?** Should nexus be inferred automatically from entity data (registered states, revenue apportionment, employee locations), or should staff manually flag applicable states per client? Automatic is more powerful but requires more upfront rule engineering.

5. **Supported states at v1 launch.** The specific list of states must be locked before build begins. Each state adds deadline rules, filing requirements, and potential nexus logic. A smaller initial list reduces v1 scope; the platform should be architected so adding states later is incremental, not architectural.
