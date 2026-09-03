# ART Deferred Work and Desktop Readiness Guide

Applies to ART Version 1.5. This guide consolidates the deferred work recorded while implementing Epics 41 through 73. It distinguishes completed foundations from work that is still incomplete, explains why work was deferred, and gives the prerequisites and recommended actions needed to finish it.

## How To Use This Guide

A deferred item is not a failed implementation. In ART, work was deferred when completing it would require a real authenticated service, external provider account, production infrastructure, legal or licensing decisions, human accessibility testing, release ownership, or community participation that is not available in this source workspace.

Before closing a deferred item:

1. Confirm its prerequisites and dependencies below.
2. Define the data, authorization, privacy, accessibility, and failure behavior.
3. Implement through the existing framework named in the item rather than creating a parallel system.
4. Add focused automated verification and browser/desktop tests.
5. Perform the required manual, security, accessibility, provider, or release validation.
6. Update `HELP.md`, `USER-GUIDE.md`, `help.js`, and the relevant epic record.
7. Record evidence, known limitations, and the release decision.

## Epic Summary

| Epic | Name | Completed foundation | Deferred work category |
|---|---|---|---|
| 41 | Universal Search | Provider-based search, search history, saved searches, personal analytics | Permission-aware analytics, enterprise policy, certified SDK, cross-workspace authorization, AI search |
| 42 | Organization Metrics | Metrics registry, accessible dashboard, filters, views, exports, snapshots, caching | Authenticated authorization, richer scale, provider/server data, privacy-safe cross-organization analytics |
| 43 | Usability Reports | Usability report type, heuristics, table of contents, exports, metrics integration | Full manual accessibility and real-world acceptance testing |
| 44 | Shared Progress Logs | Local/file-based logs, tasks, comments, associations, accessible manager | Authenticated members, assignments, mentions, notifications, server synchronization |
| 45 | Authenticated Identity | Local identity, device identity, non-secret session boundary, provider API | Real authentication, passkeys, OAuth, MFA, recovery, cross-device identity |
| 46 | Tasks and To-Do | Local task manager, statuses, priorities, dates, completed view, dashboard widget | Authenticated assignment, shared lists, notifications, synchronized tasks, conflict-safe edits |
| 47 | Merge Conflicts | Provider-neutral three-way merge and accessible conflict dialog | Real file revisions, remote versions, automatic merge triggers, server conflict handling |
| 48 | Security and Enterprise Readiness | Security boundary, reporting guidance, release checklist | Hosted controls, encryption, rate limits, monitoring, formal compliance evidence |
| 49 | Authentication Services | Prerequisite identified by identity framework | Server authentication and account services |
| 50 | File Collaboration | Local/file collaboration foundations and resource organization | File watching, remote revisions, safe multi-user workflows, complete shared-resource semantics |
| 51 | Authorization and Organizations | Local membership roles and policy checks | Authoritative server enforcement, resource-level access, real multi-device membership |
| 52 | Storage Providers | Provider registry and local/network providers | Provider change detection, revision metadata, OAuth contract, common remote operations |
| 53 | Google Drive | GIS OAuth and Drive file open/save foundation | Real-account validation, folders, revisions, merge, rename/move/copy/delete, AT testing |
| 54 | OneDrive | MSAL/Graph App Folder foundation and open/save wiring | Real-account validation, revisions, merge, broader operations, AT testing |
| 55 | Dropbox | PKCE/App Folder foundation and open/save wiring | Real-account validation, revisions, merge, broader operations, token lifecycle, AT testing |
| 56 | Synchronization | Provider-neutral status and offline state model | Remote revision comparison, real sync, automatic merge, backup/copy workflows |
| 57 | External Integrations | Optional provider registry and local configuration | Live OAuth/API adapters, bidirectional work-item sync, mappings, rate limits |
| 58 | Desktop Application | Secure Electron shell, preload bridge, Windows packaging metadata | Runtime/build, signing, installers, updates, native parity, cross-platform testing |
| 59 | Privacy and Data Governance | Local inventory, export, reset, telemetry preference | Server retention/deletion, legal review, regional governance, real telemetry pipeline |
| 60 | Testing and Release Readiness | Verification bundle and browser smoke checks | Full browser/desktop/AT/provider/security/performance/release evidence |
| 61 | Advanced Collaboration | Local sessions, attribution, revisions, queues | WebSocket/server collaboration, file watchers, remote revisions, multi-user testing |
| 62 | Web/Desktop Parity | Native menus, command bridge, shared renderer | Packaged installer QA, native save, notifications, updates, platform parity testing |
| 63 | Advanced Integrations | Managed integration surface and sharing scopes | Live integrations, imports/updates, mappings, organization restrictions, testing |
| 64 | Organization Administration | Local administration, invitations, audit records, Settings UI | Authenticated administration, email, status/session control, retention, tamper-proof audit |
| 65 | Organization Analytics | Authorized report/task metrics, views, snapshots, exports, bounded cache | Server/hybrid metrics, shared views, privacy thresholds, scale testing, richer exports |
| 66 | Performance and Scalability | Bounded metrics LRU cache, invalidation, visible-widget boundary | Profiling, workers, virtualization, server/database optimization, load testing |
| 67 | Accessibility Hardening | Focus preservation, keyboard behavior, startup fix, accessible dialogs | Full AT, zoom, high-contrast, mobile, cross-platform, and comprehensive manual audit |
| 68 | Documentation and Onboarding | Help, User Guide, onboarding wizard, Settings guidance | Hosted docs, localization, videos, user studies, static help artifact maintenance |
| 69 | Community Beta and Feedback | Local categorized feedback and independent issue tracker | Hosted enrollment, external intake, triage operations, recruitment, community evidence |
| 70 | Production Release and Adoption | Release/readiness requirements documented | Production decision, deployment, installers, signing, website, launch, acceptance evidence |
| 71 | Continuous Improvement | Maintenance expectations and local verification practices | Ongoing operations, monitoring, dependency/security program, funding, succession |
| 72 | Governance and Stewardship | Contribution and governance requirements documented | Named maintainers, Code of Conduct operations, moderation, legal/funding structure |
| 73 | Internationalization | Unicode-safe existing data paths and architecture opportunities | Translation resources, language selection, RTL, locale support, multilingual testing |

