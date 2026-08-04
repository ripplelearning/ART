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
