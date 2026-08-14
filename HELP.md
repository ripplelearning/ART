# ART Help: Plugin and Package Framework

## What Are Plugins?
Plugins are executable ART extensions that register capabilities through approved extension points. Plugins do not modify core source files at runtime and do not bypass ART frameworks.

Examples:

- import and export providers
- search providers
- dashboard providers
- explorer providers
- context menu providers
- validation providers
- AI and integration providers

## What Are Packages?
Packages are non-executable content bundles that ART registers as resources after existing workflows complete.

Examples:

- accessibility standards bundles
- report templates
- keyboard profiles
- working view presets
- dashboard layouts
- saved searches

## Existing Workflow Integration
The Plugin Framework does not replace existing workflows.

Continue using:

- Import Accessibility Standard
- Connect Integrations
- Import Template
- Collaboration settings and commands
- Keyboard Shortcut Manager
- Working View Framework
- Dashboard Framework

After those workflows complete, ART registers package/plugin metadata through the Plugin Framework.

## Publishing Presentation in Report Builder
Report Builder now includes a Publishing Presentation designer for reusable Report Layouts, Themes, Branding resources, and Publishing Profiles.

Publishing Presentation capabilities include:

- reusable Report Layout resources with section order, visibility, cover page, table of contents, and page numbering controls
- reusable Report Themes with color, typography, spacing, table, and link styling controls
- reusable Branding resources with rich header/footer content, multiple images, decorative-image flags, and required alternative text
- accessible validation for contrast, link differentiation, layout compatibility, missing dependencies, and required alternative text
- preview modes for screen, print, PDF, Word, and HTML publishing contexts
- reusable resource scopes for personal, workspace, shared, and application-provided presentation assets
- command-driven Presentation menu integration

Presentation resources remain separate from the underlying report findings and field data. Reports use references and optional overrides rather than duplicating reusable presentation resources.

When a Project Workspace is open and the current report belongs to that workspace, you can choose:

`☐ Make this the default branding for new reports in this Project Workspace.`

Workspace branding defaults are workspace-scoped metadata and do not overwrite branding in existing reports unless you manually edit those reports or explicitly apply a different Branding resource.

## Plugin Lifecycle
Plugins move through lifecycle states:

- Discover
- Validate
- Register
- Load
- Initialize
- Enable
- Disable
- Update
- Unload
- Uninstall

## Plugin and Package Manager
Use Application Settings -> Administrator Tools -> Plugin & Package Manager to:

- install plugin manifests
- enable/disable plugins
- uninstall external plugins
- validate all registered extensions
- inspect registered package metadata
- review plugin dependencies and dependency diagnostics
- review declared plugin permissions
- export plugin framework configuration
- import plugin framework configuration

## Dependency and Permission Behavior
- Plugins can declare required or optional plugin dependencies.
- ART blocks plugin enable when required dependencies are missing, disabled, or below required version.
- ART blocks disable/uninstall when another enabled plugin depends on the target plugin.
- Plugin manifests can declare required permissions, and Plugin Manager surfaces elevated permissions for review.

## Resource Relationships
ART now maintains resource relationships through a centralized Resource Relationship Framework.

Relationship categories include:

- Contains
- Uses
- References
- Depends On
- Shared With
- Generated From

Explorer now shows relationship information beneath supported resources without changing the underlying resource hierarchy.

Use relationship information to answer questions such as:

- which reports use a template
- which reports reference an attachment or asset
- which accessibility standard a report uses
- what resources will be affected before a deletion

## Explorer Relationship Navigation
In Resource Navigator:

- expand a resource to load its relationship groups
- activate a related resource to move focus to that resource in Explorer
- use Show Properties to open the relationship-aware resource properties dialog
- resource rows surface collaboration visibility and owner information when available
- resource collaboration edits record audit entries that appear in Resource Properties
- Resource Properties lets you add a collaboration comment and view the latest comment thread entry

Explorer relationship nodes are virtual. They do not create duplicate resources.

## Resource Properties and Impact Analysis
Supported resources expose relationship details through Resource Properties.

Resource Properties includes:

- Overview
- Relationships
- collaboration summary and edit action
- relationship search within the current dialog
- impact analysis counts
- copy commands for name, path, and relationship details
- collaboration summary, edit action, and audit trail counts
- collaboration comment action and latest comment details

Project Properties also includes a Relationships tab with workspace-level relationship summary and validation status.

## Safe Deletion
When removing a project asset, ART now opens a Deletion Analysis dialog before the asset is deleted.

The dialog identifies:

