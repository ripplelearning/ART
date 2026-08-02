# Explorer Framework

## Purpose
The Explorer Framework provides an optional, resource-based navigation view for ART.
It complements Dashboard and never replaces Dashboard as the default workspace view.

## Architecture
Explorer consumes existing ART frameworks instead of duplicating logic:

- Application Command Framework
- Universal Search Framework
- Global Context Menu Framework
- Keyboard Shortcut Manager
- Window Title Framework
- Project Workspace Framework
- Dashboard Widget Framework

Explorer state is persisted in shared application state under workspace view configuration.

## Workspace Views
ART supports:

- Dashboard (default)
- Explorer (optional)

Switching uses shared commands:

- Show Dashboard
- Show Explorer
- Toggle Workspace View

Workspace view switching only changes navigation presentation and does not modify report or project data.

## Resource Model
Explorer organizes resources by context:

- Application context: recent reports, workspaces, templates, saved searches, favorites
- Report context: metadata, findings, attachments, standards, configuration, export, properties
- Project workspace context: reports, progress logs, project assets, templates, saved searches, favorites
- Template context: metadata, associated reports, properties, export options
- Search context: contextual search results

Resources expose metadata such as name, type, status, and optional badges.

## Explorer Search
Explorer Search uses the Universal Search Framework and shared state.
Scope adapts automatically:

- `workspace` for application context
- `current-project-workspace` for project workspace context
- `current-report` for report context

Search history and saved searches are shared with Universal Search.

## Accessibility
Explorer implements:

- Navigation landmark labeled Explorer Navigation
- Section regions with visible H3 headings
- Tree semantics with treeitems, levels, selection state, and expansion state
- Keyboard support for arrow navigation, Home/End/Page Up/Page Down, Enter/Space, first-letter navigation, Shift+F10/Applications key
- Focus-safe view switching and selected-resource restoration

## Extensibility
Explorer service APIs support cross-framework integration and deep linking:

- showExplorerView / showDashboardView / toggleWorkspaceView
- revealExplorerResource / selectExplorerResource / openExplorerResource
- expandExplorerResource / collapseExplorerResource / expandExplorerAncestors
- refreshExplorerResource / refreshExplorer
- getSelectedExplorerResource / getExplorerCurrentContext / getExplorerState

Future plugin and integration resource types can register into existing framework flows.

## Developer Guidance
Required patterns:

- Register new resource actions as Application Commands
- Reuse Universal Search providers and shared context menu providers
- Persist Explorer preferences through shared workspace view config

Avoid:

- Duplicating search engines or command handlers
- Implementing standalone menu or shortcut systems
- Bypassing command execution service for resource activation
