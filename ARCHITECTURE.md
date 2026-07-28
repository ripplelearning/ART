# ART Architecture

## Overview

ART 2.0 introduces a centralized Application Command Framework.
The framework standardizes how user actions are defined, resolved, and executed.
ART 2.0 also introduces a Dashboard Widget Framework that renders Dashboard as a configurable workspace composed of independent widgets.

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
- Dashboard command registration and menu placement: [commandCatalog.js](commandCatalog.js)
- Dashboard search indexing and ranking: [commandSearchEngine.js](commandSearchEngine.js)
- Dashboard persistence and shortcut ownership: [state.js](state.js)
- Dashboard layouts and widget UI styles: [style.css](style.css)
- Dashboard shell and action controls: [index.html](index.html)
- Menu rendering: [menuBar.js](menuBar.js)
- Menu navigation: [menuBar.js](menuBar.js)
- Command search: [commandSearchEngine.js](commandSearchEngine.js)
- Dynamic menu generation: [commandCatalog.js](commandCatalog.js) and [menuBar.js](menuBar.js)
- Accessibility behavior: [menuBar.js](menuBar.js) and [commandPalette.js](commandPalette.js)
- Keyboard interaction: [navigation.js](navigation.js) and [menuBar.js](menuBar.js)
- Command execution: [commandExecutionService.js](commandExecutionService.js)