- affected resources
- outgoing relationship removals
- likely impact based on current registered relationships

Deletion analysis is informational. It does not delete any additional resources.

If broken relationships are detected during deletion analysis, ART now exposes a Repair Relationships action directly from that dialog.

## Relationship-Aware Search
Universal Search now includes relationship-aware matches.

Relationship matches explain why a resource appeared by showing the relationship category that matched the query.

Examples:

- reports using WCAG 2.2
- resources referencing a shared asset
- templates used by reports in the current workspace

## Relationship Working Views
Working View now supports relationship-based analysis for the active report.

Built-in relationship presets include:

- Grouped by Attachment
- Grouped by Accessibility Standard
- Shared Evidence Review

Relationship Working Views can:

- group findings by attachment evidence
- group findings by related accessibility standard metadata
- filter visible findings by relationship text
- show relationship-derived columns in Table view

These views remain temporary unless Apply Working View is used on a report type that supports reordering.

## Automatic Relationship Maintenance
ART now reconciles workspace relationships automatically after report updates, template updates, and accessibility standard updates.

This helps preserve relationship integrity after:

- report deletion
- report import or replacement
- template creation, save, deletion, or import
- workspace restore and duplication

## Report and Template Rename/Replace
ART now includes explicit rename and replace workflows for reports and user templates.

Use these workflows to:

- rename a report without breaking workspace relationship integrity
- rename a user template while preserving template usability
- replace one report with another and move workspace references to the replacement
- replace one user template with another and move report and workspace references to the replacement

Replace workflows delete the original resource after references are moved.

## Resource Tags, Collections, and Saved Views
ART now includes a Resource Organization Framework that adds non-destructive metadata organization for workspace resources.

Organization objects include:

- Tags for labeling resources across reports, templates, standards, assets, and attachments
- Collections for grouping resources into reusable sets
- Saved Views for reapplying Working View configuration snapshots

Organization metadata is workspace-aware and does not rewrite the underlying resource payloads.

## Organization Commands
Use the command framework to access:

- Tag Manager
- Collection Manager
- Saved View Manager
- Create Tag
- Create Collection
- Create Saved View
- Open Saved View
- Delete Saved View
- Export Resource Organization Metadata
- Import Resource Organization Metadata

Manager workflows support additional actions such as rename, duplicate, merge, delete, and favorite toggles where applicable.

New organization-related commands are registered in shortcut management as unassigned by default unless a user explicitly assigns a shortcut.

## Explorer Organization Sections
When a Project Workspace is active, Explorer now includes organization sections for:

- Collections
- Tags
- Saved Views

Explorer organization entries support quick actions such as opening a Saved View, toggling favorites, and opening manager workflows.

## Structured Organization Search
Universal Search supports organization-specific structured filters:

- tag:critical
- collection:"Client Deliverables"
- view:"Executive Summary"

These filters are available through Search Everywhere and are served by the resource-organization provider.

## Search Scope and Search Everywhere
Search Everywhere (Ctrl+K) is location aware. It starts in Current Report when a report is open, Current Project Workspace when a workspace is open, and All ART Content otherwise.

Use the Search scope list to change what is searched. The active scope is announced when it changes, and the result status reports the scope, the total number of results, and a count for each result category.

Search Everywhere covers commands, report fields and findings, reports, templates, workspaces, project assets, accessibility standards and WCAG Success Criteria, report layouts, themes, branding, publishing profiles, keyboard shortcuts, help topics, saved searches, dashboard widgets, plugins, and packages.

WCAG results include the criterion number, name, and conformance level. You can search by identifier such as 1.4.3, by name such as Contrast Minimum, or by concept such as keyboard trap.

When a search returns no results in a narrower scope, use the Search all ART content instead button to broaden it. ART does not broaden the scope automatically.

Activating a result opens its exact destination and moves focus there. Press Escape to close Search Everywhere and return focus to the control that opened it.

Application Settings includes a Search section for the default search scope, saving search history on this device, and clearing search history.

## Quick Open and Recent Items
Quick Open provides a fast way to open a resource you already know by name. It covers reports, report fields and findings, templates, Project Workspaces, project assets, working views, collections, tags, layouts, themes, branding, publishing profiles, plugins, and packages.

Quick Open starts in the scope that matches your current location and provides a Quick Open scope list. When a search returns nothing in a narrower scope, use Search all ART content instead to broaden it.

Focus moves to the Quick Open box when it opens. Press Down Arrow or Alt+Down Arrow to move into results, Enter to open the selected resource, and Escape to close and return focus to where you started.

