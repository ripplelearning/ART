# Global Context Menu Framework

ART 2.0 uses a reusable Global Context Menu Framework to generate context-sensitive menus from the same Application Command Framework used by the rest of the application.

## Overview

The framework is responsible for:

- Determining the current application context.
- Resolving the active selection and keyboard focus.
- Retrieving registered commands.
- Filtering commands by context, visibility, and enabled state.
- Organizing commands into logical groups and submenus.
- Rendering a single accessible context menu UI.
- Executing commands through the centralized command execution service.
- Preserving and restoring focus when menus close.

The framework is implementation-independent and can be reused by future plugins, integrations, and desktop editions.

## Primary Source Files

- Global context menu framework: [globalContextMenuFramework.js](globalContextMenuFramework.js)
- Command registration and menu metadata: [commandCatalog.js](commandCatalog.js)
- Command registry and metadata normalization: [commandRegistry.js](commandRegistry.js)
- Command execution service: [commandExecutionService.js](commandExecutionService.js)
- Shared command shortcuts and application state: [state.js](state.js)
- Startup wiring: [loader.js](loader.js)

## Context Providers

Context providers determine which commands are relevant for the current context.

Built-in contexts include:

- Dashboard
- Dashboard Widget
- Project Workspace
- Project Asset
- Report Builder
- Field Configuration
- Editor
- Report Viewer
- Progress Log
- Accessibility Lookup Tool
- Search Results
- Help
- User Guide
- Welcome Screen
- Application Settings
- Menu Bar
- Command Palette

Providers may contribute:

- Provider name and description.
- Supported contexts.
- Supported selection types.
- Supported command groups.
- Supported submenus.
- Supported commands.
- Metadata for future integrations.

## Command Generation

Context menus are generated from registered commands rather than hard-coded menu items.

Command organization is driven by:

- Current context.
- Current selection.
- Current focus.
- Current application state.
- Command visibility.
- Command enabled state.
- Command metadata such as menu location and category.

Commands are executed only through the Application Command Framework.

## Command Groups and Submenus

Commands are arranged into groups and nested submenus automatically.

The framework prevents:

- Empty groups.
- Duplicate separators.
- Duplicate menu items.
- Duplicate context menu implementations.
- Circular submenu relationships.

Standard group ordering favors predictable menu placement across ART.

## Embedded Search Commands

Each context menu includes an embedded Search Commands field at the bottom of the menu.

The search field:

- Filters only the commands available in the current menu.
- Uses the shared command search infrastructure.
- Preserves shortcut metadata.
- Keeps the menu accessible while filtering.

Escape clears the search when text is present. Pressing Escape again closes the menu.

## Interaction Model

The framework supports the common menu invocation methods used by ART:

- Mouse right-click.
- Shift+F10.
- Applications/Menu key.
- Touch and hold.
- Keyboard-only interaction.
- Screen reader menu commands.
- Braille display commands.

Menu navigation is consistent and supports:

- Up and Down Arrow.
- Left and Right Arrow.
- Home and End.
- Enter and Space.
- Type-ahead navigation.
- Escape to dismiss.

The framework preserves focus when a menu closes.

## Accessibility

The menu uses standard ARIA menu semantics and is designed to remain compatible with:

- JAWS.
- NVDA.
- VoiceOver.
- TalkBack.
- Braille displays.
- Voice navigation.
- Speech dictation.
- Switch devices.
- High contrast themes.
- Reduced motion.
- ART personalization settings.

Menu items expose descriptive accessible names and current shortcut assignments when available.

## Extensibility

Future plugins and integrations can register additional context providers and contribute commands without creating a separate menu framework.

The intended extension points are:

- RegisterContextProvider
- UnregisterContextProvider
- ShowContextMenu
- DismissContextMenu
- RefreshContextMenu
- GetCurrentContext

## Notes

The framework intentionally consumes the shared command registry and command execution service so context menus remain synchronized with application commands, shortcut assignments, and future command sources.