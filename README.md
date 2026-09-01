# ART (the Accessibility Reporting Tool) Version 1.5

ART is an accessibility-first reporting workspace for documenting accessibility findings, managing standards-based criteria, and exporting reports.

## Report Attachments
ART supports an Attachment field type in Report Builder.
When a report includes Attachment fields, Report Editor provides an Attach File button that opens the operating system file picker and supports one or more files of any type.
Attached file names appear in Report Viewer and export output, and attachment data is preserved with report and template workflows.

The Attach File workflow is also available as a configurable shortcut in Keyboard Shortcut Manager under Attach File in Report Editor.

## Command Framework
ART 2.0 introduces a centralized Application Command Framework that routes user actions through reusable commands instead of duplicated UI logic.
The Command Palette provides keyboard-first access to those commands and opens with Ctrl+Shift+P.
The Menu Bar provides a familiar menu structure, and Menu Bar Command Search opens with Alt+Q.
ART 2.0 also introduces a reusable Global Context Menu Framework that generates context-sensitive menus from the same registered commands.

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

## Plugin Framework
ART Version 1.5 includes a centralized Plugin Framework for installable extensions and non-executable packages.

Current capabilities include:

- Central plugin lifecycle orchestration: discover, validate, register, load, initialize, enable, disable, update, unload, uninstall.
- Extension-point registration for commands, providers, resource types, working views, validation rules, and integrations.
- Package registration that runs after existing workflows (standards import, template import, integration configuration) complete.
- Accessible Plugin & Package Manager in Application Settings under Administrator Tools.
- Built-in package directory structure under [packages](packages) for standards, templates, keyboard profiles, working view presets, saved searches, and future package categories.

The Plugin Framework does not replace existing import/export or integration workflows.
It registers metadata and compatibility data after those workflows complete.

## Collaboration Server (Live and Asynchronous)
ART Version 1.5 includes an optional collaboration server under [collaboration-server](collaboration-server) for:

- live multi-user collaboration sessions
- asynchronous collaboration using shared snapshot storage (for example a shared drive/folder mounted on the server)

Fastest startup path on Windows:

- Run [start-collaboration-server.ps1](start-collaboration-server.ps1) from the repository root.
- Or run [start-collaboration-server-and-open-health.ps1](start-collaboration-server-and-open-health.ps1) to launch the server and automatically open the health endpoint in your browser.
- Stop with [stop-collaboration-server.ps1](stop-collaboration-server.ps1) when finished.
- Open ART Settings -> Collaboration.
- Set Live collaboration server URL (default: ws://localhost:8787/art-live).
- Use Quick Start Live Collaboration.

Asynchronous shared-folder workflow:

1. Start the collaboration server with ART_COLLAB_SHARED_FOLDER configured (or pass -SharedFolder to the launcher script).
2. User A connects and chooses Publish Async Snapshot.
3. User B connects and chooses Pull Async Snapshot.
4. ART applies pulled collaboration metadata and updates sync status.

See:

- [Command Reference](COMMANDS.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Change Log](CHANGELOG.md)
- [Security and Privacy](SECURITY.md)
- [Help: Plugin and Package Framework](HELP.md)
- [User Guide: Plugins and Packages](USER-GUIDE.md)
- [Plugin Developer Guide](PLUGIN-DEVELOPER-GUIDE.md)
- [Package Authoring Guide](PACKAGE-AUTHORING-GUIDE.md)
- [Collaboration Server Guide](collaboration-server/README.md)

## Publishing Presentation Framework
ART Version 1.5 now includes a reusable Publishing Presentation Framework for report output.

Current capabilities include:

- reusable Report Layouts for section order, visibility, cover pages, table of contents, headers, footers, and page numbering
- reusable Themes for accessible colors, typography, spacing, links, and table styling
- reusable Branding resources for logos, rich header/footer content, links, images, and required alternative text
- Publishing Profiles that combine Layout, Theme, Branding, and preview/output preferences
- validation for layout compatibility, required image alternative text, contrast, focus visibility, and link distinguishability
- preview modes for screen, print, Word, PDF, and HTML publishing contexts
- command-driven access through the Presentation menu and command search surfaces

Presentation configuration remains separate from the underlying report findings and field data.

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
- Use the Attach File in Report Editor shortcut (default: Alt+Shift+T) when working in Attachment fields.
- Use Help in the app for end-user workflow guidance.

## Development Workflow
- Review [ART Development Standards](docs/ART-Development-Standards.md) before implementing changes.
- Confirm completion criteria in [ART Definition of Done](docs/ART-Definition-of-Done.md) before finalizing work.
- Follow contribution expectations in [Contributing Guide](CONTRIBUTING.md).
- Run `powershell -ExecutionPolicy Bypass -File .\\verify-all.ps1` before final review.
