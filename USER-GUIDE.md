# ART User Guide: Plugins and Packages

## Feedback Issue Tracker
Choose **Help > Open Feedback Issues** to review feedback submissions as separate issues. Each issue displays its **Created** date and **Last updated** date, and issues are ordered with the most recently updated first. The tracker is independent from Tasks and To-Do.

Owners and invited Admins can change an issue's Status and add Notes, then select **Save Issue Update**. Updates save automatically and persist locally until changed again. Select **Export Feedback Issues File**, place the downloaded `art-feedback-issues.json` in the repository's agreed tracker location, review it, and use the normal `git add`, `git commit`, and `git push` process. A browser cannot silently write into a repository folder, and an authenticated shared import workflow remains future work.

## Application Settings Tabs
Application Settings uses an accessible tab list. Frequently used Account and Identity, Visual Accessibility, Security and Privacy, Workspace View, Storage Providers, Organization, Collaboration, and Search tabs appear first. Integration, standards, privacy, analytics, administration, diagnostics, and About tabs follow. Use Arrow Right/Down and Arrow Left/Up to move between tabs, Home and End for the first and last tab, and Enter or Space to activate a tab. ART remembers the active Settings tab locally, and section-opening commands activate the correct tab before focusing the requested section.

## Community Beta Feedback and Issues
Choose **Help > Share Community Feedback** to record categorized accessibility, usability, bug, feature, performance, documentation, or security and privacy feedback. Each submission becomes its own issue in **Help > Open Feedback Issues**. The tracker resembles Tasks and To-Do but uses a completely separate record system.

Issues are displayed with the most recently updated first. Authorized Owners, invited Contributors, and community testers can update the Status and add Notes. Changes save automatically and persist locally until changed again. Select **Export Feedback Issues File** to create `art-feedback-issues.json`; the browser requires you to choose or move that file into the repository or a shared folder. Do not place credentials or private report content in feedback, and report undisclosed security vulnerabilities through [SECURITY.md](SECURITY.md).

## Overview
ART Version 1.5 includes a Plugin Framework that supports extensibility without changing core ART workflows.

## Plugin Installation
1. Open Application Settings.
2. Expand Administrator Tools.
3. Open Plugin & Package Manager.
4. Select Install Plugin... and choose a plugin manifest JSON file.
5. Review install/update confirmation details (identifier, version, dependencies, permissions).
6. Confirm to install or update the plugin.

If the selected plugin identifier already exists, ART updates the existing plugin manifest.

## Plugin Lifecycle Controls
- Enable or disable plugins from the Installed Plugins list.
- Uninstall external plugins from the same list.
- Use Validate Extensions to run plugin/package validation checks.
- Use Refresh Extension Registry to refresh plugin/package snapshots.

Dependency protections:
- ART blocks enable when required dependencies are missing, disabled, or below required version.
- ART blocks disable/uninstall when enabled dependent plugins still require that plugin.

## Framework Configuration
- Use Export Framework Config to download plugin framework plugin/package configuration.
- Use Import Framework Config to restore configuration from a JSON export.

## Package Registration
Packages are registered automatically after existing workflows complete.

Examples:

- Accessibility standards imported through Settings
- Templates imported through Dashboard or Settings
- Integration metadata managed through Integrations
- Keyboard profile metadata from Shortcut Manager
- Saved search metadata from Universal Search

## Validation and Troubleshooting
Use Validate Extensions to run metadata and compatibility checks.

If validation fails:

- confirm plugin identifier uniqueness
- confirm Supported ART Version compatibility
- confirm required metadata fields
- resolve duplicate command or provider identifiers
- resolve plugin dependency and dependency-version issues

## Accessibility Notes

### Keyboard Focus
When a checkbox, dropdown, button, or other control changes data, ART keeps keyboard focus on that control while the surrounding view refreshes. If a completed task leaves the active list, focus moves to the next available task control or the task-management action. Focus is moved to a heading or dialog control only when the workflow explicitly opens or navigates to that destination.

## Getting Started
On the Welcome screen, choose **Start a New Report**, **Open an Existing Project**, **Explore Report Builder**, or **Open Help Documentation**. This first-run path is optional, and local report work does not require an account. After choosing a path, use the Dashboard and panel tabs to continue working.

Select **Open Optional ART Setup Wizard** on the Welcome screen, or choose the same command from the **Help** menu, for guided first-time setup. Each step opens the existing Settings section for Account and Identity, Storage Providers, External Integrations, Accessibility and Appearance, Organization and Metrics, or Collaboration. The wizard is optional, keyboard accessible, and can be closed without changing settings.

