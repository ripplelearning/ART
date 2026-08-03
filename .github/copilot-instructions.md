# ART Copilot Instructions

## Purpose
This file is the project memory for ART (the Accessibility Reporting Tool).
Use it as the default reminder of project rules, design patterns, and lessons learned while working in this repository.

Before implementing any feature, enhancement, bug fix, or architectural change:

1. Review:
	- [ART Development Standards](../docs/ART-Development-Standards.md)
	- [ART Definition of Done](../docs/ART-Definition-of-Done.md)
2. Follow the existing ART architecture, terminology, accessibility practices, and UI conventions.

## Project Context
ART is a modular, browser-based accessibility reporting workspace.
The codebase is driven by a shared state store, command registry, and UI modules for Dashboard, Builder, Editor, Viewer, Settings, Search, Help, and Workspace views.

## Core Development Rules
- Preserve existing functionality.
- Prefer the smallest change that solves the problem at the source.
- Extend existing systems instead of duplicating them.
- Keep backward compatibility whenever possible.
- Follow existing naming, structure, and formatting conventions.
- Do not rewrite approved documentation unless a change actually requires it.
- Do not make unrelated cleanup changes while fixing a bug.

## Accessibility Rules
- Use semantic HTML whenever possible.
- Prefer native controls over unnecessary ARIA.
- Provide meaningful accessible names for all controls.
- Keep keyboard operation reliable and predictable.
- Preserve logical reading order.
- Keep screen reader behavior intentional and stable.
- Respect zoom, high contrast, and reduced motion requirements.
- Verify focus visibility and visible keyboard focus states.
- Only move focus when the workflow explicitly requires it.

## Focus Management Lessons
- Do not move focus away from the control that was just activated, edited, or changed unless the workflow explicitly requested a destination.
- Avoid unconditional render-time focus fallbacks that override the user’s current control.
- Use focus restoration only for deliberate handoffs such as opening dialogs, closing dialogs, explicit navigation commands, or add-entry/add-item workflows that promise a new target.
- When a rerender preserves the same control, preserve focus on that control instead of sending it to a heading or container.
- If a modal or dialog opens, focus should move into that dialog. When it closes, focus should usually return to the trigger.

## Keyboard Shortcut Rules
- Review new controls, buttons, commands, actions, and workflows for shortcut eligibility.
- Register new actions in the Keyboard Shortcut Manager and command registries.
- Do not assign a shortcut by default unless the user explicitly asks for one.
- Avoid duplicate shortcut assignments.
- Keep shortcut labels and help text synchronized.
- Update Welcome and Help shortcut displays when shortcuts change.
- Show shortcut information in accessible tooltips when applicable.

## Documentation Rules
- Update Help documentation whenever features, controls, workflows, settings, or shortcuts change.
- Maintain the existing Help structure, wording style, heading hierarchy, and formatting.
- Update the Table of Contents when content changes.
- Keep README, redirect pages, and visible help copy aligned with the current release label.

## Versioning Rules
- Use the current active version label for forward-facing UI and documentation.
- At present, the active release label is Version 1.5.
- Do not change historical epic documentation unless the user explicitly asks.
- Keep the shared version source and visible title strings consistent.

## Known Project Lessons
- Shortcut defaults can collide with existing user bindings; registration must tolerate conflicts.
- Screen reader announcements for dialogs are more reliable when the intended heading or live region is updated deliberately.
- If a capability depends on report data shape, infer it from the data when appropriate instead of relying only on a single reportType value.
- Add-entry and attachment workflows should restore focus only to the explicit target they create.
- When a control updates a field, selection, or value, the focus should stay with that control unless the workflow says otherwise.

## Completion Expectations
A feature is not complete until it meets the requirements in [ART Definition of Done](../docs/ART-Definition-of-Done.md).
