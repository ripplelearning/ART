# ART Report Views Framework

## Overview

The Report Views Framework adds temporary, non-destructive report presentations for analysis and review workflows.

A Working View can:
- Group findings by severity, status, reviewer, WCAG criterion, page, component, or type.
- Group findings by relationship-derived metadata such as accessibility standard, template, attachment, and relationship summary.
- Group by up to 3 levels in sequence.
- Sort findings by one or more configured fields.
- Sort by up to 3 levels with per-level direction.
- Filter findings by severity, status, reviewer, tags, and relationship text.
- Switch to Table mode for a column-based Working View with per-column menu controls.
- Sort, group, and filter directly from accessible table header menus, including dynamic values and custom text filters.
- Search within current report findings.
- Save and reload reusable view presets.
- Apply built-in presets for common triage, review, and relationship-analysis workflows.

By default, Working View is temporary. It does not modify report content unless Apply Working View is selected.

## Commands

Primary commands:
- openWorkingView
- exitWorkingView
- applyWorkingView
- saveWorkingView
- loadWorkingView
- deleteWorkingView
- refreshWorkingView
- resetWorkingView
- batchSetWorkingViewStatus
- batchAssignWorkingViewReviewer
- batchSetWorkingViewSeverity
- batchAddWorkingViewTag

Navigation commands:
- nextWorkingViewFinding
- previousWorkingViewFinding
- nextWorkingViewGroup
- previousWorkingViewGroup

Group commands:
- expandAllWorkingViewGroups
- collapseAllWorkingViewGroups

Mode commands:
- setStandardReportView
- setWorkingReportView
- setOutlineReportView
- setCompactReportView
- setExpandedReportView
- setReadingReportView
- setReviewReportView
- setTableReportView
- toggleReportViewMode

Integration commands:
- revealWorkingViewInExplorer
- revealWorkingViewInReport

## Built-in Presets

- Triage by Severity and Status
- Reviewer Queue
- WCAG by Page
- Grouped by Attachment
- Grouped by Accessibility Standard
- Shared Evidence Review

Built-in presets can be applied directly in Working View and then customized before saving as a scoped preset.

## Keyboard Shortcuts

Default assignments:
- openWorkingView: Ctrl+Alt+W
- exitWorkingView: Ctrl+Alt+X
- applyWorkingView: Ctrl+Alt+Shift+W

All Report Views commands are available in Keyboard Shortcut Manager and can be reassigned.

## Scope and Persistence

Working View presets support scoped storage:
- report: only visible for the current report
- project: visible for the active project workspace
- global: visible for all reports and workspaces

Temporary in-progress view sessions are tracked per report and restored while the report remains active.

## Accessibility Behavior

The framework follows ART accessibility patterns:
- semantic headings and grouped regions
- keyboard operation for all commands and result navigation
- focus restoration when exiting Working View
- live status updates for temporary mode and result counts
- visible command shortcuts through existing tooltip and shortcut systems
- predictable keyboard navigation for grouped findings and group summaries
- accessible table header menu buttons for Table mode sort, grouping, and filtering controls
- dialog-based configuration with labeled form controls for all grouping/sorting levels

## Explorer and Dashboard Deep Links

- Dashboard report actions include direct buttons to open Working View and load Working View presets for the selected report.
- Reveal in Explorer from Working View switches to Explorer view and reveals the report resource in Resource Navigator.

## Notes

Apply Working View currently commits presentation ordering for Audit Log reports by reordering visible audit entries. For non-Audit report types, Apply keeps the view state and confirmation flow without mutating field content.

Table mode preserves the same Working View lifecycle and adds a dynamic column-oriented presentation for the visible findings. Column menus support value-based sorting, value grouping, conformance-level grouping for WCAG columns, and exact or contains filtering.

Relationship-based Working Views derive resource context from the current report state, including criterion standard information, current template metadata, and attachment evidence stored on findings. The views remain temporary unless Apply Working View is used on a report type that supports reordering.
