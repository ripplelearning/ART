# ART Copilot Development Instructions

## Purpose
These instructions define expectations for GitHub Copilot when assisting with development of the Accessibility Reporting Tool (ART).

Before implementing any feature, enhancement, bug fix, or architectural change:

1. Review:
- [ART Development Standards](../docs/ART-Development-Standards.md)
- [ART Definition of Done](../docs/ART-Definition-of-Done.md)
2. Follow existing ART architecture, coding patterns, terminology, accessibility practices, and user interface conventions.

## General Development Expectations
When modifying ART:

- Preserve existing functionality.
- Avoid unnecessary architectural changes.
- Prefer extending existing systems rather than creating duplicate functionality.
- Maintain backward compatibility whenever possible.
- Follow existing naming conventions.
- Document significant architectural decisions.

## Accessibility Requirements
All new functionality shall follow ART's accessibility-first development approach.

Ensure:

- Semantic HTML is used whenever possible.
- Native HTML controls are preferred over unnecessary ARIA.
- Controls have meaningful accessible names.
- Keyboard operation is supported.
- Focus management is correct.
- Reading order remains logical.
- Screen readers are supported.
- Zoom and high contrast requirements are considered.

## Keyboard Shortcut Requirements
Whenever new controls, buttons, commands, actions, or workflows are added:

- Review whether a keyboard shortcut should exist.
- Add eligible shortcuts to the Keyboard Shortcut Manager.
- Ensure shortcuts are customizable where supported.
- Prevent duplicate shortcut assignments.
- Update shortcut documentation.
- Update Welcome screen shortcut displays when applicable.
- Ensure tooltips display assigned shortcuts when applicable.

## Help Documentation Requirements
Whenever features, controls, workflows, settings, or shortcuts change:

Update the ART Help documentation.

Maintain:

- Existing Help structure.
- Existing formatting.
- Existing writing style.
- Existing terminology.
- Existing heading hierarchy.
Update:

- Table of Contents.
- Relevant sections.
- Keyboard shortcut listings.
- User workflows.
Do not rewrite approved documentation unnecessarily.

## Completion Expectations
A feature is not complete until it meets the requirements in:

[ART Definition of Done](../docs/ART-Definition-of-Done.md)
