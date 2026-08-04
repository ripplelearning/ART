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
- Keyboard Shortcut Manager
- Working View Framework
- Dashboard Framework

After those workflows complete, ART registers package/plugin metadata through the Plugin Framework.

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

Explorer relationship nodes are virtual. They do not create duplicate resources.

## Resource Properties and Impact Analysis
Supported resources expose relationship details through Resource Properties.

Resource Properties includes:

- Overview
- Relationships
- relationship search within the current dialog
- impact analysis counts
- copy commands for name, path, and relationship details

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

## Metadata Portability and Integrity
Resource organization metadata can be exported/imported independently and is also included in Project Workspace portability payloads.

ART reconciles unresolved organization references and preserves organization integrity when reports and templates are replaced.
