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

### Updated
- Keyboard shortcuts now execute through application commands.
- User interface actions now resolve through shared command handlers where practical.
- Shortcut changes now appear consistently in the Command Palette and other shortcut displays.
- Menu Bar Command Search now stays synchronized with the Command Palette and shared shortcut data.
- Application-wide visual settings now apply through the centralized Theme Engine and live preview in Settings.
- Documentation now reflects the command-based architecture.
- Dashboard state persistence now includes layout, widget order, tab assignment, custom widgets, and collapsed widget state.
