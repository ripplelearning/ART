# ART Feature Completion Requirements

These rules apply to all new features, enhancements, and modifications in ART.

## Keyboard Shortcut Manager Updates
- Review all new and modified functionality for controls, buttons, commands, actions, and workflows that should support keyboard shortcuts.
- Update the Keyboard Shortcut Manager in Settings to include every eligible shortcut assignment.
- Ensure all user-configurable shortcuts appear dynamically in the alphabetized shortcut list in the Keyboard Shortcut Manager, the Welcome screen, and the Help documentation.
- Each shortcut-enabled control must include a user-friendly command name, the associated action or function, the current shortcut, and customization support where ART's shortcut architecture allows it.
- Avoid duplicate shortcut assignments.
- Respect existing shortcut customization behavior and limitations.
- Keep shortcut discovery accessible and consistent.

## Help Documentation Updates
- Update ART Help documentation whenever new features, controls, settings, workflows, or keyboard shortcuts are added or changed.
- Follow the existing Help structure, heading hierarchy, formatting, terminology, and writing style.
- Update the accessible Table of Contents and ensure new sections are linked correctly.
- Include updated keyboard shortcut information using the existing shortcut documentation format.
- Preserve approved content and change only the sections needed to document the feature change.
- Keep documentation accurate, current, consistent with the UI, and accessible.

## Accessibility Review
- Verify keyboard accessibility.
- Verify screen reader compatibility.
- Verify focus behavior.
- Verify semantic HTML usage.
- Verify new controls follow ART accessibility patterns.

## Tooltip Requirements
- When new buttons or controls are added, or when shortcut assignments are added or changed, accessible tooltips must display the current shortcut when one exists.
- Tooltip shortcut information must update dynamically when a shortcut changes.

## Completion Gate
- Do not consider a change complete until keyboard shortcut support, accessibility validation, and Help documentation updates have been reviewed and completed.
