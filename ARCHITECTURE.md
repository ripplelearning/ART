# ART Architecture

## Overview

ART 2.0 introduces a centralized Application Command Framework.
The framework standardizes how user actions are defined, resolved, and executed.
ART 2.0 also introduces a Dashboard Widget Framework that renders Dashboard as a configurable workspace composed of independent widgets.
ART 2.0 now also introduces a Project Workspace Framework that provides project-level lifecycle, storage, resource management, workspace restoration, and extensibility points.
ART 2.0 now also introduces a Universal Search Framework that standardizes provider search, result aggregation, and search UI behavior.
ART 2.0 now also introduces a Global Context Menu Framework that generates context-sensitive menus from context providers and registered commands.
ART Version 1.5 now also introduces a Plugin Framework that provides centralized lifecycle management and extension-point registration for plugins and packages.
ART Version 1.5 now also introduces a Resource Relationship Framework that centralizes relationship registration, derivation, validation, navigation, and impact analysis across workspace resources.
ART Version 1.5 now also introduces a Resource Organization Framework that centralizes non-destructive tags, collections, saved views, favorites, and metadata portability for workspace resources.
ART Version 1.5 now also introduces a History, Undo/Redo, and Resource Versioning Framework that centralizes change tracking, transaction grouping, undo/redo, version history, restore, and comparison operations.
ART Version 1.5 now also introduces a Collaboration Framework that centralizes provider capability mapping, collaboration metadata, session tracking, conflict handling, discovery snapshots, and live/asynchronous synchronization commands.
ART Version 1.5 now also introduces an optional Collaboration Server coordination layer for multi-user live sessions and asynchronous shared-folder synchronization.

## Core Layers

### Command Registry
- Stores command metadata.
- Prevents duplicate registration.
- Supports lookup by command id, action, and metadata.

### Command Execution Service
- Validates command availability.
- Applies preconditions and hooks.
- Normalizes results.
- Prevents recursive command loops.

### Command Catalog
- Registers the app's commands.
- Connects command names to existing ART workflows.
- Reuses existing business logic where practical.

### Theme Engine
- Stores the application-wide visual accessibility state.
- Applies theme, zoom, font size, density, focus, motion, and border preferences to the document.
- Supports live preview from Application Settings.
- Provides a foundation for future named appearance profiles.

### Command Palette
- Reads command metadata from the Command Registry.
- Reads current shortcut assignments from the Keyboard Shortcut Manager.
- Searches and filters registered commands without storing its own command definitions.
- Executes selected commands through the Command Execution Service.

### Menu Bar
- Renders commands from the Command Registry using menu-path metadata.
- Uses the shared command search engine for inline command search.
- Displays current shortcut assignments dynamically.
- Executes commands through the Command Execution Service.

### Dashboard Widget Framework
- Stores widget metadata in a widget registry and renders widgets dynamically.
- Supports cards, tabs, and compact dashboard layouts.
- Persists dashboard layout, widget order, visibility, tab assignments, custom widgets, and collapsed states.
- Exposes a Configure Dashboard dialog for user personalization.
- Reuses command execution through the centralized Application Command Framework.

### Project Workspace Framework
- Provides a centralized project management layer for ART resources.
- Stores one active workspace at a time while preserving a multi-workspace-ready internal architecture.
- Registers workspace lifecycle, asset, and project intelligence commands through the command framework.
- Persists workspace metadata, workspace state, resource metadata, and relationships through the shared state layer.
- Supports portable folder-based workspace persistence with Project.artproj as the authoritative descriptor.
- Publishes workspace events for open, close, save, restore, validation, relationship, and asset activity.

### Universal Search Framework
- Registers search providers with capability advertising for scope support, resource types, searchable fields, and query capabilities.
- Parses and normalizes query syntax across phrase, wildcard, include/exclude, and general term searching.
- Aggregates and ranks provider results into a single search session model.
- Persists search scope preference, active sessions, search history, and saved searches in shared state.
- Reuses a single Search Results Framework component for Search Everywhere, Command Palette, Menu Bar Command Search, and Dashboard Search.

### Global Context Menu Framework
- Resolves the current application context from focus, selection, and workspace state.
- Registers context providers that determine which commands are relevant for the current context.
- Builds dynamic command trees from registered commands and menu metadata.
- Executes menu items through the centralized Application Command Framework.
- Supports embedded command search, keyboard navigation, focus restoration, and accessibility announcements.
- Provides a reusable basis for future plugin and integration context menus.

### Plugin Framework
- Discovers built-in and external plugins and validates metadata, version compatibility, and registration rules.
- Manages plugin lifecycle: discover, validate, install/register, load/initialize, enable/disable, update, unload, and uninstall.
- Registers extension capabilities through approved extension points rather than direct framework modification.
- Tracks non-executable packages registered after existing ART workflows complete.
- Exposes diagnostics and validation through the Settings-based Plugin & Package Manager.