## Detailed Deferred Work and Action Plans

### Epic 41 — Universal Search

**Done:** Deterministic provider-based search, search history, saved searches, provider health, and personal aggregate analytics exist.

**Still deferred:** Permission-aware analytics and aggregation thresholds; organization/workspace search administration; a certified versioned provider SDK; cross-workspace resource authorization and index isolation; AI/semantic search with redaction and prompt-injection controls.

**Why:** Search must not invent authorization. AI must not become a requirement for core search. Real permission filtering requires authenticated principals, organization membership, resource permissions, server enforcement, and a security review.

**Action steps:**

1. Complete Epics 49 and 51 server identity/authorization prerequisites.
2. Define organization, workspace, report, and resource authorization predicates and revalidate access at activation time.
3. Partition or filter indexes before aggregation and invalidate caches on permission changes.
4. Define privacy minimum-group thresholds and anonymous aggregation rules.
5. Version and document `registerUniversalSearchProvider`; add lifecycle, compatibility, rate, limit, and secret-handling contracts.
6. Only then evaluate optional AI search with redaction, no-training/data-retention rules, prompt-injection handling, provider consent, and a deterministic fallback.
7. Test restricted counts, saved searches, activation, analytics, and exports with Viewer/Contributor/Admin scenarios.

### Epic 42 — Organization Metrics

**Done:** Metrics registry, availability-aware values, organization grouping, filters, accessible tabs/tables, saved views, JSON/CSV export, snapshots, trends, and cache invalidation exist. Epic 65 added authorized task metrics and bounded caching.

**Still deferred:** Authenticated server/hybrid aggregation, organization-wide policy, shared views, minimum group-size privacy controls, provider folder discovery, background calculation, richer exports, and large-scale acceptance.

**Why:** Current calculation is local-first and can only see local/authorized inputs. Server data, privacy thresholds, and hybrid deduplication need authoritative resource identity and deployment infrastructure.

**Action steps:**

1. Complete authenticated identity and authorization, including resource/project scope.
2. Define a canonical report/task/resource identity and source provenance to prevent hybrid double-counting.
3. Add provider discovery and revision metadata contracts for shared folders.
4. Add server aggregation endpoints with organization isolation, pagination, authorization, and rate limits.
5. Add privacy thresholds and aggregate-only views for sensitive assignee metrics.
6. Move expensive calculations to indexed/background workers only after profiling representative datasets.
7. Add export formats only after permission filtering and output accessibility are verified.
8. Run multi-organization, permission-change, stale-data, conflict, and large-data tests.

