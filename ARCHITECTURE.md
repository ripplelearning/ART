# ART Architecture

## Overview

ART 2.0 introduces a centralized Application Command Framework.
The framework standardizes how user actions are defined, resolved, and executed.
ART 2.0 also introduces a Dashboard Widget Framework that renders Dashboard as a configurable workspace composed of independent widgets.
ART 2.0 now also introduces a Project Workspace Framework that provides project-level lifecycle, storage, resource management, workspace restoration, and extensibility points.
ART 2.0 now also introduces a Universal Search Framework that standardizes provider search, result aggregation, and search UI behavior.
ART 2.0 now also introduces a Global Context Menu Framework that generates context-sensitive menus from context providers and registered commands.

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
- Workspace relationships are modeled in a normalized structure suitable for future integration and plugin extension.

## Validation Architecture

- Project workspace validation currently checks required project identity, resource structure availability, and duplicate relationship edges.
- Validation publishes workspace validation events for observability and future UI integration.

## Extensibility Points

- Workspace events are emitted through shared custom events and namespaced event channels.
- Workspace resources support extension metadata for future plugin resource types.
- Integration metadata and plugin metadata are persisted at workspace scope.
- Command registration supports future provider commands without architectural redesign.

## UI Integration

- Dashboard actions resolve through commands.
- Builder actions resolve through commands.
- Editor actions resolve through commands.
- Settings actions resolve through commands.
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
- Accessibility behavior: [menuBar.js](menuBar.js) and [commandPalette.js](commandPalette.js)
- Keyboard interaction and workspace shortcut tooltip synchronization: [navigation.js](navigation.js) and [menuBar.js](menuBar.js)
- Command execution: [commandExecutionService.js](commandExecutionService.js)
- Global context menu framework: [globalContextMenuFramework.js](globalContextMenuFramework.js)