### Collaboration Framework
- Centralizes collaboration provider registration and provider capability normalization.
- Persists collaboration state and policies (mode, sharing, synchronization, live connection settings, sessions, and conflict queue) in the shared state layer.
- Provides presence and live session lifecycle APIs.
- Provides conflict queueing and strategy-based conflict resolution.
- Provides discovery snapshot generation and resource-level collaboration metadata updates.
- Provides live server connect/disconnect/session APIs and asynchronous snapshot publish/pull APIs.

### Collaboration Server Layer (Optional)
- Hosts WebSocket collaboration coordination for live session signaling and synchronization actions.
- Supports optional token-gated handshake validation for controlled access.
- Stores and serves asynchronous collaboration snapshots for cross-user pull workflows.
- Supports optional shared-folder persistence for snapshots so asynchronous collaboration can use shared network storage.
- Exposes health and snapshot HTTP endpoints for diagnostics and automation.

### Resource Relationship Framework
- Uses the existing workspace relationship state as the authoritative persisted relationship store.
- Derives additional relationships from current workspace resources instead of duplicating resource ownership.
- Normalizes relationship types into shared categories including Contains, Uses, References, Depends On, Shared With, and Generated From.
- Exposes query helpers for Explorer, Properties, deletion analysis, validation, and Universal Search.
- Publishes relationship events and supports provider and validator extension points through the Plugin Framework.
- Reconciles workspace relationship integrity automatically after report, template, and accessibility standard update events.

### Resource Organization Framework
- Uses workspace-scoped metadata to organize resources without changing report, template, or asset payloads.
- Stores and normalizes tags, collections, and saved views in shared state so all ART surfaces resolve the same organization model.
- Supports favorites and recent history for tags, collections, and saved views.
- Exposes command-oriented APIs for create, edit, duplicate, merge, assign, remove, open, delete, import, and export workflows.
- Integrates with Universal Search through structured organization queries and provider-backed result execution.
- Reconciles unresolved resource references and supports lifecycle-safe replacement/removal updates.

### History, Undo/Redo, and Resource Versioning Framework
- Provides the single authoritative history service for recording change entries, query/filter/search, and clear operations.
- Provides centralized undo and redo stacks with transaction-based execution and desktop-style redo clearing on new operations.
- Provides resource version history for versionable resources with restore that creates new current versions.
- Provides comparison services with semantic-friendly difference summaries and read-only diff navigation.
- Provides transaction and recovery services for grouped and nested operations with rollback-safe behavior.
- Persists history/version metadata locally and applies retention policies without requiring cloud services.
- Integrates with existing command, menu, context menu, properties, and plugin extension frameworks.

## Project Workspace Lifecycle

Lifecycle commands are command-driven and include:

1. Create Project Workspace
2. Open Project Workspace
3. Open Recent Project Workspace
4. Close Project Workspace
5. Save Project Workspace
6. Save Project Workspace As
7. Rename Project Workspace
8. Duplicate Project Workspace
9. Import Project Workspace
10. Export Project Workspace
11. Delete Project Workspace

## Workspace Persistence and Restoration

- Workspace state captures open report ids, active report id, dashboard configuration, resource navigator state, and related context needed for resume workflows.
- Continue Working restores the most recent workspace and rehydrates workspace-level state where practical.
- Workspace statistics and health are recalculated whenever workspace resources change.

## Workspace Storage and Portability

- Workspace save operations create and maintain a portable folder structure.
- Project.artproj stores metadata, relationships, workspace state, integration/plugin metadata, and an ART project payload for report/template restoration.
- ART uses user-selected destinations for workspace save and export operations.
- Relative workspace paths are used for project asset metadata whenever practical.

Standard workspace folders:

- Reports
- Audit Logs
- Progress Logs
- Templates
- Project Assets (Planning, Requirements, Timeline, Documentation, Credentials, Designs, Meeting Notes, Images, Other)
- Attachments
- Exports
- Backups
- .art

## Resource Management and Relationships

- Project Assets are tracked as first-class workspace resources.
- Asset metadata includes filename, category, tags, linked report ids, linked finding ids, timestamps, and relative paths.
- Workspace relationships are modeled in a normalized structure and consumed through the Resource Relationship Framework rather than ad hoc UI logic.
- Derived relationships are computed from existing workspace resources and report metadata so ART can answer usage and impact questions without changing existing resource file formats.
- Explorer renders virtual relationship nodes lazily beneath supported resources while preserving the underlying resource hierarchy.
- Universal Search registers a relationship-aware provider that returns resources together with the relationship category that matched the query.
- Project and resource properties dialogs consume shared relationship summaries and impact analysis instead of maintaining their own relationship model.

## Validation Architecture

- Project workspace validation currently checks required project identity, resource structure availability, and duplicate relationship edges.
- Relationship validation also checks registered relationship types, missing source or target resources, duplicate relationships, and self-referential containment.
- Validation publishes workspace validation events for observability and future UI integration.

## Extensibility Points

