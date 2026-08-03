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
