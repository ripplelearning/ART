# ART Architecture

## Overview

ART 2.0 introduces a centralized Application Command Framework.
The framework standardizes how user actions are defined, resolved, and executed.

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

## UI Integration

- Dashboard actions resolve through commands.
- Builder actions resolve through commands.
- Editor actions resolve through commands.
- Settings actions resolve through commands.
- Lookup actions resolve through commands.
- Keyboard shortcuts resolve through commands.
- The Command Palette resolves through the same centralized command framework.
- Visual accessibility settings are centralized in the Theme Engine and applied globally.

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
- Provide a foundation for future appearance profiles and desktop-friendly personalization.
