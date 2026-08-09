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
