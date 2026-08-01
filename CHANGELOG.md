# Changelog

## Unreleased

### Added
- Centralized Application Command Framework for ART 2.0.
- Command Registry, Command Execution Service, and application command catalog.
- Command-driven routing for dashboard, builder, editor, settings, lookup, and report workflows.
- Command Palette with keyboard-first command discovery and execution.
- Menu Bar with global command search and dynamic command grouping.
- Centralized Theme Engine for visual accessibility and personalization.
- Dashboard Widget Framework with dynamic widget registration and rendering.
- Dashboard layouts: Cards, Tabs, and Compact Dashboard.
- Configure Dashboard dialog for layout selection, widget visibility, ordering, tab assignment, and custom widget management.
- Dashboard Search widget with command and recent-report results.
- Custom dashboard widget import and export support.
- Project Workspace Framework with centralized workspace lifecycle commands.
- Resource Navigator (Workspace Explorer) with grouped resource navigation and filtering.
- Project Workspace metadata model, workspace state persistence, relationships, and recent workspace history.
- Project Workspace folder persistence with Project.artproj and standard workspace folder creation.
- Project Asset management commands and metadata tracking with report linkage support.
- Project Properties and project-level statistics/health summaries.
- Continue Working command integration for recent workspace restoration.
- Workspace event publishing for create/open/save/close/asset/validation activity.
- Universal Search Framework with provider registration, capability advertising, query parsing, ranking, and session state.
- Search Everywhere dialog with cross-resource search and saved-search/history actions.
- Shared Search Results Framework reused by Search Everywhere, Command Palette, Menu Bar Command Search, and Dashboard Search.
- Search command suite for scope-based search, result navigation, and highlight/history management.
- Global Context Menu Framework with context providers, dynamic menu generation, embedded command search, and keyboard navigation.
- Context menu integration driven by the shared Application Command Framework and current shortcut assignments.

### Updated
- Keyboard shortcuts now execute through application commands.
- User interface actions now resolve through shared command handlers where practical.
- Shortcut changes now appear consistently in the Command Palette and other shortcut displays.
- Menu Bar Command Search now stays synchronized with the Command Palette and shared shortcut data.
- Command search surfaces now use shared Universal Search and Search Results Framework components.
- Application-wide visual settings now apply through the centralized Theme Engine and live preview in Settings.
- Documentation now reflects the command-based architecture.
- Dashboard state persistence now includes layout, widget order, tab assignment, custom widgets, and collapsed widget state.
- Window title now includes active Project Workspace context when available.
- Menu Bar and Command Search now include Project Workspace and Project Asset command paths.