### Epics 43–44 — Reports and Shared Progress Logs

**Done:** Usability Reports and local/file-based Shared Progress Logs are integrated with existing report, task, export, and accessibility workflows.

**Still deferred:** Real collaborator identities, member directories, assignment/reassignment, authenticated mentions, notifications, server synchronization, and conflict-safe shared edits.

**Why:** Display names or email strings are not authorization identities. Safe shared behavior requires Epics 49–51 and real file/provider revision data.

**Action steps:**

1. Establish authenticated user IDs and member-directory APIs.
2. Embed only non-secret stable identity metadata in shared resources.
3. Apply Authorization Policy Service decisions to report, log, task, comment, and mention actions.
4. Add provider revision/base/local/remote contracts and route conflicts through the existing merge framework.
5. Add notification consent, delivery failure handling, and privacy controls.
6. Test two users, two devices, offline edits, concurrent changes, mentions, and denied actions.

### Epics 45, 49, 50, and 51 — Identity, Authentication, File Collaboration, Authorization

**Done:** Local profile/device identity, non-secret session metadata, local organization memberships, role permissions, resource organization, and client-side policy seams exist.

**Still deferred:** Real sign-in, WebAuthn/passkeys, OAuth/OIDC callbacks, MFA, account recovery, server sessions, cross-device linking, cryptographic device keys, authoritative authorization, organization isolation, file watching, remote revision ancestry, and complete shared-resource enforcement.

**Why:** These require a secure HTTPS server, challenge/token/session infrastructure, database, key management, rate limiting, audit logging, tenant isolation, and operational security. Client-side checks are not enforcement.

**Action steps:**

1. Design the threat model, identity lifecycle, session expiry/revocation, recovery, MFA, and account deletion behavior.
2. Deploy HTTPS authentication/relying-party services with secure credential/token storage and rate limits.
3. Define organization/member/resource tables and least-privilege policy evaluation.
4. Add server-side authorization on every read/write/export/synchronization path.
5. Add file revision IDs, modified times, ETags/change tokens, watchers where supported, and safe atomic writes.
6. Connect cross-device identity and device revocation without using local display names as identity.
7. Add authenticated invitations, roles, mentions, notifications, and organization isolation tests.
8. Perform penetration, abuse, recovery, concurrency, and data-loss testing before production claims.

### Epics 52–57 — Storage and External Providers

**Done:** Provider-neutral registry, Google Drive, OneDrive, Dropbox client foundations, least-privilege scopes, opt-in visibility, local project open/save wiring, and optional integration configuration exist.

**Still deferred:** Real account testing, provider setup, folder selection, revision/change detection, merge integration, rename/move/copy/delete, Save As, token refresh/revocation, live Jira/GitHub/Azure/Google Workspace APIs, field mappings, bidirectional synchronization, rate limits, and external deletion handling.

**Why:** Provider credentials, redirect origins, tenant/project setup, external API behavior, network failures, and account consent cannot be safely simulated as production evidence in this workspace.

**Action steps:**

1. Provision each provider application externally with exact redirect origins and least-privilege scopes.
2. Store only public client configuration locally; keep tokens session-scoped and never commit secrets.
3. Implement common list/read/create/update/revision/error contracts.
4. Add explicit folder selection only within granted provider scope.
5. Add remote revision comparison before overwrites; preserve local work on conflicts.
6. Route compatible changes and conflicts through `mergeConflictFramework.js`.
7. Implement provider-specific retry, timeout, rate-limit, expiry, revocation, and partial-failure behavior.
8. Add live test accounts, sanitized fixtures, provider policy review, and AT/manual testing.

### Epics 56, 61, and 62 — Synchronization, Collaboration, Desktop Parity

**Done:** Local synchronization status, offline markers, collaboration queues/revisions, secure Electron shell, native command routing, and `.art` file association opening exist.

**Still deferred:** Real remote synchronization, WebSocket/presence, file watchers, automatic merge invocation, atomic save/recovery across providers, native save IPC, notifications, installer QA, signing, updates, macOS/Linux packaging, and full web/desktop parity.

**Why:** No deployed collaboration service, provider revision callbacks, Electron runtime/toolchain, signed build pipeline, or cross-platform test environments are available.

**Action steps:**