Opening Quick Open with an empty box lists Recent Items, most recently opened first. Recent items are recorded only when a resource is successfully opened, are personal to you, and are stored on this device.

Use Remove From Recent to remove the selected entry, or Clear Recent Items to remove them all. Clearing recent items does not delete reports, workspaces, or other resources.

Quick Open, Open Recent Items, and Clear Recent Items are available from the Search menu, Command Search, and the Command Palette, and can be assigned keyboard shortcuts in the Keyboard Shortcut Manager. They have no shortcut assigned by default.

## Favorites and Bookmarks
Favorites and Bookmarks are separate features. A Favorite marks a resource you use often. A Bookmark marks a specific location inside a resource. Adding one never creates the other.

Use Add To Favorites and Remove From Favorites for the resource or location you are working in. In Quick Open, the action button adds or removes the selected result and its label states which action it will perform. Use Open Favorites to review and open favorites. Favorites receive a small relevance boost in Quick Open but never displace a stronger match.

Use Bookmark This Location to save where you are. ART records the exact location, such as a specific finding or a report field, and generates a meaningful name. Use Open Bookmarks to return to one, and Rename Bookmark, Remove Bookmark, and Clear Bookmarks to manage them.

Bookmarks store stable internal references, so renaming a report does not break them. If a bookmarked location no longer exists, ART reports it and leaves your current work in place.

Favorites and bookmarks are personal and stored on this device. They never change who can access a resource, and removing them never deletes the underlying resource.

## Metadata Portability and Integrity
Resource organization metadata can be exported/imported independently and is also included in Project Workspace portability payloads.

ART reconciles unresolved organization references and preserves organization integrity when reports and templates are replaced.

## History, Undo, Redo, and Versioning
ART includes a centralized History Framework for:

- Undo
- Redo
- Change history
- Resource version history
- Restore previous version
- Version comparison

History and version metadata are stored locally and integrated with existing ART commands and dialogs.

## History Commands
History commands are available through existing command routing:

- Undo
- Redo
- History...
- Version History...
- Compare Versions...
- Restore Previous Version...
- Clear History...

These commands are available in Edit > History, Command Palette, and Menu Bar command search.

The Menu Bar now groups the most common file and editing actions into nested submenus for easier discovery:

- File > New includes Report, Template, Project Workspace, and Working View entries.
- File > Recent Reports/Projects shows the most recently used reports and Project Workspaces.
- File > Open includes Open ART Project and report-opening actions.
- File > Open, Save, and Close organize the matching report, workspace, and Working View commands.
- Edit contains clipboard actions such as Cut, Copy, Paste, and Select All.

## Undo and Redo Behavior
- Undo and Redo operate on centralized transactions.

## Dashboard Analytics Framework
ART Dashboard now includes a dedicated Dashboard Analytics widget in the Analytics tab.

Analytics behavior is context-aware:

- if no Project Workspace is open, the widget shows an empty-state guidance message
- if a Project Workspace is open, the widget shows workspace analytics sections
- if Working View is active for the current report, the widget can switch between report analytics and workspace analytics

Trend analytics are included in the Activity and Trends section:

- within a Project Workspace, trends are based on report history inside that workspace
- for standalone reports, trends are grouped across standalone reports with the same Organization/Company value
- optionally, you can include an aggregate trend across all standalone reports, including unrelated organizations

Analytics sections are rendered as accessible accordion regions with keyboard-operable toggle buttons and aria-expanded state.

## Analytics Settings
Use Application Settings -> Dashboard Analytics to configure:

- default analytics scope
- default expanded analytics sections
- display options (percentages, trend insights, plugin sections, unrelated standalone trend inclusion)
- accessibility options (scope change announcements and section description emphasis)

Use the command Open Analytics Settings Section to open this settings section directly.

The command is registered in Keyboard Shortcut Manager and is unassigned by default.

## Collaboration Settings
Use Application Settings -> Collaboration to configure:

- collaboration enabled state
- optional collaboration toolbar visibility
- toolbar position
- collaboration mode
- provider identity and status

When Collaboration is enabled and the toolbar is shown, ART displays a Collaboration toolbar on the Dashboard with quick access to the Collaboration settings.

When Collaboration is enabled, a Collaboration menu appears in the menubar before Help.

Collaboration prerequisites:

- Multi-user live collaboration requires a running collaboration server.
- Asynchronous collaboration via shared-drive/shared-folder workflows requires server-side shared-folder persistence.
- On Windows, the recommended startup command is the repository launcher script start-collaboration-server.ps1.
- For a startup + browser health check in one step, use start-collaboration-server-and-open-health.ps1.