## Community Beta Feedback
Choose **Help > Share Community Feedback** to record accessibility, usability, bug, feature, performance, documentation, or security and privacy feedback. Feedback is categorized and stored locally on this device; it is not sent automatically and does not require an account. Include steps to reproduce when reporting a problem, and remove private report content, credentials, and unnecessary personal information. Report undisclosed security vulnerabilities through [SECURITY.md](SECURITY.md) instead of the general feedback form.
Plugin and package administration in ART is keyboard-accessible and announced through status regions.

## Collaboration Setup and Usage
ART collaboration supports both real-time sessions and asynchronous shared-folder synchronization.

### What You Need

- ART with Collaboration enabled in Settings.
- A running collaboration coordination server.
- For asynchronous shared-folder workflows: a shared folder configured on the server.

### Start the Collaboration Server (Windows)

Recommended one-command startup:

1. Open PowerShell in the ART repository root.
2. Run [start-collaboration-server.ps1](start-collaboration-server.ps1).
3. Optional fast health check: run [start-collaboration-server-and-open-health.ps1](start-collaboration-server-and-open-health.ps1) instead to auto-open `/health` after startup.
4. When finished, stop the local server with [stop-collaboration-server.ps1](stop-collaboration-server.ps1).

Optional shared-folder mode:

1. Run [start-collaboration-server.ps1](start-collaboration-server.ps1) with `-SharedFolder "\\server\share\art-collab"`.
2. If your environment needs access control, also provide `-Token "your-token"`.

### Configure Collaboration in ART

