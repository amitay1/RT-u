# Scan Master - Technical and Architectural Software Bible

This document provides a professional technical reference for the Scan Master software system: product scope, architecture, core modules, security posture, NDT/Aerospace readiness, licensing, deployment, known gaps, and the future integration path with ScanMaster CSI / Robot control software.

The document is intended as a technical reference. It is not a marketing document, not a regulatory certification document, and not a substitute for review by an NDT Level III, quality team, security team, or legal advisor. Its purpose is to show what exists in the system, what is partially implemented, and what should be completed before external production use or enterprise deployment.

## Categorized Table of Contents / תוכן עניינים לפי קטגוריות

Use this section as the main map for the document. The content is organized by category so a reader can jump to the right area without scanning all 64 sections.

השתמש בחלק הזה כמפת ניווט ראשית למסמך. התוכן מסודר לפי קטגוריות כדי שאפשר יהיה להגיע במהירות לנושא הכללי הנכון בלי לעבור על כל 64 הסעיפים.

| Category / קטגוריה | What It Covers / מה זה כולל | Sections / סעיפים |
| --- | --- | --- |
| Product and workflow / מוצר וזרימת עבודה | Product purpose, supported documents, user workflow, and core capabilities | [1. Executive Summary](#1-executive-summary), [2. Product Definition](#2-product-definition), [3. Core Capabilities](#3-core-capabilities) |
| Architecture and code map / ארכיטקטורה ומפת קוד | Application layers, technology stack, main code areas, web/desktop responsibilities, and UI state model | [4. Architecture Overview](#4-architecture-overview), [5. Tech Stack](#5-tech-stack), [6. Key Code Areas](#6-key-code-areas), [7. Web vs Desktop Responsibilities](#7-web-vs-desktop-responsibilities), [8. State and UI Model](#8-state-and-ui-model) |
| Data, tenancy, and API boundaries / נתונים, ארגונים וגבולות API | Storage, core records, multi-tenant ownership, authentication, backend API, and Supabase responsibilities | [9. Data Storage](#9-data-storage), [10. Multi-Tenant Model](#10-multi-tenant-model), [11. Authentication and Authorization](#11-authentication-and-authorization), [12. API and Backend](#12-api-and-backend), [13. Supabase](#13-supabase) |
| Security and hardening / אבטחה והקשחה | Existing security layers, production gaps, secrets, validation, XSS/CSP, Electron, and CAD/Python risk | [14. Existing Security Layers](#14-existing-security-layers), [15. Security Gaps Before Production](#15-security-gaps-before-production), [16. Secrets and Sensitive Files](#16-secrets-and-sensitive-files), [17. SQL Injection and Input Validation](#17-sql-injection-and-input-validation), [18. XSS and CSP](#18-xss-and-csp), [19. Electron Security](#19-electron-security), [20. CAD and Python Engine](#20-cad-and-python-engine) |
| Commercial, release, and operations / מסחר, הפצה ותפעול | Licensing, payments, installer, download gate, privacy, logs, retention, backups, telemetry, and license behavior | [21. Licensing](#21-licensing), [22. Payments](#22-payments), [23. Updates and Installer](#23-updates-and-installer), [24. Download Gate](#24-download-gate), [25. Privacy, Logs, and Retention](#25-privacy-logs-and-retention), [34. Disaster Recovery and Backups](#34-disaster-recovery-and-backups), [35. Telemetry and Crash Reports](#35-telemetry-and-crash-reports), [36. License Expiry and Revocation](#36-license-expiry-and-revocation) |
| Quality and repository readiness / איכות ומוכנות קוד | Tests, dependency audit, CI/CD, repository hygiene, and handoff readiness | [26. Quality and Tests](#26-quality-and-tests), [27. Dependency Audit](#27-dependency-audit), [28. CI/CD](#28-cicd), [29. Repository Hygiene](#29-repository-hygiene) |
| NDT/Aerospace readiness / מוכנות NDT ותעופה | Compliance positioning, audit trail, standards versioning, residency/export control, concurrent editing, equipment, evidence, and enterprise integrations | [30. NDT/Aerospace Compliance Positioning](#30-ndtaerospace-compliance-positioning), [31. Audit Trail and Signed Reports](#31-audit-trail-and-signed-reports), [32. Standards Versioning](#32-standards-versioning), [33. Data Residency, ITAR, Export Control, and GDPR](#33-data-residency-itar-export-control-and-gdpr), [37. Concurrent Editing](#37-concurrent-editing), [38. Instrument Integration](#38-instrument-integration), [39. Customer-Supplied Standards](#39-customer-supplied-standards), [40. Units and Internationalization](#40-units-and-internationalization), [41. Calibration Traceability](#41-calibration-traceability), [42. Image and Evidence Handling](#42-image-and-evidence-handling), [43. PLM, MES, and QMS Integration](#43-plm-mes-and-qms-integration) |
| CSI / ScanMaster integration / אינטגרציית CSI / ScanMaster | Existing integration foundation, system boundaries, file/API requirements, robot/machine data, workflow, safety, pilot criteria, and requests to ScanMaster | [44. CSI / ScanMaster Robot Integration Overview](#44-csi-scanmaster-robot-integration-overview), [45. Existing CSI-Relevant Components](#45-existing-csi-relevant-components), [46. MCIO Instrument Window Reference](#46-mcio-instrument-window-reference), [47. System Boundary](#47-system-boundary), [48. Integration Levels](#48-integration-levels), [49. Required Information About CSI / Setup File Format](#49-required-information-about-csi-setup-file-format), [50. Required Information About Communication/API](#50-required-information-about-communicationapi), [51. Required Information About Robot, Machine, and Axes](#51-required-information-about-robot-machine-and-axes), [52. Required Information About UT Acquisition](#52-required-information-about-ut-acquisition), [53. Operator Workflow](#53-operator-workflow), [54. Results Import](#54-results-import), [55. Safety and Dry-Run](#55-safety-and-dry-run), [56. Pilot Acceptance Criteria](#56-pilot-acceptance-criteria), [57. Business and Technical Value of Integration](#57-business-and-technical-value-of-integration), [58. Technical Requests to ScanMaster](#58-technical-requests-to-scanmaster) |
| Gaps, plan, and references / פערים, תוכנית ומקורות | Strengths, known gaps, closure plan, follow-up file map, references, and document status | [59. Strengths](#59-strengths), [60. Known Gaps](#60-known-gaps), [61. Recommended Closure Plan](#61-recommended-closure-plan), [62. File Map for Follow-Up Questions](#62-file-map-for-follow-up-questions), [63. Official References](#63-official-references), [64. Document Status](#64-document-status) |

## Quick Topic Finder / איתור מהיר לפי נושא

| If You Need / אם צריך | Go To / עבור אל |
| --- | --- |
| Understand what the software does / להבין מה התוכנה עושה | Sections 1-3 |
| Find where a feature lives in code / למצוא איפה פיצ'ר נמצא בקוד | Sections 6 and 62 |
| Review security before production / לבדוק אבטחה לפני פרודקשן | Sections 14-20 and 60-61 |
| Prepare for customer or enterprise handoff / להתכונן למסירה ללקוח או לארגון | Sections 25-29, 34-36, and 60-61 |
| Check NDT/Aerospace traceability requirements / לבדוק דרישות עקיבות ל-NDT ותעופה | Sections 30-43 |
| Work on CSI / ScanMaster integration / לעבוד על אינטגרציית CSI / ScanMaster | Sections 44-58 |
| Decide what to fix first / להחליט מה לתקן קודם | Sections 15, 60, and 61 |

## 1. Executive Summary

Scan Master is a software system for creating Technique Sheets and Inspection Reports for Ultrasonic Testing / NDT workflows. The system combines a rich UI, domain calculations, standards support, equipment and calibration data, technical drawings, document export, Electron desktop mode, and an initial technical foundation for future CSI / ScanMaster control software integration.

Current system status:

| Area | Current Status |
| --- | --- |
| Product and domain | Meaningful functionality exists for NDT document generation, calculations, auto-fill, drawings, and export. |
| Frontend | React + TypeScript + Vite with contexts, hooks, and many UI components. |
| Backend | Express API, Drizzle/Postgres/Supabase, and routes for storage, CAD, licensing, and related services. |
| Desktop | Electron with preload bridge, local storage, offline license manager, and update mechanisms. |
| Tests | `npm test` passed with 291 tests; `npm run typecheck` passed. |
| Security | Helmet, CORS, rate limiting, validation, Supabase RLS, and partial Electron hardening exist. |
| Gaps | Development/mock auth, broad CSP, update server hardening, audit findings, lint issues, and unsigned installer. |
| CSI / Robot | Initial `csiExporter`, patch generation, OEM rules, and DAC/TCG calculators exist; real integration requires technical data from ScanMaster. |

## 2. Product Definition

The product core is the creation of work and inspection documentation for UT/NDT processes. The system supports documenting and preparing data such as:

- Part details: part number, part name, material, dimensions, and drawing reference.
- Standard or procedure: AMS, ASTM, BS-EN, MIL-STD, NDIP/MRO assets, and customer procedures.
- Equipment details: instrument, transducer, wedge, couplant, and calibration blocks.
- Scan parameters: method, scan type, speed, index, water path, PRF, gain, and gates.
- Acceptance criteria: discontinuity limits, back reflection loss, noise level, and special requirements.
- Documentation metadata: inspector, certification, procedure number, revision, and inspection date.
- Export: PDF, DOCX, technical drawings, and initial CSI setup export.

The system should be positioned as a decision-support, documentation, and traceability tool. Final professional decisions in NDT remain the responsibility of certified personnel, internal procedures, and the applicable Level III authority.

## 3. Core Capabilities

| Capability | Description |
| --- | --- |
| Technique Sheet generation | Creates a full setup with part, equipment, calibration, scan, acceptance, and documentation data. |
| Inspection Report generation | Creates reports with cover data, equipment, diagrams, indications, results, and certification data. |
| Standards support | Uses data and assets for multiple standards and procedures. |
| Auto-fill and calculations | Calculation engines, calibration recommendations, standard matching, DAC/TCG, and coverage assistance. |
| Technical drawings | CAD and diagram generation paths for technical documentation. |
| Desktop mode | Electron wrapper for desktop operation and local workflows. |
| Cloud storage | Supabase/Postgres based storage paths with RLS foundations. |
| Licensing | License key, offline license, and activation foundations. |
| Distribution | Download gate and desktop packaging foundations. |
| CSI foundation | Initial setup export and integration planning code. |

### Main Workflow Map / מפת זרימת עבודה ראשית

This workflow map is included because it connects the product capabilities to the real user journey. It is not a new feature claim; it is a categorized reading map for how the existing software pieces fit together.

מפת זרימה זו נוספה כדי לחבר בין יכולות המוצר לבין המסלול המעשי של המשתמש. זו אינה הצהרת פיצ'ר חדשה, אלא מפת קריאה שמסדרת איך החלקים הקיימים בתוכנה מתחברים.

| Step / שלב | Workflow Area / אזור עבודה | Typical Data / מידע טיפוסי | Main Output / תוצר עיקרי |
| --- | --- | --- | --- |
| 1 | Project and part setup / הגדרת פרויקט וחלק | Customer, part number, material, dimensions, drawing, revision | Controlled inspection context |
| 2 | Standard and procedure selection / בחירת תקן ונוהל | AMS/ASTM/BS-EN/MIL/NDIP/customer procedure, revision, acceptance class | Applicable rule context |
| 3 | Equipment and calibration / ציוד וכיול | Instrument, probe, wedge, couplant, calibration block, certificates | Traceable setup basis |
| 4 | Scan planning / תכנון סריקה | Method, scan type, path, speed, index, water path, gates, DAC/TCG | Technique Sheet setup |
| 5 | Documentation and review / תיעוד ובדיקה | Inspector, qualification, notes, drawings, evidence, checklist | Review-ready document |
| 6 | Export and approval / יצוא ואישור | PDF/DOCX package, revision metadata, signatures when available | Technique Sheet or Inspection Report |
| 7 | Future integration / אינטגרציה עתידית | CSI setup export, result import, scan metadata | Machine setup traceability path |

## 4. Architecture Overview

The system is built as a hybrid web and desktop application:

| Layer | Role |
| --- | --- |
| React/Vite UI | Main application surface for forms, workflows, reports, and diagrams. |
| Domain utilities | Standards logic, calculations, autofill, exporters, report generation, and NDT-specific helpers. |
| Express API | Backend routes for storage, CAD, licensing, and operational services. |
| Supabase/Postgres | Auth-adjacent storage, structured data, RLS, and persistence. |
| Electron shell | Desktop runtime, local file access boundaries, preload bridge, and offline workflows. |
| Python/CAD tooling | Technical drawing and CAD related processing. |
| Download gate | Distribution and license-gated installer access. |

The architecture is pragmatic and product-oriented: the frontend contains significant domain behavior, while backend and desktop paths provide persistence, export, licensing, and integration surfaces.

## 5. Tech Stack

| Layer | Technologies |
| --- | --- |
| UI | React 18, TypeScript, Vite |
| Styling/UI | Tailwind/shadcn-style components, custom diagrams, charts |
| State | React contexts, custom hooks, local storage fallback |
| Backend | Express, Node.js |
| Database | PostgreSQL, Drizzle, Supabase |
| Auth/storage | Supabase client and RLS foundations |
| Desktop | Electron, preload APIs, IPC boundaries |
| CAD/drawings | Python scripts, report and drawing utilities |
| Testing | Vitest/Jest style tests, TypeScript typecheck |
| Packaging | Electron builder / installer related assets |
| Distribution | Download gate and drive-uploader support |

## 6. Key Code Areas

| Area | Representative Files |
| --- | --- |
| Main UI | `src/App.tsx`, `src/pages/Index.tsx` |
| Authentication | `src/hooks/useAuth.tsx`, Supabase integration files |
| Forms and reports | `src/components`, report-related utilities |
| Standards | `standards/`, `src/utils/standards`, domain helpers |
| CSI export | `src/utils/exporters/csiExporter.ts` |
| CAD/drawings | CAD utilities, Python scripts, drawing generators |
| Backend | `server/`, Express route files |
| Database | Drizzle schema, Supabase migrations/policies |
| Electron | `electron/`, preload, main process, local services |
| Licensing | license manager, activation and offline license utilities |
| Distribution | `download-gate/drive-uploader`, installer and release assets |
| Documentation | `docs/`, production readiness and setup documentation |

## 7. Web vs Desktop Responsibilities

| Capability | Web | Desktop/Electron |
| --- | --- | --- |
| UI workflows | Primary | Same UI inside desktop shell |
| Cloud storage | Supabase backed | Can use cloud and local fallback paths |
| Local file access | Browser-limited | Controlled via Electron preload/IPC |
| Offline usage | Limited | Designed for offline license and local operation paths |
| Installer distribution | Not applicable | Electron packaging and installer pipeline |
| Security risk | Browser and API security | Browser plus local OS access risk |

Electron provides important product value, but it also increases the security responsibility. The preload bridge, IPC handlers, local server, update mechanism, and file access paths must remain narrow and audited.

### Operating Modes and Environments / מצבי הפעלה וסביבות

The document should distinguish between operating modes because the same feature can have different risk in browser, desktop, offline, staging, and production contexts.

המסמך צריך להבדיל בין מצבי הפעלה, כי אותו פיצ'ר יכול להיות בעל סיכון שונה בדפדפן, בדסקטופ, באופליין, בסטייג'ינג ובפרודקשן.

| Mode / מצב | Purpose / מטרה | Production Expectation / ציפייה לפרודקשן |
| --- | --- | --- |
| Local development / פיתוח מקומי | Developer testing, mock flows, fast iteration | Must not be confused with customer production behavior |
| Web app / אפליקציית Web | Browser-based customer workflow | Auth, RLS, API authorization, CSP, and storage policies enforced |
| Electron desktop / דסקטופ Electron | Local desktop workflow and controlled file access | Hardened preload, signed builds, offline policy, local data protection |
| Offline desktop / דסקטופ אופליין | Work where network access is limited | Signed offline license, local backup/export path, clear sync limitations |
| Staging / סביבת בדיקות | Customer-like validation before release | Separate data, separate secrets, release smoke testing |
| Production / פרודקשן | Real customer data and commercial usage | No mock auth, rotated secrets, audit logging, monitored backups |

## 8. State and UI Model

The UI is built around React contexts, hooks, and domain-specific components. The application contains many form sections and report generation flows, with domain calculations embedded in utility layers.

This is effective for product velocity, but production hardening should include:

- Clear ownership boundaries between UI state and domain state.
- Regression tests for critical calculations.
- Validation at the boundary before saving or exporting data.
- Consistent schema definitions for records that move between UI, backend, database, and export formats.

## 9. Data Storage

The system uses a combination of:

- Supabase/Postgres for structured cloud data.
- Local storage for browser and desktop fallback workflows.
- Electron/local paths for offline or desktop-specific data.
- File-based assets under `standards/`, documentation, and CAD resources.

Production usage should define a clear data classification model:

| Data Type | Sensitivity |
| --- | --- |
| User account data | Personal / operational |
| Customer and organization data | Commercially sensitive |
| Part numbers and serials | Potentially controlled or proprietary |
| Inspection reports | Quality record / potentially regulated |
| Standards and procedures | Licensed or customer confidential |
| Logs and crash data | May contain PII or controlled data |
| License records | Commercial and operational |

### Core Records and Traceability Map / מפת רשומות ועקיבות

This is a practical data map for product and audit discussions. It reflects the main record types already represented by the codebase or product workflow, and highlights what each record must stay linked to.

זו מפת נתונים שימושית לדיוני מוצר וביקורת. היא משקפת את סוגי הרשומות המרכזיים שכבר קיימים בקוד או בזרימת העבודה, ומדגישה למה כל רשומה צריכה להיות מקושרת.

| Record / רשומה | Purpose / מטרה | Must Link To / חייב להיות מקושר אל |
| --- | --- | --- |
| Organization / ארגון | Customer or tenant boundary | Users, sheets, standards access, licenses, equipment |
| User and inspector profile / משתמש ופרופיל בודק | Identity, qualification, and signature metadata | Organization, certification, approvals, report events |
| Technique Sheet / כרטיס טכניקה | Planned inspection setup | Part, standard revision, equipment, calibration, scan parameters |
| Inspection Report / דוח בדיקה | Final inspection record | Technique Sheet, evidence, results, inspector, approval state |
| Standard or procedure / תקן או נוהל | Rule source for auto-fill and acceptance logic | Revision, effective date, rule snapshot, approval owner |
| Equipment / ציוד | Instruments, probes, wedges, blocks, and related assets | Calibration status, serial number, certificates, usage history |
| License and activation / רישיון ואקטיבציה | Commercial entitlement and offline access | Organization, device, purchased standards, expiry/revocation state |
| Export artifact / קובץ יצוא | PDF/DOCX/CSI/export package | Source record, revision, timestamp, signer, hash when required |
| Audit event / אירוע ביקורת | Evidence of important action or change | Actor, organization, record, timestamp, before/after state |

## 10. Multi-Tenant Model

The system contains organization-oriented concepts and Supabase RLS foundations. For enterprise readiness, the tenant boundary must be explicit:

- Every customer-owned record should include organization ownership.
- RLS policies must enforce organization isolation.
- Backend routes must not trust client-side organization IDs without server-side authorization.
- Admin capabilities must be separated from regular inspector capabilities.
- Support access must be logged and limited.

## 11. Authentication and Authorization

The current system includes authentication-related code paths, but production readiness requires replacing development and mock modes with a real, enforced authentication model.

Required production model:

| Requirement | Expected State |
| --- | --- |
| Auth provider | Supabase Auth or equivalent production identity layer |
| Sessions | Verified server-side JWT/session middleware |
| Roles | Admin, manager, inspector, viewer, support |
| Organization isolation | Enforced in DB and API |
| Audit events | Login, export, report lock, admin changes |
| Service keys | Server-only, never exposed to the client |

## 12. API and Backend

The Express backend provides operational APIs. It should be treated as a security boundary, not only as a convenience layer.

Production requirements:

- Authentication middleware on protected routes.
- Authorization checks per organization and role.
- Request validation with schemas.
- Rate limiting on sensitive endpoints.
- No development bypasses in production.
- Structured error handling without leaking internals.
- Request logging without sensitive payloads.

## 13. Supabase

Supabase is used as a database and platform foundation. Enterprise usage should clarify:

- Project region and data residency.
- RLS policy coverage.
- Backup and PITR availability.
- Auth configuration.
- Service role key handling.
- Storage bucket policies.
- DPA and compliance posture for relevant customers.

No compliance claim should be made solely because the system uses Supabase. The application configuration, RLS, data model, and operational process determine the actual security posture.

## 14. Existing Security Layers

Current security-related layers include:

| Layer | Current Value |
| --- | --- |
| Helmet | Baseline HTTP header hardening. |
| CORS | Controls browser access boundaries. |
| Rate limiting | Reduces abuse and brute-force risk. |
| Validation | Helps block malformed data. |
| Supabase RLS | Foundation for row-level security. |
| Electron hardening | Some security options and preload boundaries exist. |
| Dependency audits | Known vulnerability visibility exists. |

These are useful foundations, but they are not the same as full production hardening.

## 15. Security Gaps Before Production

| Priority | Topic | Current State | Required Action |
| --- | --- | --- | --- |
| P0 | Express auth | Mock/development auth paths exist | Real JWT middleware and removal of production bypasses |
| P0 | Dependencies | `npm audit` found vulnerabilities | Upgrade, verify, and run regression tests |
| P0 | Secrets/archive | Some local/archive secrets are not fully tracked or rotated | Clean, rotate, and define secret ownership |
| P0 | Signed reports | No complete immutable audit trail / cryptographic signature model | Report lock, hash, revision, and audit events |
| P0 | Standards versioning | Not enough to preserve standard revision per sheet | Store rule snapshot, revision, and effective date |
| P0 | Update server | Admin APIs and storage need hardening | Admin auth, persistent DB, rate limit, audit log |
| P0 | Desktop signing | Windows signing is not fully production-ready | Code signing certificate and signed releases |
| P1 | Electron security | CSP is broad and `no-sandbox` exists | Harden CSP, sandbox review, protocol filtering |
| P1 | Webhook | Signature verification is not fully enforced everywhere | Verify webhook signatures in all environments |
| P1 | Local server | Electron server on port 5000 | Bind to `127.0.0.1` and block network exposure |
| P1 | CSI/Robot integration | Initial exporter only | Schema, samples, API, machine limits, and safety workflow |
| P2 | Tests | Unit tests exist, missing full E2E/security coverage | Add Playwright/API/security regression workflows |

## 16. Secrets and Sensitive Files

Current hygiene expectations:

- `git ls-files` should show `.env.example` and `.env.production.template`, not real `.env` or `.env.local` files.
- `.gitignore` includes `download-gate/drive-uploader/credentials.json` and other local credential paths.
- License archive files under `docs/archive/licenses/` should be treated as review-needed and test-only unless proven otherwise.
- Download gate access codes appearing in setup scripts require rotation before production release or handoff.

This document does not include the actual access code value.

## 17. SQL Injection and Input Validation

The use of structured query builders and Supabase APIs reduces SQL injection risk, but it does not eliminate validation requirements.

Required safeguards:

- Validate every API payload.
- Avoid raw SQL unless parameterized.
- Keep service role keys server-only.
- Do not trust client-provided organization IDs.
- Test authorization failures, not only success paths.

## 18. XSS and CSP

The system handles rich UI, report data, and customer-provided text. XSS risk should be managed through:

- Escaping output in reports and previews.
- Avoiding unsafe HTML injection.
- Restricting CSP for production.
- Reviewing PDF/HTML export rendering paths.
- Sanitizing uploaded or imported customer content.

## 19. Electron Security

Electron increases risk because the app runs near the local operating system. Required hardening includes:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- Narrow preload API surface.
- IPC allowlists.
- No arbitrary file read/write from renderer code.
- Local server bound to `127.0.0.1`.
- Update package signature verification.
- Review of `no-sandbox` usage.

## 20. CAD and Python Engine

CAD and drawing generation are important product capabilities, but they create operational questions:

- Which inputs are accepted?
- Are file paths sanitized?
- Can Python scripts execute arbitrary user input?
- Are generated files stored safely?
- Is output deterministic and testable?
- Who owns maintenance of the drawing engine?

Production readiness requires clear ownership, test fixtures, and a runbook for the CAD/Python pipeline.

## 21. Licensing

The system includes license key, activation, and offline license foundations. Enterprise readiness requires a defined licensing policy:

| Scenario | Expected Behavior |
| --- | --- |
| License valid | Full access according to purchased plan |
| License expired | Read-only mode or controlled grace period |
| License revoked | Block new activation and optionally restrict access |
| Offline use | Local signed license with expiration and grace policy |
| Key leaked | Server-side revocation list and customer reissue flow |
| Audit | Activation, device, organization, and license events |

The license model should preserve customer access to existing data even when commercial enforcement blocks new activity.

## 22. Payments

Payment code paths appear to include both real and mock or incomplete flows. Production requirements:

- Single payment source of truth.
- Verified payment webhooks.
- No client-side trust for paid status.
- Clear plan mapping to product entitlements.
- Refund/cancel/downgrade handling.
- Admin override with audit logging.

## 23. Updates and Installer

Desktop release readiness requires:

- Signed installer.
- Signed update packages.
- Defined update channel: stable, beta, internal.
- Rollback strategy.
- Version compatibility policy.
- Release notes.
- Malware/SmartScreen reputation planning for Windows.

## 24. Download Gate

The download gate provides controlled installer access. Production expectations:

- No hard-coded long-term access code in public or semi-public files.
- Rotation process.
- Rate limiting.
- Audit logging.
- Expiring links or keys.
- Separation between demo, staging, and production downloads.

## 25. Privacy, Logs, and Retention

Logs and crash data can contain sensitive customer information. A production policy should define:

- What is logged.
- Where logs are stored.
- Who can access logs.
- Retention period.
- Whether logs include PII, part numbers, serials, file paths, or customer names.
- Export and deletion requests.
- Support access logging.

### Support, Diagnostics, and Recovery / תמיכה, דיאגנוסטיקה ושחזור

The codebase includes diagnostics and recovery-oriented pieces, so the production documentation should define what support data can be collected and how it is handled.

בקוד קיימים חלקים שקשורים לדיאגנוסטיקה ושחזור, ולכן תיעוד הפרודקשן צריך להגדיר איזה מידע תמיכה אפשר לאסוף ואיך מטפלים בו.

| Area / תחום | Required Definition / הגדרה נדרשת |
| --- | --- |
| Diagnostic export / יצוא דיאגנוסטיקה | Exact fields included, redaction rules, and customer approval flow |
| Crash recovery / שחזור מקריסה | What is saved locally, how long it remains, and how users restore work |
| Support access / גישת תמיכה | Who can access customer records, under what approval, and how access is logged |
| Update recovery / שחזור אחרי עדכון | How drafts are preserved before update install and restored after restart |
| Incident response / טיפול באירוע | Owner, severity levels, customer notification, and remediation record |

## 26. Quality and Tests

Current validation includes passing tests and typecheck. Additional production quality coverage should include:

- End-to-end flows for creating and exporting Technique Sheets.
- Report generation regression tests.
- Standards and calculation golden tests.
- Authorization tests.
- Electron smoke tests.
- Upgrade and migration tests.
- Import/export fixture tests.

## 27. Dependency Audit

Known dependency vulnerabilities must be treated as a release blocker if they affect runtime, server, Electron, or build output.

Process:

- Run `npm audit`.
- Classify findings by runtime exposure.
- Upgrade dependencies in controlled batches.
- Run tests and typecheck.
- Verify Electron packaging after upgrades.
- Document accepted risks if any are deferred.

## 28. CI/CD

Recommended CI pipeline:

| Stage | Purpose |
| --- | --- |
| Install | Reproducible dependency installation |
| Typecheck | TypeScript safety |
| Unit tests | Domain and utility regression |
| Lint | Code style and bug detection |
| Security audit | Dependency and secret checks |
| Build | Web build |
| Electron package | Desktop artifact validation |
| E2E smoke | Critical user flows |
| Release | Signed artifacts and release notes |

## 29. Repository Hygiene

Handoff readiness requires:

- Clear setup instructions.
- Clean environment variable templates.
- No real credentials in the repo.
- Documentation for release and restore operations.
- Owner map for frontend, backend, Electron, CAD, standards, and licensing.
- Seed/demo data that is clearly marked and safe.
- Separation of archive, demo, production, and test artifacts.

## 30. NDT/Aerospace Compliance Positioning

The system can support NDT/Aerospace workflows, but it does not by itself certify a process or organization.

Correct positioning:

| Topic | Position |
| --- | --- |
| Nadcap | The system can help with documentation and traceability, but Nadcap accreditation belongs to the process, organization, and audit scope. |
| AS9100 | The system can support quality records, but AS9100 certification is an organizational QMS matter. |
| NAS 410 / EN 4179 | The system can store inspector qualification metadata, but personnel certification remains outside the software. |
| AMS/ASTM | The system can reference and apply rule data, but standard interpretation requires controlled revisions and qualified review. |
| 21 CFR Part 11 | Only applicable if customer scope requires electronic records/signatures in regulated environments. Current state should not be claimed as compliant without additional controls. |

## 31. Audit Trail and Signed Reports

A likely enterprise requirement is proof that a signed report was not modified after approval.

Required model:

- Report lock state.
- Immutable audit events.
- Hash of the signed report payload or generated PDF.
- Signature metadata: signer, role, timestamp, certificate if applicable.
- Revision history.
- Clear distinction between visual signature images and cryptographic signatures.
- Exported report should include revision, lock state, and hash metadata when required.

Current state should be treated as a foundation, not a complete immutable records system.

### Document Lifecycle / מחזור חיים של מסמך

Technique Sheets and Inspection Reports should have an explicit lifecycle so users, auditors, and developers understand when a record is editable and when it becomes controlled.

לכרטיסי טכניקה ולדוחות בדיקה צריך להיות מחזור חיים ברור כדי שמשתמשים, מבקרים ומפתחים יבינו מתי רשומה ניתנת לעריכה ומתי היא הופכת למסמך מבוקר.

| State / מצב | Meaning / משמעות | Expected Controls / בקרות נדרשות |
| --- | --- | --- |
| Draft / טיוטה | Work in progress | Editable, autosave allowed, validation warnings visible |
| Review / בבדיקה | Ready for internal technical check | Changes tracked, reviewer identity recorded |
| Approved / מאושר | Accepted for use or issue | Approval metadata, revision, and signer captured |
| Locked / נעול | Controlled record | No silent edits; changes require new revision or controlled unlock |
| Revised / גרסה חדשה | Superseded by an updated record | Old revision preserved and linked to replacement |
| Exported / יוצא לקובץ | PDF/DOCX/CSI artifact created | Export timestamp, format, source record, and hash when required |

## 32. Standards Versioning

When a sheet is created using a specific standard revision, that revision must remain attached to the record even if the standard changes later.

Required data:

- Standard name.
- Revision.
- Effective date.
- Source file or rule package version.
- Rule snapshot used for autofill.
- Manual override audit.
- Review/approval owner.

This is critical for AMS/ASTM/customer procedure traceability.

### Calculation and Rule Governance / ניהול חישובים וכללים

Because the software includes domain calculations and standard-based recommendations, production use should define how calculation logic is reviewed, versioned, and approved.

מכיוון שהתוכנה כוללת חישובים מקצועיים והמלצות לפי תקנים, שימוש בפרודקשן צריך להגדיר איך לוגיקת החישוב נבדקת, מקבלת גרסה ומאושרת.

| Item / פריט | Required Control / בקרה נדרשת |
| --- | --- |
| Formula source / מקור נוסחה | Link each calculation to a standard, procedure, engineering note, or Level III decision |
| Versioning / ניהול גרסאות | Preserve the calculator or rule version used when a sheet is generated |
| Review owner / בעל אישור | Assign technical review to a qualified owner before customer release |
| Test fixtures / נתוני בדיקה | Keep golden examples for common materials, thicknesses, probes, gates, DAC/TCG, and acceptance classes |
| Manual override / שינוי ידני | Record who changed a recommended value, when, why, and from what original value |

## 33. Data Residency, ITAR, Export Control, and GDPR

For aerospace and international customers, data location and access are important.

Key questions:

- Which Supabase region hosts the data?
- Is customer data stored in the US, EU, or another region?
- Are part numbers, serial numbers, drawings, or inspection results controlled data?
- Can support personnel access customer data?
- Are logs and backups stored in the same region?
- Is there a DPA for EU customers?
- Are export, deletion, and retention workflows defined?
- Is ITAR/export-controlled data in scope or explicitly out of scope?

No ITAR or export-control claim should be made without legal and operational review.

## 34. Disaster Recovery and Backups

Production readiness requires a clear DR plan:

| Item | Requirement |
| --- | --- |
| RPO | Maximum acceptable data loss |
| RTO | Maximum acceptable recovery time |
| Backups | Automated, encrypted, and monitored |
| Restore tests | Scheduled and documented |
| Supabase deletion scenario | Runbook for project/database loss |
| Local desktop data | Export/backup path for offline users |
| Incident owner | Named role responsible for recovery |

For Electron/offline workflows, local export and backup behavior must be clear so a failed workstation does not cause data loss.

## 35. Telemetry and Crash Reports

In NDT/Aerospace environments, crash data may contain PII or sensitive customer information such as file paths, part numbers, serial numbers, or customer names.

Recommended policy:

- Opt-in telemetry or a full disable option.
- Send technical metadata only.
- Remove PII from log payloads.
- Do not send reports, images, or scan data without explicit permission.

## 36. License Expiry and Revocation

License behavior should be defined:

- Read-only mode when a license expires.
- Grace period.
- Revocation list or online validation when connected.
- Preserve access to existing data.
- Offline Electron policy.

## 37. Concurrent Editing

In a multi-user organization, last-write-wins behavior can create risk when two users edit the same sheet at the same time.

Recommended controls:

- Optimistic locking using version or `updatedAt`.
- Conflict detection.
- Soft lock during editing.
- Audit event for every change.
- Merge/revision workflow when required.

## 38. Instrument Integration

The system is not an acquisition system and does not replace instrument software such as OmniScan, Eddyfi, or Sonatest. Correct positioning:

- Planning.
- Setup generation.
- Documentation.
- Reporting.
- Export/import integration.

Integration with acquisition tools requires file formats, API/SDK access, sample data, and validation with the manufacturer or customer.

## 39. Customer-Supplied Standards

Aerospace customers often use internal standards such as BPS, ABP, or internal procedures. Supporting this requires:

- Organization-specific standards.
- Owner.
- Revision.
- Approval workflow.
- Access control.
- Rights/legal review.
- Traceability for every auto-fill based on a customer standard.

## 40. Units and Internationalization

In NDT/Aerospace, unit mistakes are a professional risk.

Required definitions:

- Metric/imperial.
- Rounding policy.
- Unit display in every field and export.
- Conversion validation.
- UI language roadmap.

## 41. Calibration Traceability

To support audit-ready calibration workflow, the system should connect equipment and calibration blocks to:

- Equipment serial number.
- Calibration block serial number.
- Certificate file.
- Certificate issue date.
- Expiration date.
- Calibration provider.
- ISO 17025 status if applicable.
- Calibration status at inspection time.

## 42. Image and Evidence Handling

If images, C-scan/A-scan captures, or indication photos are uploaded, the system should define:

- Allowed formats.
- Maximum size.
- Compression policy.
- Whether EXIF is stripped.
- Whether original quality is preserved.
- Storage location.
- Access permissions.
- Evidence linkage to report revision.

## 43. PLM, MES, and QMS Integration

Enterprise aerospace customers may require integration with:

- SAP.
- Teamcenter.
- Windchill.
- MES systems.
- QMS systems.
- Work order import.
- Result export.
- API-based status updates.

This is not required for a first product version, but the architecture should leave a clear integration boundary.

## 44. CSI / ScanMaster Robot Integration Overview

The existing product can become valuable as a planning and setup layer for ScanMaster CSI / Robot workflows. The goal is not to replace the machine controller, but to prepare validated setup data and import results back into reports.

Potential integration direction:

1. Create Technique Sheet in Scan Master.
2. Validate parameters, units, and machine constraints.
3. Export CSI/setup file or send data through an API.
4. Load the setup into ScanMaster control software.
5. Execute scan on the robot/machine.
6. Import results, images, C-scan/A-scan data, or pass/fail metadata.
7. Generate final inspection report with full traceability.

## 45. Existing CSI-Relevant Components

| Component | File / Area | Status |
| --- | --- | --- |
| CSI exporter | `src/utils/exporters/csiExporter.ts` | Initial XML skeleton for part, material, equipment, calibration, scan plan, OEM, validation, and kinematics. |
| Patch generation | Export utilities | Foundation for setup/export workflows. |
| DAC/TCG calculators | Domain utilities | Relevant to UT setup preparation. |
| OEM rules | Domain utilities | Useful for customer/machine-specific setup logic. |
| Validation logic | Domain utilities | Can be expanded into machine limits and safe ranges. |

## 46. MCIO Instrument Window Reference

The ScanMaster manual includes an MCI/O Instrument window that displays UT setup and acquisition parameters. The visible UI includes toolbar, status display, A-scan display, gain slider, timebase axis, status bar, and messages area.

![MCIO Instrument Window from ScanMaster manual](docs/assets/mcio-instrument-window-manual-page-15.png)

Boundary note: the manual page describes the MCI/O Instrument and UT display layer. ScanMaster should confirm whether the same software layer also controls robot/machine motion, or whether an additional CSI/PLC/motion controller layer exists.

## 47. System Boundary

Before integration planning, system boundaries must be mapped:

| System | Likely Responsibility |
| --- | --- |
| Scan Master software | Technique Sheet, reporting, calculations, setup preparation, traceability. |
| ScanMaster CSI/MCI/O | Machine or instrument setup, UT display, acquisition, scan execution. |
| Robot/motion controller | Axis movement, safety interlocks, limits, homing, motion profile. |
| PLC/safety layer | Emergency stop, interlocks, safety states. |
| Customer QMS/MES/PLM | Work orders, part records, quality records, approvals. |

## 48. Integration Levels

| Level | Description | Value | Risk |
| --- | --- | --- | --- |
| Level 0 | Manual copy of setup values | Low automation | Low |
| Level 1 | Export setup file from Scan Master | Faster setup, fewer manual mistakes | Medium |
| Level 2 | Import results back into Scan Master | Better reporting and traceability | Medium |
| Level 3 | API connection to CSI/MCI/O | Higher automation | High |
| Level 4 | Robot/motion control influence | Maximum automation | Very high, safety-critical |

The recommended first integration is Level 1: setup export and validation. Motion control should not be touched before safety boundaries and official APIs are confirmed.

## 49. Required Information About CSI / Setup File Format

| Information | Reason |
| --- | --- |
| File extension | `.csi`, `.xml`, `.prg`, `.stp`, binary, or other |
| Schema/spec | Field names, order, types, enums, required/optional |
| Empty template | Baseline for a valid exporter |
| Completed setup sample | Comparison against a real setup |
| Failed setup sample | Understanding validation and error behavior |
| Units | mm/inch, MHz, dB, US, %, rpm, mm/s |
| Encoding | UTF-8, ASCII, Windows-1252 |
| Decimal format | Dot/comma, precision, rounding |
| Allowed ranges | Gain, PRF, speed, gates, water path |
| Import validation | Success/warning/error reporting |

## 50. Required Information About Communication/API

| Area | Required Information |
| --- | --- |
| Connection method | Manual import, watch folder, TCP/IP, serial RS-232/485, OPC-UA, SDK/API |
| TCP/IP | IP, port, protocol, message framing, timeout, retry, ACK/NAK |
| Serial | COM port, baud rate, parity, stop bits, flow control |
| OPC-UA | Endpoint, node IDs, namespace, certificates, write permissions |
| API/SDK | Docs, sample code, supported language, version compatibility |
| Authentication | None, user/pass, API key, certificate, Windows domain |
| Error handling | Error codes, status endpoint, logs, recovery steps |
| Versioning | CSI versions supported and compatibility constraints |

## 51. Required Information About Robot, Machine, and Axes

| Area | Required Information |
| --- | --- |
| Machine model | Exact model and software version |
| Axes | X/Y/Z, rotation, immersion tank, bridge, manipulator |
| Limits | Travel range, speed, acceleration, soft limits |
| Coordinate system | Origin, units, direction, offsets |
| Scan path | Raster, line, spiral, custom path |
| Safety | Emergency stop, interlocks, protected zones |
| Tooling | Fixture, probe holder, wedge, water path, standoff |
| Calibration | Homing, reference points, block setup |
| Dry-run | Simulation mode without UT firing or motion risk |

## 52. Required Information About UT Acquisition

| Area | Required Information |
| --- | --- |
| Channels | Number of channels and channel mapping |
| Pulser | Voltage, pulse width, PRF |
| Receiver | Gain, filters, rectification |
| Gates | Start, width, threshold, logic |
| TCG/DAC | Format, points, curve interpolation |
| A-scan | Sampling, range, resolution |
| C-scan | Grid, pixel size, color map, export format |
| Data output | Raw, processed, image, CSV, binary |
| Result metadata | Pass/fail, indications, coordinates, amplitudes |

## 53. Operator Workflow

The existing CSI/MCI/O workflow must be mapped:

1. Open or create setup.
2. Configure channel setup and global setup.
3. Set timebase, zoom/trigger, pulser, gain, receiver, display, gates, TCG, files, global, and IO.
4. Configure machine/scan path if applicable.
5. Run calibration.
6. Run scan.
7. Review results.
8. Save/export data.
9. Generate final report.

Scan Master should fit into this workflow without forcing operators to bypass safety or established procedures.

## 54. Results Import

Useful import targets:

- Setup file actually used.
- Scan metadata.
- C-scan image.
- A-scan evidence.
- Indication list.
- Pass/fail result.
- Operator and timestamp.
- Machine ID.
- Calibration state.
- Error/warning logs.

Imported results should be linked to the report revision and audit trail.

## 55. Safety and Dry-Run

Robot or motion integration is safety-sensitive. Any integration beyond file export requires:

- Official API documentation.
- Machine vendor approval or customer acceptance.
- Dry-run mode.
- Limit validation.
- No movement command without operator confirmation.
- Emergency stop and safety interlock awareness.
- Logged setup transfer.
- Approval workflow before production use.

## 56. Pilot Acceptance Criteria

| Stage | Success Criteria |
| --- | --- |
| Sample import | ScanMaster-provided setup file can be parsed without errors. |
| Parameter match | Part, equipment, gates, gain, units, and scan settings match manual setup. |
| Export validation | Scan Master exports a file accepted by CSI/MCI/O. |
| Dry-run | Setup can be loaded without machine motion risk. |
| Operator review | Operator can verify all setup values before execution. |
| Report link | Used setup and result metadata are attached to the report. |
| Audit log | Export, import, approval, and execution metadata are logged. |

## 57. Business and Technical Value of Integration

| Value | Impact |
| --- | --- |
| Fewer manual setup mistakes | Reduces operator copy/paste and transcription errors. |
| Faster preparation | Technique Sheet becomes a setup source. |
| Traceability | Report can show exactly which setup was exported and used. |
| Standard enforcement | Rules and limits can be validated before machine use. |
| Reuse | Validated setups can be reused across similar parts. |
| Customer confidence | Stronger story for enterprise and aerospace buyers. |
| Future automation | Creates a path toward result import and deeper integration. |

## 58. Technical Requests to ScanMaster

Required information from ScanMaster before real integration:

1. Exact software names and versions for CSI/MCI/O/robot control.
2. Setup file examples: empty, valid completed, and invalid.
3. Schema/specification for setup import/export.
4. API or communication documentation.
5. Required fields and valid ranges.
6. Units and decimal rules.
7. Result export formats: C-scan, A-scan, indications, metadata.
8. Machine models and axis configurations.
9. Safety and dry-run workflow.
10. Error codes and logs.
11. Version compatibility policy.
12. Permission/authentication model.
13. Sample project that can be used for integration testing.
14. Contact person from their software/control team.

## 59. Strengths

| Strength | Explanation |
| --- | --- |
| Product depth | The software already covers many NDT documentation concepts. |
| Domain utilities | Standards, calculations, and report logic create real product value. |
| Desktop path | Electron supports customer environments where desktop use is required. |
| Export foundation | PDF/DOCX/drawing/export paths create a strong reporting base. |
| CSI foundation | Initial exporter and domain logic make future integration plausible. |
| Documentation | Production readiness and setup docs exist and can be expanded. |

## 60. Known Gaps

| Area | Gap |
| --- | --- |
| Auth | Development/mock paths must be removed from production. |
| License enforcement | Web standard locking is not fully enforced end-to-end. |
| Payments | Real Supabase/Stripe checkout must be aligned with Express mock paths. |
| Updates | Update server needs stronger admin auth, storage, and audit. |
| Electron | CSP, sandbox, local server, and signing need hardening. |
| Standards | Revision locking and rule snapshotting need completion. |
| Audit | Signed report immutability is not complete. |
| CI | E2E, security, and packaging checks should be automated. |
| CSI | Real integration requires ScanMaster technical documentation and samples. |

## 61. Recommended Closure Plan

| Priority | Action |
| --- | --- |
| P0 | Replace development/mock auth with production JWT middleware. |
| P0 | Clean and rotate secrets/download-gate access values. |
| P0 | Upgrade critical dependencies and run regression tests. |
| P0 | Enforce webhook signature verification. |
| P0 | Define report lock, hash, revision, and audit model. |
| P0 | Preserve standard revision and rule snapshot per sheet. |
| P1 | Harden Electron CSP, preload, IPC, local server, and installer signing. |
| P1 | Add E2E tests for critical workflows. |
| P1 | Define data residency, logging, privacy, and backup policies. |
| P1 | Collect CSI setup/API/machine data from ScanMaster. |
| P2 | Add dashboards, analytics, search, diff, and enterprise integrations. |

## 62. File Map for Follow-Up Questions

| Area | Files / Paths |
| --- | --- |
| Technologies | `package.json` |
| Main UI | `src/App.tsx`, `src/pages/Index.tsx` |
| Frontend auth | `src/hooks/useAuth.tsx` |
| Supabase client | `src/integrations/supabase` |
| Backend | `server/` |
| Electron | `electron/` |
| CSI export | `src/utils/exporters/csiExporter.ts` |
| Standards | `standards/` |
| CAD/drawings | CAD utilities and Python scripts |
| Download gate | `download-gate/drive-uploader` |
| Production readiness | `docs/PRODUCTION_READINESS_REPORT.md` |
| English Software Bible | `docs/SCAN_MASTER_SOFTWARE_BIBLE_EN.md` |

## 63. Official References

| Topic | Source |
| --- | --- |
| Nadcap accreditation and NDT | PRI Nadcap accreditation: `https://www.p-r-i.org/nadcap/accreditation?lang=en` |
| AS9100 | IAQG 9100 QMS requirements: `https://iaqg.org/standard/9100-qms-requirements-for-aviation-space-and-defense-organizations/` |
| NAS 410 | AIA NAS410 Revision 6 release note: `https://www.aia-aerospace.org/news/aia-and-accuris-release-nas410-revision-6-advancing-aerospace-safety-and-workforce-development/` |
| 21 CFR Part 11 | eCFR Part 11: `https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11` |
| Supabase regions | Supabase regions docs: `https://supabase.com/docs/guides/platform/regions` |
| Supabase backups/PITR | Supabase backups docs: `https://supabase.com/docs/guides/platform/backups` |

## 64. Document Status

| Field | Status |
| --- | --- |
| Document type | Technical and architectural software reference |
| Language | English, with bilingual English/Hebrew navigation and selected added notes |
| Includes MCI/O image | Yes, from `MCIO Instrument Manual GB50010130.pdf` |
| Includes download gate access code | No |
| Suitable for printing/sharing | Yes, if treated as a known-gaps and hardening reference |