Fastest live setup path:

1. Start the collaboration server.
2. Open Application Settings -> Collaboration.
3. Set Live collaboration server URL.
4. Select Quick Start Live Collaboration.
5. Confirm connected state in Live summary and Session summary.

Manual live connect/disconnect path:

1. Select Connect Server.
2. Select Start Live Session.
3. Collaborate.
4. Select Disconnect Server when done.

Collaboration setting reference:

- Enable Collaboration: master on/off switch for collaboration behavior. Disabling this keeps collaboration metadata in state but turns off collaboration runtime surfaces.
- Show Collaboration Toolbar: controls whether the dashboard collaboration toolbar is visible when collaboration is enabled.
- Collaboration mode:
	- Independent: local-only workflow with no active sync expectation.
	- Asynchronous: team coordination without strict real-time synchronization.
	- Synchronous: team coordination with expected sync checkpoints.
	- Real-time: most aggressive mode, intended for always-on collaboration and frequent updates.
- Toolbar position: places the collaboration toolbar in the selected screen corner.
- Provider ID and Provider Name: identifies the active collaboration provider in state and summaries.
- Provider Status: marks provider health/connection state (available, connected, connecting, degraded, unavailable).

Sharing and discovery options:

- Discovery scope:
	- Resource: discovery is constrained to explicit resource-level visibility.
	- Workspace: discovery includes workspace-scoped shareable items.
	- Organization: discovery favors org/public visibility.
	- Quick guidance: Resource is best for private/local workflows, Workspace for team-visible collaboration, Organization for broad discoverability policy.
- Allow discovery directory listing: when enabled, discovery snapshots can include broader resource listings.
- Require approval before sharing access: marks sharing as approval-gated and surfaces this requirement in discovery snapshot metadata.
- Allow guest share links: permits guest-style sharing links in sharing policy.
- Default share expiry (days): sets the default lifetime for newly shared access patterns.
- Sharing channels: comma-separated default channels for sharing and discovery summaries.

Synchronization and versioning options:

- Enable synchronization: toggles synchronization policy on/off.
- Sync mode: manual, scheduled, or real-time synchronization policy.
- Conflict strategy:
	- Manual Review: conflict is resolved without automatic metadata mutation.
	- Latest Write Wins: applies incoming metadata and incoming comments.
	- Metadata Priority: applies incoming metadata fields (without forced comment append).
	- Append Comments: appends incoming comments while preserving local metadata fields.
	- Quick guidance: use Manual Review when human verification is required; use Metadata Priority or Append Comments for targeted automatic conflict handling.
- Auto-merge comments: allows comment merge behavior when strategy permits it.
- Auto-merge metadata: allows metadata merge behavior when strategy permits it.
- Keep version history: preserves version history semantics during synchronization updates.
- Maximum versions per resource: cap used for synchronized version retention policy.
- Record Sync Checkpoint: stamps the latest sync timestamp in collaboration state.

Live collaboration quick start options:

- Live collaboration server URL: WebSocket endpoint used for real-time multi-user collaboration.
- Live session name: friendly label used when starting a live session.
- Live server auth token (optional): token sent during live connection handshake when required by your server.
- Auto-connect to this live server on startup: attempts to reconnect quickly when collaboration settings are opened and applied.
- Quick Start Live Collaboration: applies live-friendly defaults, connects to the configured server, and starts a live session in one step.
- Connect Server / Disconnect Server / Start Live Session: granular controls when you do not want one-click quick start.
- Publish Async Snapshot / Pull Async Snapshot: share collaboration metadata asynchronously through server-coordinated shared storage (for example a shared drive folder mounted on the collaboration server).

Asynchronous shared-folder workflow:

1. Start the collaboration server with shared-folder persistence enabled.
2. User A selects Publish Async Snapshot.
3. User B selects Pull Async Snapshot.
4. ART applies the pulled snapshot and updates synchronization status.

Operational collaboration actions:

- Generate Discovery Snapshot: creates a current snapshot of discoverable resources under active sharing rules.
- Queue Test Conflict: inserts a synthetic pending conflict with incoming metadata/comments for validation.
- Resolve Oldest Conflict: resolves the oldest pending conflict using the selected conflict strategy and records resolution details.
- Register Presence Session: creates or updates an active collaboration presence session for the active workspace.
- Clear Collaboration Sessions: clears collaboration session presence records.
- Reset to Baseline: reapplies the closest preset (Solo or Team) and clears transient operational collaboration data (sessions, pending conflicts, assignment rows, and sync checkpoint timestamp).
- Quick Start Live Collaboration: connects to the live server and starts a live multi-user session with minimal setup.
- Publish Async Snapshot: publishes current workspace collaboration metadata to the server's shared synchronization storage.
- Pull Async Snapshot: requests and applies the latest collaboration metadata snapshot from shared synchronization storage.