1. Install and pin Node.js/npm on a build machine; run the desktop build steps below.
2. Add provider revision contracts and test remote-change/merge/recovery behavior.
3. Add native save/write IPC only with strict path validation, confirmation, and atomic temp-file replacement.
4. Add authenticated collaboration transport, presence, authorization, reconnection, and conflict events.
5. Build, sign, install, update, uninstall, rollback, and crash-test Windows packages.
6. Build and test macOS/Linux targets if supported; otherwise document supported platforms.
7. Test native menus, file associations, screen readers, notifications, window state, and feature parity.

### Epics 48 and 59 — Security, Privacy, Governance of Data

**Done:** Security boundary, vulnerability guidance, local privacy inventory, credential-free export, explicit local reset, and telemetry preference exist.

**Still deferred:** Hosted encryption/TLS operations, server authorization, retention/deletion, legal/privacy review, data-processing agreements, regional rules, telemetry pipeline, backup/restore operations, monitoring, incident response, and compliance evidence.

**Why:** These are deployment, legal, and operational controls. Source documentation cannot establish certification or prove a hosted service's behavior.

**Action steps:**

1. Produce data-flow and threat-model documentation for every server/provider path.
2. Obtain legal/privacy review for jurisdictions and processing agreements.
3. Implement server retention, deletion, export, encryption, key rotation, audit, backup, restore, and incident controls.
4. Add dependency/secret/security scanning, penetration testing, and abuse monitoring.
5. Keep telemetry disabled by default, minimize events, document retention, and provide deletion controls.
6. Collect evidence for release and enterprise reviews without claiming certifications not obtained.

### Epics 60, 66, and 67 — Testing, Performance, Accessibility

**Done:** Static verification, browser smoke coverage, startup watchdog, bounded metrics cache, Dashboard/Tasks focus preservation, native semantics, live regions, and documentation exist.

**Still deferred:** Full browser matrix, automated axe/Lighthouse/WAVE scans, large-data profiling, load/concurrency/endurance testing, Electron runtime tests, full WCAG audit, JAWS/NVDA/Narrator/VoiceOver/TalkBack/ChromeVox/braille/magnification/switch/voice-control testing, and real user acceptance.

**Why:** These require target platforms, representative datasets, assistive technology, human testers, and release evidence unavailable from source inspection alone.

**Action steps:**

1. Define supported browser/OS/desktop/AT matrix and measurable performance budgets.
2. Build sanitized large datasets covering reports, findings, tasks, logs, metrics, history, and collaboration.
3. Profile startup, render, search, import/export, metrics, memory, CPU, and synchronization before optimizing further.
4. Run keyboard/focus/zoom/high-contrast/reduced-motion and screen-reader audits.
5. Add regression tests for every discovered defect, including the focus regressions fixed in Epic 67.
6. Repeat tests on web and packaged desktop builds and retain evidence per release.

### Epics 64–65 — Administration and Analytics

**Done:** Local organization administration, member/invitation records, audit records, permission-filtered metrics, task metrics, saved views, snapshots, exports, and data-quality reporting exist.

**Still deferred:** Email invitations, account creation, member disabling, session/device revocation, ownership transfer/recovery, custom roles, organization integration policy, retention enforcement, tamper-proof audit retention, server analytics, shared views, privacy thresholds, and scale testing.

**Action steps:**

1. Connect administration to authenticated server membership and authoritative policy checks.
2. Add invitation acceptance, account lifecycle, revocation, ownership transfer, and recovery workflows.
3. Add custom permission policy only after threat modeling and least-privilege review.
4. Store protected audit logs server-side with retention and integrity controls.
5. Apply organization policy to storage, integrations, metrics, exports, and data retention.
6. Test Owner/Admin/Contributor/Viewer changes immediately across all reads, writes, caches, exports, and snapshots.

### Epics 68–69 — Documentation, Beta, and Feedback

**Done:** In-app Help, User Guide, onboarding wizard, categorized local feedback, separate issue tracker, status/notes persistence, newest-first ordering, and export file workflow exist.

**Still deferred:** Hosted documentation, translation, videos, enrollment/recruitment, external feedback transport, server triage, issue conversion, roadmap analytics, community user studies, and beta evidence from diverse participants.

**Action steps:**

1. Establish documentation ownership and link/version checking.
2. Add an authenticated/shared import workflow for `art-feedback-issues.json` if multi-device distribution is required.
3. Define triage severity, response times, security/privacy routing, and release-blocker rules.
4. Recruit diverse accessibility and assistive-technology participants ethically and voluntarily.
5. Collect only necessary beta information and publish accessible known issues/release notes.
6. Convert validated issues into development records while preserving reporter privacy.

