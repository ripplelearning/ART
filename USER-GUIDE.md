# ART User Guide: Plugins and Packages

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
  - Visibility of system status
  - Match between system and the real world
  - User control and freedom
  - Consistency and standards
  - Error prevention
  - Recognition rather than recall
  - Flexibility and efficiency of use
  - Aesthetic and minimalist design
  - Help users recognize, diagnose, and recover from errors
  - Help and documentation
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
