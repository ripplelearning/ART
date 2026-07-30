# ART Universal Search Framework

## Overview

ART 2.0 Universal Search Framework provides one centralized search architecture for commands, reports, templates, workspaces, project assets, keyboard shortcuts, help topics, dashboard widgets, and imported accessibility standards.

The framework consists of:

- Provider registry with capability advertising.
- Query parser and normalization pipeline.
- Result aggregation and scoring.
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
- `reports`
- `templates`
- `accessibility-standards`
- `shortcuts`
- `project-workspaces`
- `project-assets`
- `help-topics`
- `dashboard-widgets`

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
- `history`
- `savedSearches`
- `collections`
- `activeSession`
- `indexStatus`

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