### Epics 70–72 — Release, Maintenance, Governance

**Done:** Release requirements, maintenance expectations, contributor pathways, and governance requirements are documented.

**Still deferred:** Production readiness decision, official website/downloads, signed installers, update service, support operation, recurring maintenance, monitoring, funding, named maintainers, Code of Conduct enforcement, moderation, succession, legal/IP/foundation decisions, and community advisory structures.

**Action steps:**

1. Name accountable release, security, accessibility, documentation, integration, and community owners.
2. Complete the desktop readiness runbook below and retain signed artifact evidence.
3. Run the Epic 69 beta exit review and classify release blockers.
4. Perform formal production web/desktop/security/privacy/accessibility/performance/reliability reviews.
5. Publish supported versions, known issues, download instructions, security contact, accessibility statement, privacy policy, contribution guide, and release notes.
6. Establish maintenance cadence, incident response, dependency updates, backups, monitoring, and emergency release procedures.
7. Publish governance, Code of Conduct, issue templates, review requirements, least-privilege access, succession, and funding policies.
8. Make and record the production/adoption decision; do not equate passing repository checks with production readiness.

### Epic 73 — Internationalization and Global Accessibility

**Done:** Existing data paths use JavaScript/JSON/HTML text handling capable of carrying Unicode. A local locale catalog, persisted language/region preference, browser-language fallback, Intl date/number formatting helpers, document language/direction metadata, and accessible Settings selector are implemented in the local foundation.

**Still deferred:** Reviewed translation resources/keys, localized Help/reports/standards, full RTL/bidi layout, pluralization, font review, translation licensing/review, Unicode security testing, multilingual AT testing, regional privacy, and international test matrices. The current selector exposes planned locales but the interface remains reviewed English.

**Action steps:**

1. Inventory user-visible strings and create stable translation keys with English fallback.
2. Extend the implemented persisted locale selector and document support levels as reviewed translations are added.
3. Centralize locale-aware date/time/number/sort formatting while keeping IDs language-independent.
4. Extend the implemented document `lang`/direction handling with RTL layout tests and font fallback.
5. Obtain permission and human review for translated standards/accessibility terminology.
6. Add pseudo-localization, Unicode security, pluralization, and text-expansion tests.
7. Test localized web/desktop reports, exports, search, collaboration, focus, live regions, and AT workflows.

## Desktop Application: Full Readiness, Build, Download, and Installation

### Current State

The desktop foundation is in `desktop/main.cjs`, `desktop/preload.cjs`, and `package.json`.

Implemented:

- Electron `BrowserWindow` loads the shared `index.html` renderer.
- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Narrow preload bridge for opening `.art` files and native command delivery.
- Single-instance behavior, window-state persistence, external-link restrictions, and Windows `.art` association metadata.
- Windows NSIS packaging metadata with Start Menu/Desktop shortcuts and selectable installation directory.

Not yet proven in this workspace:

- Node/npm/Electron installation and runtime launch.
- Installer build and installation/uninstallation.
- Code signing, publication, updates, rollback, crash recovery, native notifications, native save IPC, macOS/Linux packaging, and full desktop accessibility/performance testing.

### Build Prerequisites

Use a Windows build machine with:

- Windows 10 or newer supported by the selected Electron version.
- Node.js LTS, which provides npm. Verify with `node --version` and `npm --version`.
- Git, if obtaining source by clone.
- Sufficient disk space for npm cache, Electron binaries, and the generated installer.
- A clean checkout of the ART repository.
- Signing certificate and secure signing credentials only if publishing a trusted production installer.

Do not commit OAuth secrets, signing certificates, private keys, access tokens, or refresh tokens.

### Build From the Repository

From the repository root:

```powershell
node --version
npm --version
npm install
npm run desktop:start
```

`npm run desktop:start` launches the unpackaged Electron application. In development, the current shell opens DevTools because `main.cjs` treats the app as development mode. Confirm:

- ART starts without renderer or preload errors.
- Welcome, Dashboard, Builder, Editor, Viewer, Settings, Help, Tasks, and dialogs open.
- Native File, View, and Help menu commands route to the shared renderer.
- Opening a `.art` file uses the existing validation/import pipeline.
- Window size persists after restart.
- External links are handled by the intended restricted path.
- No credentials or tokens appear in local files, logs, or project exports.

