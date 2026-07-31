# ART (the Accessibility Reporting Tool) Version 1.0

ART is an accessibility-first reporting workspace for documenting accessibility findings, managing standards-based criteria, and exporting reports.

## Command Framework
ART 2.0 introduces a centralized Application Command Framework that routes user actions through reusable commands instead of duplicated UI logic.
The Command Palette provides keyboard-first access to those commands and opens with Ctrl+Shift+P.
The Menu Bar provides a familiar menu structure, and Menu Bar Command Search opens with Alt+Q.

Shortcut changes made in Application Settings are reflected throughout ART, including the Command Palette and other shortcut displays.

## Visual Accessibility
ART 2.0 also introduces a centralized Theme Engine for visual accessibility and personalization.
It supports built-in themes, zoom, font size, interface density, enhanced focus indicators, reduced motion, border visibility, live preview, and future appearance profiles.

Visual settings are managed from Application Settings and are applied consistently throughout ART.

## Dashboard Widget Framework
ART 2.0 now includes a dashboard widget framework that turns Dashboard into a configurable workspace.
Widgets are dynamically registered and rendered as independent regions with level 3 heading toggles for expand/collapse state.

Current capabilities include:

- Dashboard Cards, Dashboard Tabs, and Compact Dashboard layouts.
- Configure Dashboard dialog for layout changes, widget visibility, widget ordering, and tab assignment.
- Built-in widgets for Quick Actions, Continue Working, Current Project, Current Report, Report Metrics, Recent Activity, Notifications, and Dashboard Search.
- Custom widget creation with markdown content, optional command action, links, and import/export.
- Persisted dashboard configuration and widget expand/collapse state between sessions.

## Project Workspace Framework
ART 2.0 now includes a Project Workspace Framework that organizes reports, templates, project assets, and workspace state inside a single accessibility project context.

Current capabilities include:

- One active Project Workspace at a time, with architecture prepared for future multi-workspace support.
- Project Workspace lifecycle commands: create, open, open recent, close, save, save as, rename, duplicate, import, export, and delete.
- Resource Navigator shows a dedicated Close Workspace button whenever a Project Workspace is active.
- Default Close Workspace shortcut: Alt+Ctrl+Shift+C (user configurable in Keyboard Shortcut Manager).
- Project Workspace persistence using Project.artproj metadata and a standard workspace folder structure.
- Resource Navigator (Workspace Explorer) for grouped resource navigation using headings, regions, and keyboard-friendly controls.
- Project Asset management with metadata, report linkage, relationship tracking, and read-only-in-ART handling.
- Continue Working command support to restore the most recent Project Workspace context.
- Project Properties and Project Statistics/Health summaries sourced from workspace-level metrics.
- Workspace events for open/save/close/asset/validation activity, enabling future integrations and plugin hooks.

## Universal Search Framework
ART 2.0 now includes a Universal Search Framework that unifies search and search-result behavior across major ART surfaces.

Current capabilities include:

- Provider-based search registration with capability advertising (scopes, item types, wildcard/phrase/boolean support, and searchable fields).
- Search Everywhere dialog for cross-resource discovery across commands, reports, templates, workspaces, project assets, shortcuts, help topics, dashboard widgets, and imported accessibility standards.
- Shared Search Results Framework used by Search Everywhere, Command Palette, Menu Bar Command Search, and Dashboard Search.
- Search history, active-session state, saved searches, and collection-ready state storage.
- Search navigation commands for next/previous result, in-resource matching, and highlight/history clearing.

See:

- [Command Reference](COMMANDS.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Change Log](CHANGELOG.md)

## Repository Documentation
Use these documents as the primary source of development and contribution standards:

- [ART Development Standards](docs/ART-Development-Standards.md)
- [ART Definition of Done](docs/ART-Definition-of-Done.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Copilot Development Instructions](.github/copilot-instructions.md)
- [Feature Completion Requirements](AGENTS.md)

## Getting Started
- Open [index.html](index.html) in the browser to run ART locally.
- Use Application Settings to configure shortcuts and standards workflows.
- Use F10 or Alt+/ to focus the Menu Bar, and use Alt+Q to jump directly to Menu Bar Command Search.
- Use the Command Palette to search and execute commands without leaving the keyboard.
- Use Help in the app for end-user workflow guidance.

## Development Workflow
- Review [ART Development Standards](docs/ART-Development-Standards.md) before implementing changes.
- Confirm completion criteria in [ART Definition of Done](docs/ART-Definition-of-Done.md) before finalizing work.
- Follow contribution expectations in [Contributing Guide](CONTRIBUTING.md).
- Run `powershell -ExecutionPolicy Bypass -File .\\verify-all.ps1` before final review.
