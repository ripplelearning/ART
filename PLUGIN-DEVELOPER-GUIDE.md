# Plugin Developer Guide

## Architecture
ART plugins register capabilities through Plugin Framework extension points. They do not directly modify framework implementations.

## Required Manifest Fields
Plugin manifests must include:

- pluginId
- displayName
- description
- version
- author
- publisher
- license
- supportedArtVersion
- capabilities

Optional fields:

- minimumPluginFrameworkVersion
- pluginDependencies (string entries or object entries with pluginId, version, optional)
- requiredPermissions

## Extension Points
Supported extension points include:

- commands
- searchProviders
- resourceTypes
- reportTypes
- importProviders
- exportProviders
- dashboardCards
- explorerNodes
- contextMenuCommands
- keyboardShortcuts (registered as unassigned by default)
- workingViewProviders
- validationRules
- accessibility standards and standards extensions
- AI/integration providers

## Lifecycle
Plugins participate in:

- discovery
- validation
- registration
- load/initialize
- enable/disable
- update/uninstall

Dependency-aware lifecycle notes:

- required dependencies must be installed, enabled, and version-compatible before enable.
- disable/uninstall can be blocked while enabled dependent plugins exist.

## Accessibility Requirements
Plugin UI and interactions must:

- be keyboard operable
- provide accessible names/descriptions
- preserve focus behavior
- use semantic HTML/native controls where possible
- integrate with ART status announcements

## Best Practices
- Use existing ART frameworks and commands.
- Keep plugin scope focused.
- Avoid assigning default keyboard shortcuts unless explicitly requested.
- Treat failures as isolated; do not block startup.
- Keep permission declarations minimal and explicit.
- Keep dependency declarations accurate and stable across updates.

## Configuration Portability
Plugin and package configuration can be exported/imported from Plugin & Package Manager.
Use stable plugin and package identifiers to support safe configuration migration.

## Example Manifest
```json
{
  "pluginId": "org.example.sample-plugin",
  "displayName": "Sample Plugin",
  "description": "Registers a sample provider.",
  "version": "1.0.0",
  "author": "Example Team",
  "publisher": "Example Org",
  "license": "MIT",
  "supportedArtVersion": "1.5",
  "requiredPermissions": ["registerCommands", "registerSearchProviders"],
  "capabilities": {
    "commands": [],
    "searchProviders": []
  }
}
```
