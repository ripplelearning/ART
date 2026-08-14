# ART Universal Search Framework

## Overview

ART 2.0 Universal Search Framework provides one centralized search architecture for commands, reports, report fields and findings, templates, workspaces, project assets, keyboard shortcuts, help topics, dashboard widgets, accessibility standards and WCAG Success Criteria, presentation resources, saved searches, plugins, and packages.

The framework consists of:

- Provider registry with capability advertising.
- Query parser and normalization pipeline.
- Result aggregation and scoring.
- Location-aware scope resolution.
- Shared search session state and persistence.
- Shared search results rendering and keyboard interaction model.

## Core Modules

- `universalSearchFramework.js`
- `searchResultsFramework.js`
- `state.js` (search settings/session/history persistence)

## Provider Model

Each provider declares:

- `id`
- `name`
- `priority`
- `capabilities.scopes`
- `capabilities.itemTypes`
- `capabilities.supportsFieldSearch`
- `capabilities.supportsBoolean`
- `capabilities.supportsWildcard`
- `capabilities.supportsPhrase`
- `capabilities.advertisedFields`
- `search(context)`

Built-in providers:

- `commands`
- `report-content` (report fields and finding values in the current report)
- `reports`
- `templates`
- `resource-relationships`
- `resource-organization`
- `accessibility-standards` (imported standards plus the full WCAG catalog with conformance levels)
- `presentation-resources` (layouts, themes, branding, publishing profiles)
- `shortcuts`
- `project-workspaces`
- `project-assets`
- `help-topics`
- `saved-searches`
- `dashboard-widgets`
- `plugins-packages` (registered by `pluginFramework.js`)

Plugins and packages register additional providers through the `searchProviders` extension point, which calls `registerUniversalSearchProvider`.

## Search Scope

Scope resolution is location aware. When a scope of `auto` is requested, the framework resolves it in this order:

1. An explicit user preference in `appState.universalSearch.scopePreference`.
2. `current-report` when the active report has fields or finding values.
3. `current-project-workspace` when a Project Workspace is open.
4. `workspace` (all ART content).

Search Everywhere exposes the resolved scope in a `Search scope` select. Changing it announces the new scope and re-runs the query. The scope and per-category result counts are reported in the dialog status live region.

When a query returns no results in a narrower scope, a `Search all ART content instead` button is shown. Scope is never broadened automatically.

`getUniversalSearchScopeOptions()` and `getUniversalSearchScopeLabel(scope)` expose the available scopes and their display labels.

## Result Navigation

`executeUniversalSearchResult(result)` closes the dialog and then moves focus to the exact destination:

| Result type | Destination |
| --- | --- |
| `command` | Executes the shared command |
| `report` | Loads the report |
| `report-field` | Report Builder, focused on that field's Edit button |
| `finding` | Report Editor, focused on `editor-field-{entry}-{field}` |
| `template` | Template selection |
| `criterion` | Accessibility Lookup Tool, filtered to the criterion |
| `shortcut` | Application Settings, focused on that shortcut's Change button |
| `presentation-*` | Report Builder presentation options |
| `saved-search` | Reopens Search Everywhere with the saved query and scope |
| `asset` | Revealed in the workspace explorer |

## Query Features

Supported syntax includes:

- Phrase terms using quotes (example: `"project workspace"`)
- Include terms with `+`
- Exclude terms with `-`
- Wildcards using `*` and `?`

## Search Surfaces

The same search-results interaction model is used by:

- Search Everywhere dialog (`Ctrl+K` by default)
- Command Palette
- Menu Bar Command Search
- Dashboard Search widget

## State and Persistence

Universal search state persists under `appState.universalSearch`:

- `scopePreference`
- `historyEnabled`
- `history`
- `savedSearches`
- `collections`
- `activeSession`
- `indexStatus`

Providers read live application state on each query, so renamed, added, and deleted content is reflected without a manual reindex.

## Settings

Application Settings includes a `Search` section with:

- Default Search Scope (`scopePreference`)
- Save search history on this device (`historyEnabled`)
- Clear Search History

When search history is disabled, `recordUniversalSearchHistory()` does not store queries.

## Commands

Key search actions include:

- `searchEverywhere`
- `searchCurrentReport`
- `searchCurrentProjectWorkspace`
- `searchAllProjects`
- `searchAccessibilityStandards`
- `searchHelpDocumentation`
- `searchCommands`
- `searchKeyboardShortcuts`
- `searchProjectAssets`
- `searchTemplates`
- `searchDashboard`
- `findInCurrentResource`
- `findNextMatch`
- `findPreviousMatch`
- `nextSearchResult`
- `previousSearchResult`
- `clearSearchHighlights`
- `clearSearchHistory`
- `saveCurrentSearch`
- `openSavedSearches`

## Accessibility Notes

- Search lists use `role="listbox"` with option semantics.
- Status updates use live regions.
- Keyboard navigation supports Arrow keys, Home/End, Page Up/Page Down, Enter, and Escape in dialog contexts.
- Shortcut tooltips are synchronized through the existing shortcut binding system.
- The scope select has a visible label, and scope changes are announced once.
- The result status reports the active scope, total count, and per-category counts without announcing individual results as the user types.
- Activating a result closes the dialog before navigating, so focus lands on the destination rather than the dialog.
- Escape returns focus to the control that opened Search Everywhere.
- Search failures preserve the query and scope and report that the search can be retried.
