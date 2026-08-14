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

## Quick Open and Recent Items

`quickOpenFramework.js` builds on the Search Service rather than adding a second search architecture. It queries a resource-focused subset of providers:

- `reports`
- `report-content`
- `templates`
- `project-workspaces`
- `project-assets`
- `resource-organization`
- `presentation-resources`
- `plugins-packages`

Behavior:

- Opening with an empty query lists recent items, most recent first.
- Recent items are recorded only after a successful open, and store the originating result payload so navigation stays stable.
- Scope resolution, the scope select, and the broaden action match Search Everywhere.
- Screen readers are told that suggestions are available once per query session rather than on every keystroke.
- `Escape` closes Quick Open and restores focus to the invoking control.

Recent items persist under `appState.universalSearch`:

- `recentItems`
- `recentItemsEnabled`
- `maxRecentItems`

Related commands: `quickOpen`, `openRecentItems`, `clearRecentItems`. All three are registered in the Keyboard Shortcut Manager with no default assignment.

## Favorites and Bookmarks

Favorites and bookmarks are distinct concepts that share the Quick Open surface and the search navigation model.

- A favorite references a resource (`favorites`).
- A bookmark references a location within a resource (`bookmarks`).

Both persist under `appState.universalSearch` and store the originating navigation payload, so activation reuses `executeUniversalSearchResult`. Renaming a resource does not invalidate them because payloads use stable identifiers rather than display names.

`captureCurrentLocation(sourceElement)` builds a navigation payload for the user's current position. It prefers the element focused before a command surface opened, and resolves to one of:

| Location | Payload type |
| --- | --- |
| Editor entry field | `finding` |
| Builder field row | `report-field` |
| Any active view | `panel` |

Quick Open modes: `quick-open`, `recent`, `favorites`, `bookmarks`. Favorites receive a small ranking boost in Quick Open search results and are labeled as favorites, but ranking never overrides a stronger match.

Related commands: `addToFavorites`, `removeFromFavorites`, `openFavorites`, `addBookmark`, `openBookmarks`, `clearBookmarks`. All are registered with no default shortcut.

## Navigation History and Breadcrumbs

`navigationHistoryFramework.js` provides one centralized history service for the application.

- Entries store a navigation payload, so restoring a location reuses `executeUniversalSearchResult`.
- `universalSearchFramework.js` dispatches `art-navigation-performed` after a successful navigation instead of importing the history service, which avoids an import cycle.
- Panel changes are captured from the existing `art-panel-changed` event.
- Consecutive duplicate locations refresh the current entry rather than adding a step.
- Navigating after going back truncates the forward branch, matching browser behavior.
- `restoringNavigation` guards Back, Forward, and history jumps so replaying a location is not recorded as a new one.
- Command availability is published through `art-navigation-availability-changed`; the `navigateBack` and `navigateForward` commands report enablement via `canNavigateBack()` and `canNavigateForward()`.

Breadcrumbs render into the `#breadcrumb-nav` landmark in `index.html`. The trail is Workspace, Report, View, then the specific location. The current item uses `aria-current="page"`; ancestors are buttons that navigate using the same payload model.

State persists under `appState.navigationHistory`:

- `enabled`
- `breadcrumbsEnabled`
- `maxEntries`
- `entries`
- `currentIndex`

Related commands: `navigateBack`, `navigateForward`, `openNavigationHistory`, `clearNavigationHistory`. All are registered with no default shortcut. Clearing navigation history does not affect favorites, bookmarks, recent items, or saved searches.

## Settings

Application Settings includes a `Search` section with:

- Default Search Scope (`scopePreference`)
- Save search history on this device (`historyEnabled`)
- Save recently opened items on this device (`recentItemsEnabled`)
- Maximum Recent Items (`maxRecentItems`)
- Clear Search History
- Clear Recent Items
- Save navigation history on this device (`navigationHistory.enabled`)
- Show breadcrumbs (`navigationHistory.breadcrumbsEnabled`)
- Maximum Navigation History Entries (`navigationHistory.maxEntries`)
- Clear Navigation History

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