- Workspace events are emitted through shared custom events and namespaced event channels.
- Workspace resources support extension metadata for future plugin resource types.
- Integration metadata and plugin metadata are persisted at workspace scope.
- Command registration supports future provider commands without architectural redesign.
- Plugin extension points include commands, search providers, relationship providers, relationship validators, resource types, dashboard providers, explorer providers, context menu providers, working view providers, validation providers, and integration providers.
- Plugin extension points include history providers, version providers, comparison providers, transaction participants, recovery handlers, and history event subscribers.
- Plugin extension points include organization metadata providers and validators (tag providers, collection providers, saved view providers, organization validators).
- Package extension points include accessibility standards, templates, keyboard profiles, working view presets, saved searches, dashboard layouts, organization metadata, history metadata, and future package categories.
- Collaboration provider extension points support additional live-capability providers and provider-specific metadata/synchronization contracts.

## UI Integration

- Dashboard actions resolve through commands.
- Builder actions resolve through commands.
- Editor actions resolve through commands.
- Settings actions resolve through commands.
- Collaboration quick-start and asynchronous publish/pull operations resolve through commands.
- Lookup actions resolve through commands.
- Keyboard shortcuts resolve through commands.
- The Command Palette resolves through the same centralized command framework.
- The Menu Bar and Menu Bar Command Search resolve through the same centralized command framework.
- Visual accessibility settings are centralized in the Theme Engine and applied globally.
- Dashboard widgets expose commands through the same centralized command framework.
- Search Everywhere, Menu Bar Command Search, Command Palette, and Dashboard Search share a reusable search results interaction model.

## Execution Pattern

1. A user activates a button, shortcut, or similar control.
2. The control resolves to a command action.
3. The command registry provides the command definition.
4. The execution service runs the command handler.
5. The command handler reuses existing ART workflows or business logic.

## Shortcut Ownership

- The Keyboard Shortcut Manager remains the single source of truth for shortcut assignments.
- The Command Palette and Help pages read shortcut values dynamically.
- Changing a shortcut in Settings updates the displayed shortcut everywhere that the application exposes it.

## Design Goals

- Preserve existing behavior.
- Avoid duplicate logic.
- Keep user workflows stable.
- Provide a foundation for future menu, palette, and automation features.
- Provide a foundation for future menu, search, and automation features.
- Provide a foundation for future appearance profiles and desktop-friendly personalization.
- Provide a foundation for future plugin, integration, and analytics dashboard widgets.

## Primary Source Files

- Dashboard widget registration and rendering: [dashboardWidgetFramework.js](dashboardWidgetFramework.js)
- Dashboard widget integration and built-in widgets: [dashboard.js](dashboard.js)
- Project Workspace orchestration, storage/export/import logic, Resource Navigator, and properties/export dialogs: [projectWorkspaceFramework.js](projectWorkspaceFramework.js)
- Dashboard command registration and menu placement: [commandCatalog.js](commandCatalog.js)
- Dashboard search indexing and ranking: [commandSearchEngine.js](commandSearchEngine.js)
- Dashboard and Project Workspace persistence, shortcut ownership, statistics, health, relationships, and event state: [state.js](state.js)
- Dashboard layouts and widget UI styles: [style.css](style.css)
- Dashboard shell, action controls, and Resource Navigator host: [index.html](index.html)
- Menu rendering: [menuBar.js](menuBar.js)
- Menu navigation: [menuBar.js](menuBar.js)
- Command search: [commandSearchEngine.js](commandSearchEngine.js)
- Dynamic menu generation and workspace command placement: [commandCatalog.js](commandCatalog.js) and [menuBar.js](menuBar.js)
- Universal search provider registry, query parsing, session state, and Search Everywhere dialog: [universalSearchFramework.js](universalSearchFramework.js)
- Shared search results rendering and keyboard interaction controller: [searchResultsFramework.js](searchResultsFramework.js)
- Plugin lifecycle, extension-point registry, package registration, and extension diagnostics: [pluginFramework.js](pluginFramework.js)
- Collaboration providers, sessions, conflicts, discovery, live connect/disconnect, and async snapshot publish/pull: [collaborationFramework.js](collaborationFramework.js)
- Optional network coordination server for live and asynchronous collaboration: [collaboration-server/server.js](collaboration-server/server.js)
- Resource relationship derivation, relationship queries, deletion analysis, search indexing, diagnostics, and plugin relationship extensions: [resourceRelationshipFramework.js](resourceRelationshipFramework.js)
- Resource organization metadata services, command workflows, explorer helpers, saved-view bridge APIs, and metadata portability: [resourceOrganizationFramework.js](resourceOrganizationFramework.js)
- History services, undo/redo stacks, transactions, recovery, version history, and compare/restore dialogs: [historyFramework.js](historyFramework.js)
- Accessibility behavior: [menuBar.js](menuBar.js) and [commandPalette.js](commandPalette.js)
- Keyboard interaction and workspace shortcut tooltip synchronization: [navigation.js](navigation.js) and [menuBar.js](menuBar.js)
- Command execution: [commandExecutionService.js](commandExecutionService.js)
- Global context menu framework: [globalContextMenuFramework.js](globalContextMenuFramework.js)