Stop the development app using its normal window close action. Do not use the development process as a production distribution.

### Build the Windows Installer

From the same clean repository root:

```powershell
npm run desktop:dist
```

The configured electron-builder target is Windows NSIS. The expected artifact name is:

```text
ART-Setup-1.5.0.exe
```

The generated installer is normally placed in the project `dist` directory. Confirm the actual path and hash after the build:

```powershell
Get-ChildItem .\dist
Get-FileHash .\dist\ART-Setup-1.5.0.exe -Algorithm SHA256
```

The installer metadata requests:

- Product name: ART.
- Start Menu shortcut: ART.
- Desktop shortcut: ART.
- User-selectable installation directory.
- `.art` file association.
- Application ID: `org.art.accessibility-reporting-tool`.

### Installer QA Checklist

Before publishing an installer:

1. Install on a clean Windows test account or virtual machine.
2. Confirm the installer identifies ART Version 1.5 accurately.
3. Confirm installation directory selection works.
4. Confirm Start Menu and Desktop shortcuts launch ART.
5. Double-click a `.art` file and confirm ART opens it through validation/import.
6. Test opening a malformed `.art` file and confirm it is rejected safely.
7. Confirm uninstall removes the application without deleting user-created project files.
8. Confirm user data/window state behavior is understood and documented.
9. Test upgrade over the prior supported version and rollback/recovery procedure.
10. Test offline launch and local report/task workflows.
11. Test native menu keyboard access, focus behavior, dialogs, Help, Settings tabs, and screen-reader output.
12. Test high contrast, zoom, reduced motion, magnification, and keyboard-only workflows.
13. Check CPU, memory, startup time, crash behavior, and long-running sessions.
14. Verify no secrets, debug endpoints, development tools, or unintended files are packaged.
15. Sign the installer if publishing outside a controlled internal environment.
16. Record artifact hash, build environment, version, test results, known issues, and approval.

### Code Signing and Publication

A production-quality Windows download requires more than `npm run desktop:dist`:

1. Obtain an organization-appropriate Windows code-signing certificate.
2. Store signing credentials in a protected build environment, never in the repository.
3. Configure electron-builder signing through the approved secure environment.
4. Sign and verify the installer and packaged executable.
5. Publish SHA-256 hashes and accessible release notes.
6. Host the installer on the official ART website or approved distribution service.
7. Provide a stable HTTPS download link and an archive of prior supported releases.
8. Define update metadata, update verification, rollback, and incident procedures.
9. Test the download, signature, install, update, and uninstall flow from a clean machine.

The current repository does not provide an official hosted download URL or automatic update service. Until one exists, users must obtain source from the repository and build locally, or receive an installer from an approved project maintainer through a trusted channel. Do not describe an unsigned local build as the official production installer.

### How Users Can Obtain ART Today

**Web/local use:**

1. Open the repository's `index.html` in a supported browser, or use an approved hosted ART web deployment when one exists.
2. Fundamental local report workflows do not require an account or server.
3. Protect browser storage and export backups because local browser storage is not encrypted enterprise storage by default.

**Desktop/source build:**

1. Obtain the repository from its approved source-control location using Git clone or the repository's source archive download.
2. Install Node.js LTS.
3. Open PowerShell in the repository root.
4. Run `npm install`.
5. Run `npm run desktop:start` for a local unpackaged desktop build, or `npm run desktop:dist` to produce the Windows NSIS installer.
6. Install the generated `dist\ART-Setup-1.5.0.exe` only after reviewing its build/test provenance.

**Official production download:**

This is deferred until Epic 70 provides an official website, HTTPS hosting, signed installer, release notes, hashes, and update/support process. The repository itself is currently the source location, not a completed public installer distribution channel.

## Feedback Tracker and Repository Updates

The feedback tracker uses `art-feedback-issues.json`. When that file is present in the workspace, the coding agent can read and directly update issue status, notes, timestamps, and ordering, then validate, commit, and push it when explicitly instructed. Browser-local feedback must first be exported with **Export Feedback Issues File** and placed in the repository because browser security prevents silent writes into an arbitrary repository folder.

## Completion Rule

This guide is complete as documentation, not as proof that every deferred item is finished. Each epic becomes complete only after its prerequisites, implementation, manual evidence, security/privacy review, accessibility review, documentation, and release approval are recorded.