1. Open Application Settings.
2. Open Collaboration.
3. Turn on Enable Collaboration.
4. Set Live collaboration server URL (default: ws://localhost:8787/art-live).
5. Optional: set Live session name and auto-connect preference.

### Fastest Live Workflow (One Click)

1. In Collaboration settings, choose Quick Start Live Collaboration.
2. ART applies live defaults, connects to server, and starts a live session.
3. Verify status in Live summary and Collaboration session summary.

### Manual Live Workflow

1. Select Connect Server.
2. Select Start Live Session.
3. Continue work with collaboration enabled.
4. Select Disconnect Server when done.

### Asynchronous Shared-Folder Workflow

Use this when users collaborate at different times:

1. Ensure the collaboration server is configured with shared-folder persistence.
2. User A connects and chooses Publish Async Snapshot.
3. User B connects and chooses Pull Async Snapshot.
4. ART applies pulled collaboration metadata and records sync timing.

### Collaboration Disconnect and Cleanup

When ending collaboration:

1. Select Disconnect Server.
2. Optionally clear temporary sessions using Clear Collaboration Sessions.
3. Optionally use Reset to Baseline to return to a standard Solo/Team setup.

### Collaboration Troubleshooting

- If connect fails:
	- Verify server is running.
	- Confirm URL and WebSocket path match server configuration.
	- Confirm token matches server token when required.
- If pull fails:
	- Ensure another user published a snapshot first.
	- Confirm shared-folder mode is enabled on server when using asynchronous workflows.
- If status remains offline:
	- Check the Live summary and settings status message for error details.

## Publishing Presentation
ART now includes reusable visual presentation resources for publishing output.

Presentation resources include:

- Report Layouts
- Report Themes
- Report Branding
- Publishing Profiles

Use Report Builder -> Publishing Presentation to:

1. Choose a reusable Layout, Theme, and Branding resource.
2. Adjust section order and visibility.
3. Configure cover page, table of contents, and page numbering behavior.
4. Review accessibility validation for contrast, links, and required alternative text.
5. Preview the current report in screen, print, PDF, Word, or HTML contexts.

Key behaviors:

- Layouts control published section structure only. They do not replace Report Templates.
- Themes control styling only. They do not change report semantics.
- Branding controls organization identity, header/footer content, images, links, and required alternative text.
- Hiding a published section does not delete underlying report data.
- Reports can keep report-level overrides while still reusing shared presentation resources.

Reusable resource management:

1. Open a Layout, Theme, or Branding panel.
2. Choose an existing reusable resource or edit the current report override.
3. Save to a personal, workspace, or shared scope when you want reuse.
4. Duplicate built-in resources before renaming or deleting them.

Branding accessibility requirements:

- Every non-decorative header/footer image requires alternative text.
- Decorative images must be marked explicitly.
- Alternative text is preserved in preview and supported export formats.
- Link styling remains visually distinct and is not color-only.

Workspace default branding:

- Authorized users can enable: `Make this the default branding for new reports in this Project Workspace.`
- This affects only new reports created in that Project Workspace.
- Existing reports keep their current Branding selection unless you change them manually.

## Resource Relationships
ART Version 1.5 includes a Resource Relationship Framework that keeps track of how workspace resources relate to one another.

Examples:

- a workspace contains reports, templates, assets, and attachments
- a report uses a template
- a report uses an accessibility standard
- a report references a project asset or attachment

## Browsing Relationships in Explorer
1. Open the Explorer workspace view.
2. Expand a resource in Resource Navigator.
3. Review the relationship categories shown under that resource.
4. Activate a related resource to move focus directly to it in Explorer.

Relationship entries are virtual navigation nodes. They do not duplicate the underlying resource.

## Resource Properties
Use Show Properties on a resource in Explorer to inspect:

- resource overview
- relationship categories and counts
- related resources
- impact analysis

The Relationships tab includes a search box that filters only the currently displayed relationship information.

Press Escape in that search box to clear the search when text is present.

## Deletion Analysis
Removing a project asset now opens a Deletion Analysis dialog.

Use this dialog to review:

- which resources are affected
- whether incoming references exist
- what relationship information will be removed

If no relationship impact is detected, ART still shows the analysis before deletion so the workflow remains predictable.

If ART detects broken relationship entries during deletion analysis, use Repair Relationships to remove invalid relationship records before continuing.

## Relationship-Aware Search
Universal Search now returns both direct matches and relationship matches.

Relationship matches help answer questions such as:

- which reports use this template
- which reports reference this asset
- which resources are related to this accessibility standard

Activating a relationship match reveals the owning resource in Explorer.

## Relationship Working Views
Working View includes relationship-based presets for temporary report analysis.

To use them:

1. Open a report.
2. Open Working View.
3. Choose a built-in preset such as Grouped by Attachment or Shared Evidence Review.
4. Apply the preset to inspect grouped findings without modifying report data.

Relationship Working Views can group and sort by:

- accessibility standard
- template
- attachment evidence
- combined relationship summary

Table mode also exposes relationship-derived columns so the same temporary analysis can be reviewed in a tabular layout.

## Automatic Relationship Updates
ART now refreshes workspace relationship integrity automatically when reports, templates, and accessibility standards change.

In practice this means imported, deleted, restored, and updated resources are less likely to leave stale relationship records behind in Project Workspaces.

## Rename and Replace Workflows
Dashboard now includes explicit actions for:

- Rename Report
- Replace Report
- Rename Template
- Replace Template

Use replace when you want ART to move workspace and report references to a different resource before removing the original one.

Template replacement updates report template references and workspace template relationships. Report replacement updates workspace report relationships and linked resource references.

## Resource Organization
ART Version 1.5 includes Resource Organization features for workspace resources:

- Tags
- Collections
- Saved Views

These features add organization metadata without changing underlying report, template, standard, or asset content.

## Tag Workflows
Use Tag Manager to review usage and perform common actions:

- view usage
- rename tags
- merge tags
- delete tags
- toggle favorites

Use Create Tag to add new tags, then assign or remove tags from selected resources.

## Collection Workflows
Use Collection Manager to:

- review collection contents
- rename collections
- duplicate collections
- delete collections
- toggle favorites

Use Create Collection to define a new grouping, then add/remove selected resources.

## Saved View Workflows
Saved Views persist Working View configurations so they can be reopened later.

Use Saved View Manager to:

- view saved configuration summaries
- open a saved view
- rename saved views
- duplicate saved views
- delete saved views
- toggle favorites

Use Create Saved View from Active Working View to capture the current temporary Working View configuration.

## Explorer Integration
When a Project Workspace is active, Explorer includes organization sections:

- Collections
- Tags
- Saved Views

You can browse these sections and activate organization actions directly from Explorer.

## Structured Search Queries
Universal Search supports organization filters:

- tag:critical
- collection:"Client Deliverables"
- view:"Executive Summary"

These filters help target organization metadata quickly from Search Everywhere.

## Organization Metadata Portability
Use Export Resource Organization Metadata and Import Resource Organization Metadata to migrate organization configuration.

Organization metadata is also included in workspace import/export payloads where applicable.

## History and Activity
Use History to review recent ART changes.

Access methods:

- Edit > History
- Command Palette
- Menu Bar Command Search

Use History to:

- review recent actions
- search recorded entries
- clear retained history when needed

## Undo and Redo
Undo and Redo are transaction-based.

- Undo shortcut: Ctrl+Z
- Redo shortcut: Ctrl+Y
- Alternate redo shortcut support may be available with Ctrl+Shift+Z

Undo and Redo commands are configurable in Keyboard Shortcut Manager.

If no action is available, commands remain visible but are unavailable.

## Version History
Versionable resources can expose Version History from context or command workflows.

Version History provides:

- ordered version list
- timestamps and descriptions
- restore actions
- compare entry points

Restoring creates a new current version and preserves prior versions.

## Compare Versions
Use Compare Versions to review differences between two versions.

Comparison includes:

- summary counts (added, removed, modified)
- detailed differences
- previous/next navigation
- filter by difference type
- export comparison report

Comparison is read-only.

## Properties History Sections
Project Properties and Resource Properties include History tabs with:

- history entry count
- version count
- latest recorded activity
- version actions

Use these tabs for quick history access without leaving existing workflows.

## Usability Reports
ART includes **Usability Reports** as a dedicated Report Type in Report Builder. Usability Reports provide a flexible format for documenting user experience and usability issues that affect users even when they fall outside WCAG Success Criteria or formal accessibility compliance standards.

### How Usability Reports Differ from Audit Logs and Executive Summaries
- **Audit Logs:** Document formal accessibility violations mapped against WCAG Success Criteria or accessibility standards.
- **Executive Summaries:** Summarize high-level accessibility audit findings and compliance risks for executive stakeholders.
- **Usability Reports:** Focus on user experience barriers (e.g., confusing navigation, unclear error recovery, unnecessary workflow steps) using customizable fields and usability frameworks such as Nielsen's usability heuristics.

### Selecting Usability Report Type in Report Builder
1. Open Report Builder.
2. In Report Metadata, set **Report Type** to **Usability Report**.
3. Select a **Report Layout** (Paragraphs, Bullets, or Template). Usability Reports provide the same Layout and Field Configuration capabilities as Executive Summaries.

### Configurable with No Default Fields
Usability Reports contain **no default fields**. When creating a new Usability Report, the report starts completely empty with zero fields. Evaluators determine which fields are appropriate for their evaluation methodology and reporting needs.

### Adding and Configuring Fields
1. Expand **Configure Report Fields**.
2. Enter a **Field Name** and select a **Field Type** (Text, Textarea, Dropdown, Usability Heuristics, Attachment, Evaluation Item Selection Box, or WCAG Success Criterion).
3. Select **Add Field**. You can reorder, rename, or delete fields at any time.

### Usability Heuristics Field Type
- Select **Usability Heuristics** as the Field Type to add heuristic evaluation options to the report.
- **Initial Default Heuristics:** Usability Heuristics fields include Nielsen's 10 usability heuristics by default:
  - **Visibility of system status:** The system should always keep users informed about what is happening, through appropriate feedback within a reasonable time (e.g., loading indicators, progress bars, active status indicators).
  - **Match between system and the real world:** The system should speak the users' language, using words, phrases, and concepts familiar to the user, rather than internal jargon or technical terms, following real-world conventions.
  - **User control and freedom:** Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave the unwanted state without having to go through an extended process (e.g., undo, redo, cancel, back).
  - **Consistency and standards:** Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform and industry conventions so interface elements behave predictably.
  - **Error prevention:** Even better than good error messages is a careful design which prevents a problem from occurring in the first place. Either eliminate error-prone conditions or check for them and present users with a confirmation option before they commit to the action.
  - **Recognition rather than recall:** Minimize the user's memory load by making elements, actions, and options visible. The user should not have to remember information from one part of the interface to another. Instructions for use of the system should be visible or easily retrievable whenever appropriate.
  - **Flexibility and efficiency of use:** Shortcuts—hidden from novice users—may speed up the interaction for the expert user such that the system can cater to both inexperienced and experienced users. Allow users to tailor frequent actions (e.g., keyboard shortcuts, macro workflows, custom presets).
  - **Aesthetic and minimalist design:** Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information in an interface competes with the relevant units of information and diminishes their relative visibility.
  - **Help users recognize, diagnose, and recover from errors:** Error messages should be expressed in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution.
  - **Help and documentation:** Even though it is better if the system can be used without documentation, it may be necessary to provide help and documentation. Any such information should be easy to search, focused on the user's task, list concrete steps to be carried out, and not be too large.
- **Customizing Options:** Evaluators can edit the heuristic options list in Field Configuration to use organization-specific heuristics, custom principles, or other usability frameworks.
- **Single and Multi-Select:** Usability Heuristics fields support both single-selection and multiple-selection modes.

### Data Entry in Report Editor
- In Report Editor, Usability Reports support multi-issue data entry.
- All issues entered in Report Editor are displayed in Report Viewer, Working Views, and exported formats in the order added (first added shows first, last added shows last).
- When a Usability Heuristics field is configured, the editor displays an accessible select or multi-select control for picking applicable heuristics.

### Optional Table of Contents and Section Links
- Usability Reports do not include an Analytics section inside the report.
- When enabled in layout configuration, Usability Reports include an optional **Table of Contents** placed immediately after the cover page as the first major section.
- Table of Contents entries are accessible links (`.viewer-toc-link`). Activating a section link moves keyboard focus directly to that section's heading in Report Viewer.

### Executive Summary Section Behavior
- In both Executive Summaries and Usability Reports, the Executive Summary section lists **only issue titles** for quick scanning.
- The Findings section remains intact and displays complete issue details for every issue in the order added.

### Stand-Alone and Workspace Support
Usability Reports function as stand-alone reports or within Project Workspaces. Workspace-based Usability Reports inherit workspace permissions, collaboration settings, sharing rules, and template workflows.

### Collaboration and Working Views
- Authorized collaborators can edit, review, and comment on Usability Reports.
- Working Views support grouping, sorting, filtering, and batch updates on Usability Reports without modifying report data.

### Organization Statistics Integration
- When Organization Statistics are enabled in Application Settings, Usability Reports contribute data to organization-level metrics (by Organization/Client, Product, Project, Workspace, and Usability Heuristic).
- **Organization/Client Metadata:** Aggregation relies on consistent population of the Organization/Client metadata field.
- **Product and Tester Metadata:** Product information enables product-level usability trends, while Auditor(s) metadata contributes to unique tester activity counts without evaluating individual employee performance.
- Authorized tasks associated with the selected reports or Project Workspaces contribute task totals, open/completed counts, overdue and high-priority counts, completion percentage, and status/priority distributions.
- The dialog identifies the selected organization, active filters, date range, and report count. Unavailable metrics include an explanation instead of being shown as zero.
- Use the Data Quality view to identify reports missing organization, product, tester, or date metadata before interpreting aggregate results.

## Shared Progress Logs
Shared Progress Logs are a local/file-based workspace for tracking project and testing activity without duplicating the detailed findings in Audit Logs, Executive Summaries, or Usability Reports.

### Creating and Managing a Shared Progress Log
1. Open **Tools > Progress Log > Shared Progress Logs**, or find **Open Shared Progress Logs** in Command Palette.
2. Select **Create Progress Log**. ART creates a named local Shared Progress Log with stable identifiers for the log and status definitions.
3. Select one or more reports under **Associated Reports**. Associations reference existing report IDs and do not change report fields, findings, or report types.
4. Select **Add Task** to create a task. Each task has a stable ID, name, description, status, timestamps, and comments.
5. Use the native **Status** select to record task progress. Status is visible and programmatically available; ART never communicates progress only through color.
6. Enter text in a task's **Add comment** field and select **Add Comment**. Comments retain an ID, author label, content, and timestamp.

### Local Data and Portability
Shared Progress Logs remain available in local ART operation and are included in ART Project export/import payloads. They can be used with a stand-alone report, several reports, or a Project Workspace. They do not require an ART server, account, Internet connection, or workspace.

### Current Collaboration Boundary
The current Shared Progress Log implementation stores local/file-based task records, report associations, statuses, and comments. It does not yet implement account-specific sharing, organization membership, permission enforcement, server synchronization, personalized assignments, email, or @mention notifications. Those capabilities require ART's authenticated identity, passwordless authentication, file-based collaboration, and authorization foundations defined in Epics 45, 49, 50, and 51. Local ART work remains available without those services.

## Account and Identity Foundation
ART remains fully usable without an account. Report creation, editing, importing, exporting, local Progress Logs, Shared Progress Logs, and local Organization Statistics do not require signing in.

### Local Profile and Device Identity
Open **Application Settings > Account and Identity** to save a local Name, Display Name, Email Address, Job Title, and ART Role. ART Role is a permission tier selected from Owner, Administrator, Project Manager, Reviewer, Contributor, Viewer, or Other. Organization membership roles remain a separate scope and can narrow effective access. ART creates a stable local user identifier and device identifier independently of these editable profile values. This local profile supports future file-based attribution but is not an authenticated account and does not grant access to shared or server-based resources.

### Authentication State
ART clearly distinguishes Not signed in, Authentication in progress, Signed in, Session expired, Signed out, and Authentication service unavailable. When signed out or when an authentication service is unavailable, local work remains available and unsaved local data is not removed.

### Privacy and Credential Safety
ART never stores passwords, passkeys, OAuth access tokens, refresh tokens, or session credentials in the local profile, ART project files, reports, exports, or ordinary application logs. Authentication providers must validate credentials externally and establish a non-secret identity session through ART's centralized identity service.

### Current Authentication Boundary
The Account and Identity service is the shared application boundary for future providers and authorization. It intentionally does not implement a browser-only mock login, OAuth callback, or passkey workflow. Secure passwordless authentication requires the server-side relying-party, origin, challenge, token, and session infrastructure specified for Epic 49. Organization membership, roles, and the Authorization Policy Service are scheduled for Epic 51.

## Security and Privacy
ART is local-first: by default, ART-managed data remains in your browser on your device until you explicitly export, import, or use an external integration. Local browser storage is not equivalent to encrypted enterprise storage, so protect your device and browser profile appropriately.

Review reports, Projects, tasks, and Shared Progress Logs before sharing exported files. Do not put passwords, passkeys, OAuth tokens, refresh tokens, API keys, or other credentials in report fields, templates, notes, or exports. Privacy Mode blocks external communication through ART's guarded paths.

For the current security boundary, responsible vulnerability reporting, and the release checklist, see [ART Security and Privacy](SECURITY.md). Hosted or self-hosted deployments require separate secure authentication, server-side authorization, organization isolation, monitoring, backup, and incident-response controls before production use.

## Tasks and To-Do
ART provides a local-first Tasks & To-Do workspace for tracking work without creating duplicate checklist or to-do records. Tasks use stable identifiers and can retain a name, description, status, priority, due date/time, deferred resume date/time, comments, report/workspace references, and completion time.

### Managing Local Tasks
1. Open **Tools > Tasks and To-Do**, or use Command Palette to find **Open Tasks and To-Do**.
2. Use **Create Task** to add a task to your Personal To-Do List.
3. Use the checkbox to mark a task complete, or use the Status select for more detailed status.
4. Select **Edit** on a task to open the Edit Task dialog and set Priority, Due date and time, and optional Comments.
5. When Status is **Deferred**, the Edit Task dialog also shows a Resume date and time field.

### Task Views and Sorting
Tasks & To-Do provides accessible tabs for Assigned Tasks, Personal To-Do List, Completed Tasks, and Shared Tasks when shared tasks are available. Completed tasks move out of the active personal list automatically. Select a sort order to arrange active tasks by priority, due date, or date added. Priority is always displayed in text; it is never communicated only by color.

### Dashboard To-Do List
The Dashboard's optional **To-Do List** widget shows up to five active personal tasks, ordered from Critical through Low priority. Each entry provides a Complete checkbox along with the task name, priority, and due date/time. Completed tasks do not appear in this summary. Select **Open Tasks and To-Do** to manage the full list.

### Local-First and Future Sharing
Tasks are retained locally and in ART Project export/import data. Account-specific assignment, shared members, authenticated @mentions, email, server notifications, and permission enforcement require the future authentication, file-based collaboration, and authorization work in Epics 49, 50, and 51.

## Organizations, Roles, and Device Identity
Application Settings, under **Account and Identity**, shows this ART installation's stable local device identity alongside a **Personal ART Identity Code**. The code is intended to recognize this installation when linking additional devices to the same identity in a future release; entering a code from a different installation is not yet supported because that requires ART's server-based identity service.

Under **Organizations and Roles**, record the organizations you belong to and select your role in each:

- **Owner** and **Admin** — manage the organization, members, and roles, in addition to project, report, task, and Progress Log actions.
- **Editor** — manage projects, edit reports, and manage tasks and Progress Logs.
- **Contributor** — edit reports and manage tasks.
- **Viewer** — view-only access.

ART's local **Authorization Policy Service** checks your recorded role before allowing organization-scoped actions — for example, clearing Organization Statistics snapshots requires a role with the manageOrganization permission (Owner or Admin) for that organization, if you have recorded a role for it. This is a client-side, local-first foundation for the authorization model described in Epic 51; it does not yet enforce permissions on a server, and full authenticated multi-user authorization requires Epic 49's authentication service.

## Performance and Scalability
ART preserves responsiveness by rendering only Dashboard widgets selected in Dashboard Configuration and reusing organization metric calculations for an unchanged report state and scope. Derived organization metric results are kept in a bounded cache of the 100 most recent scopes. Editing reports or tasks clears derived results so later calculations use current data. This cache stores calculated values only and does not transmit report content.

Very large imports, exports, cloud operations, collaboration sessions, and server-backed workloads remain dependent on the available provider and deployment. Large-dataset, load, concurrency, desktop resource, and assistive-technology-under-load acceptance testing are deferred until representative infrastructure is available.

## Storage Providers
ART uses a provider-independent storage architecture so its core reporting, task, and collaboration functionality never depends on a specific storage service.

### Available Providers
- **Local Computer** — the reference storage provider; open and save `.art` files using standard file dialogs.
- **Network or Shared Folder** — any folder the operating system already exposes for file access, including network drives, shared folders, and synchronized cloud-drive folders. ART uses the same local file access as Local Computer and does not need to know how the folder is synchronized.

### Planned Providers
**Dropbox** and **ART Server** appear in Application Settings under **Storage Providers** as planned integrations (Epic 55 and a future authenticated server). Selecting **Connect** on any of these explains that the integration is not yet available; ART remains fully usable with local files in the meantime.

### Cloud Providers Are Opt-In
Google Drive and Microsoft OneDrive are entirely optional. Until you connect one of them in Application Settings, its Dashboard buttons, File menu entries, Command Palette entries, and Keyboard Shortcut Manager rows all stay hidden. Disconnecting a provider hides its controls again. No other ART functionality is affected by which cloud providers you choose to connect.

### Connecting Google Drive
Google Drive is the first cloud storage provider ART supports.

1. An ART administrator configures a Google Drive OAuth Client ID once, under **Google Drive Connection** in Application Settings. ART does not include a Client ID by default.
2. Select **Connect Google Drive**. A Google sign-in popup opens; allow popups for the ART site if your browser blocks it.
3. After authorizing, ART shows Google Drive as connected for the current browser session, and its Dashboard buttons, menu entries, and shortcut rows appear.
4. Select **Disconnect Google Drive** at any time. Disconnecting does not delete anything in your Google Drive, and hides those controls again.

ART requests only the `drive.file` OAuth scope: access to files ART creates or that you explicitly open, never your entire Google Drive. Connections are per browser session; closing the browser tab requires reconnecting.

### Opening and Saving Projects with Google Drive
Once connected, use these Dashboard buttons (also available from the File menu and Command Palette):

- **Open from Google Drive...** — lists `.art` files found in the root of your Google Drive and opens the one you choose.
- **Save to Google Drive** — the first time, asks for a filename and creates a new file; after that, it updates the same file.

Both actions are registered in the Keyboard Shortcut Manager without a default binding, so you can assign your own shortcut if desired. Browsing Google Drive subfolders, choosing a dedicated ART folder, and merge-conflict integration for Google Drive files are not yet available.

### Connecting Microsoft OneDrive
Microsoft OneDrive works the same way as Google Drive.

1. An ART administrator configures a Microsoft Azure AD Application (Client) ID once, under **Microsoft OneDrive Connection** in Application Settings.
2. Select **Connect OneDrive**. A Microsoft sign-in popup opens; allow popups for the ART site if your browser blocks it.
3. After authorizing, ART shows OneDrive as connected, and its Dashboard buttons, menu entries, and shortcut rows appear.
4. Select **Disconnect OneDrive** at any time. Disconnecting does not delete anything in your OneDrive, and hides those controls again.

ART requests only the `Files.ReadWrite.AppFolder` scope: access to ART's own dedicated App Folder, never your entire OneDrive. Once connected, use **Open from OneDrive...** and **Save to OneDrive** the same way as their Google Drive equivalents. Both actions are registered in the Keyboard Shortcut Manager without a default binding. Browsing additional OneDrive folders and merge-conflict integration for OneDrive files are not yet available.

### Connecting Dropbox
Dropbox is an optional provider and uses an app registered with Dropbox's **App folder** access type.

1. An ART administrator configures the Dropbox App Key under **Dropbox Connection** in Application Settings.
2. Select **Connect Dropbox** and complete the Dropbox sign-in popup. Allow popups for the ART site if the browser blocks it.
3. After authorization, Dropbox controls appear in the Dashboard, File menu, Command Palette, and Keyboard Shortcut Manager.
4. Select **Disconnect Dropbox** to end the session. Existing local files and Dropbox files are not deleted.

ART requests only file-content read/write scopes and Dropbox confines access to the app's dedicated folder. Use **Open from Dropbox...** to list `.art` files there, or **Save to Dropbox** to create a file the first time and update it afterward. Both commands have no default keyboard shortcut. Folder browsing beyond the app folder and merge-conflict integration remain deferred.

### Choosing a Default Provider
Select a **Default storage provider** in Application Settings to record your preference. No storage provider is ever required for ART's core reporting, Tasks, or Progress Log functionality, and existing local `.art` files continue to open normally.

## Storage and Synchronization
The Dashboard's **Storage and Synchronization** section identifies the active provider and file, and reports whether the file is up to date, has local changes pending, is offline, or needs provider-specific synchronization. **Refresh Storage** checks the current state without replacing local work. **Synchronize Storage** is available for connected remote files after local changes are saved; it reports clearly when a provider's revision workflow is not yet available.

If the network goes offline, ART keeps local editing, tasks, Progress Logs, and local saves available and marks the status **Offline**. After reconnection, refresh before assuming the remote file is current. ART does not silently overwrite newer remote content. Automatic remote revision comparison, compatible-change merging, and provider-specific conflict resolution are deferred until those provider adapters expose the required revision metadata and merge inputs.

## External Integrations
Application Settings has a separate **External Integrations** section for optional Jira, GitHub Issues, Microsoft Azure DevOps, and Google Workspace connections. These integrations do not replace ART storage providers and are never required for reports, audits, Tasks, or collaboration.

For each integration, use **Connect**, **Disconnect**, or **Test Connection** when a provider adapter is configured. Choose the ART data-sharing scope explicitly. This release offers Current report, Selected findings, and Selected tasks. Integration state and sharing choices are stored locally; external credentials are not stored in `.art` files.

The common management layer is available now, but live provider adapters, OAuth setup, importing external issues, creating external work items, field mappings, external links, and synchronization require provider-specific credentials and implementation. Unconfigured integrations display **Configuration incomplete** and leave ART's local workflows unchanged.

## ART Desktop Application
ART's Electron desktop shell uses the same web application and shared core modules as the browser version, so reports, Tasks, Progress Logs, storage, integrations, accessibility settings, and keyboard shortcuts remain consistent.

The Windows package is configured as `ART-Setup.exe`. It creates standard Start Menu/Desktop shortcuts and associates `.art` files with ART. Opening an `.art` file from Windows launches ART and sends the file through ART's normal validation and import workflow. The desktop shell does not require an ART server for local-first work.

The source includes the desktop startup and packaging configuration, but production signing, release automation, website distribution, automatic updates, macOS/Linux packages, and full desktop assistive-technology testing remain deferred. Building locally requires the Node/Electron dependencies described in `package.json`.

The desktop shell uses the same ART renderer, state model, validation, command registry, and accessibility implementation as the web app. Its native File, View, and Help menus send commands into that shared layer. Window size is persisted in the desktop application-data directory, and opening an `.art` file from Windows uses the same project validation/import workflow as the browser.

Native menu accessibility, installer behavior, screen-reader parity, multi-monitor placement, native printing/notifications, update behavior, and macOS/Linux behavior still require manual validation on their target platforms.

## Privacy and User Data
ART's fundamental local workflows do not require an account, sign-in, email address, cloud provider, or ART server. In Application Settings, **Privacy and User Data** lists the local data categories used by ART and the browser storage locations where they reside.

Optional telemetry is disabled by default. No telemetry collection pipeline is enabled by this release; the setting records an explicit future-deployment preference only.

Use **Export My ART Data** to download a JSON copy of your local profile, ART project data, application information, and data inventory. Authentication and provider session credentials are excluded. Use **Clear Local ART Data** only after exporting anything you need. The action requires confirmation, clears local ART data and browser session credentials, and restores the default application state.

Server-hosted retention, account deletion, organization-owned data, backups, and third-party provider retention depend on the relevant deployment and provider policies. The local application cannot delete data it does not control.

## Organization Administration
If your recorded organization role is Owner or Admin, Application Settings shows **Organization Administration**. Select an organization to edit its profile, add or remove local member records, create or revoke local invitation records, and review the administrative audit log.

These controls use the Epic 51 Authorization Policy Service. Users without an administrable organization cannot use them. Local invitation records do not send email, create accounts, disable users, or change server membership. Authenticated invitations, ownership transfer, account status, retention, organization-level integration restrictions, and server-side authorization remain deployment-dependent.

## Advanced Collaboration and Synchronization
When an `.art` project is opened, ART starts a local collaboration session and records the local ART user/device attribution plus a bounded revision history with content hashes and parent revision IDs. Collaboration providers can add participant presence and synchronization operations when their adapters are available.

If synchronization is unavailable, ART can retain pending collaboration operations locally. Conflict and failure states are reported through Storage and Synchronization, and local work is preserved. This metadata does not include passwords, OAuth secrets, or provider session tokens.

Provider-specific remote revision checks, automatic compatible merges, real-time presence, server synchronization, and multi-user end-to-end validation remain deployment-dependent work.

## Merge Conflict Resolution
ART includes a local, provider-neutral three-way merge foundation for safely comparing a common base version with your version and another version. This supports future file-based collaboration and server synchronization without silently choosing a winner when two versions change the same field differently.

### How Conflict Resolution Works
1. ART automatically retains non-conflicting changes when the changes affect different fields.
2. When both versions change the same value differently, ART creates a field-level conflict.
3. Open **Tools > Collaboration > Open Merge Conflict Resolution** or use Command Palette to review the accessible conflict dialog.
4. For each conflicting field, select **Keep my version** or **Keep other version**, then select **Apply Merge**.

The dialog uses native radio controls, announces the number of unresolved fields, moves focus into the dialog, restores focus when closed, and supports Escape to cancel. Cancelling leaves both source versions unchanged.

### Current Collaboration Boundary
The merge engine is available for local/file-based structured data and preserves conflicts for resolution. Integrating it with external file revision checks, multi-user file exchange, server synchronization, identity attribution, and permission enforcement requires later file-based collaboration, authentication, and authorization foundations in Epics 49, 50, and 51.
