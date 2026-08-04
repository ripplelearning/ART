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
- relationshipProviders
- relationshipValidators
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
- historyProviders
- versionProviders
- comparisonProviders
- transactionParticipants
- recoveryHandlers
- historyEventSubscribers
- tagProviders
- collectionProviders
- savedViewProviders
- organizationValidators
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
- Register relationships through the Resource Relationship Framework instead of storing duplicate relationship state in plugin-owned structures.
- Keep plugin scope focused.
- Avoid assigning default keyboard shortcuts unless explicitly requested.
- Treat failures as isolated; do not block startup.
- Keep permission declarations minimal and explicit.
- Keep dependency declarations accurate and stable across updates.

## Relationship Providers and Validators
Relationship providers may contribute computed or organization-specific relationships.

Relationship validators may contribute additional rules such as:

- dependency constraints
- organization policy checks
- compatibility checks between resource types

Provider and validator guidance:

- return normalized resource relationship records
- prefer computed relationships over copying existing resource data
- keep validation side-effect free
- publish diagnostics through framework failures rather than direct UI changes

## Resource Organization Providers and Validators
ART Version 1.5 includes a Resource Organization Framework with provider and validator extension points.

Supported organization extension points:

- tagProviders
- collectionProviders
- savedViewProviders
- organizationValidators

Guidance:

- treat ART state as authoritative for persisted organization metadata
- prefer additive metadata contributions over direct mutation of existing resources
- keep validators side-effect free and diagnostics-focused
- ensure provider records normalize to ART organization metadata shape

## Organization Metadata Packages
Plugin package registration now supports `organization-metadata` package type.

Use this package type for non-executable organization presets or migrations that should be tracked through Plugin & Package Manager metadata.

## History, Versioning, and Recovery Integration
ART includes a centralized History, Undo/Redo, and Versioning Framework.

Plugins must consume this framework and must not implement independent history or undo stacks.

Supported integration responsibilities:

- publish history entries through framework service boundaries
- contribute version providers for plugin-owned resources
- contribute comparison providers for semantic diff support
- register transaction participants for grouped operations
- register recovery handlers for rollback-safe failure behavior
- subscribe to history framework events for diagnostics or UI refresh

History integration guidance:

- use transaction descriptions that reflect user intent
- keep rollback logic atomic and side-effect aware
- return structured, accessible comparison metadata
- avoid direct mutation from event subscribers

## History Metadata Packages
Plugin package registration supports `history-metadata` package type for non-executable history/version presets or migration artifacts.

Example capability shape:
```json
{
  "pluginId": "org.example.relationships",
  "displayName": "Sample Relationship Provider",
  "description": "Adds computed relationships.",
  "version": "1.0.0",
  "author": "Example Team",
  "publisher": "Example Org",
  "license": "MIT",
  "supportedArtVersion": "1.5",
  "capabilities": {
    "relationshipProviders": [
      {
        "id": "org.example.provider"
      }
    ],
    "relationshipValidators": [
      {
        "id": "org.example.validator"
      }
    ]
  }
}
```

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