Collaboration shutdown and cleanup:

- Disconnect Server to close the current live network connection.
- Clear Collaboration Sessions to remove transient presence records.
- Reset to Baseline to restore a clean Solo or Team baseline.

Permission and assignment actions:

- Permission profile name + permissions + Add Permission Profile: creates or updates a named permission profile.
- Assignment principal/resource type/resource id/permissions + Add Permission Assignment: appends a collaboration permission assignment row used by metadata resolution and summaries.

Status summaries in the Collaboration section:

- Collaboration summary: high-level enabled/provider/mode/toolbar state.
- Preset summary: indicates whether current settings match Solo defaults, Team defaults, or Custom.
- Permissions summary: profile count, assignment count, and compact assignment text.
- Sharing summary: discovery scope, sharing targets, and sharing channels.
- Session summary: active and connected session counts.
- Sync summary: sync mode, conflict strategy, capability notes, version-history state, pending conflict count, and last sync checkpoint.
- Discovery summary: most recent discovery snapshot size.
- Conflict summary: pending conflict queue size.

Recommended defaults:

- Solo workflow (single auditor, local-first):
	- Apply Solo Defaults
	- Collaboration mode: Independent
	- Sync: disabled/manual
	- Conflict strategy: Manual Review
	- Discovery scope: Resource
	- Directory listing: off
	- Guest links: off
	- Default expiry: 30 days
- Team workflow (shared workspace operations):
	- Apply Team Defaults
	- Collaboration mode: Asynchronous
	- Sync: enabled/scheduled
	- Conflict strategy: Metadata Priority
	- Discovery scope: Workspace
	- Directory listing: on
	- Guest links: off by default
	- Default expiry: 14 days

When you apply either preset, the Preset summary updates to Solo or Team. Any meaningful divergence from these baselines is shown as Custom.

Collaboration glossary:

- Discovery snapshot: point-in-time list of resources that are discoverable under current sharing policy.
- Sharing channel: named route used for sharing policy defaults (for example email or workspace channel).
- Presence session: active collaboration presence record tied to a user/resource context.
- Conflict queue: pending synchronization conflicts awaiting resolution.
- Sync checkpoint: timestamp marker for the latest recorded synchronization event.
- Conflict resolution detail: recorded note explaining which strategy was applied and whether metadata mutation occurred.

Use the command Open Collaboration Settings Section to open this settings section directly.

The command is registered in Keyboard Shortcut Manager and is unassigned by default.
Use the commands Toggle Collaboration and Toggle Collaboration Toolbar to change the dashboard collaboration controls without opening Settings.
Additional collaboration operations are also command-enabled and shortcut-assignable: Apply Collaboration Solo Defaults, Apply Collaboration Team Defaults, Reset Collaboration Baseline, Record Collaboration Sync Checkpoint, Generate Collaboration Discovery Snapshot, Queue Collaboration Test Conflict, Resolve Oldest Collaboration Conflict, Register Collaboration Presence Session, Clear Collaboration Sessions, Quick Start Live Collaboration, Connect Live Collaboration Server, Disconnect Live Collaboration Server, Start Live Collaboration Session, Publish Async Collaboration Snapshot, and Pull Async Collaboration Snapshot.
- Performing a new undoable action clears the Redo stack.
- Undo and Redo availability is exposed programmatically and reflected in command enabled state.

## Version History and Restore
- Version History opens a read-only list of versions for the selected or active resource.
- Restoring a version creates a new current version and preserves prior versions.
- Historical versions remain immutable.

## Compare Versions
Compare Versions opens a read-only comparison window that includes:

- difference summary counts
- categorized changes (added, removed, modified)
- previous/next difference navigation
- export comparison to plain text

Comparison presentation is informational and does not modify resources.

## Properties Integration
Project Properties and Resource Properties include History sections with:

- history counts
- version counts
- latest activity summary
- quick actions to open version history, compare versions, and restore previous version

## Explorer and Dashboard Behavior
- Explorer remains focused on current resources and does not add permanent history nodes.
- Dashboard does not add a permanent history panel by default.
