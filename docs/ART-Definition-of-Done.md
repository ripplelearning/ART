# ART Definition of Done

## Purpose
This document defines the minimum completion requirements for all new ART features, enhancements, bug fixes, and significant modifications.

A change shall not be considered complete until the applicable requirements below have been reviewed and addressed.

## Feature Implementation
The feature or change must:

- Function as intended.
- Integrate correctly with existing ART functionality.
- Avoid unnecessary duplication of existing functionality.
- Maintain compatibility with existing user workflows where possible.
- Follow ART architecture and coding conventions.

## Accessibility Requirements
All new or modified functionality shall be reviewed for accessibility.

Verify:

- Semantic HTML is used wherever possible.
- Native HTML controls are preferred over unnecessary ARIA.
- All controls have meaningful accessible labels.
- Keyboard operation is supported.
- Focus behavior is logical and predictable.
- Reading order is correct.
- Screen reader compatibility is maintained.
- Visible keyboard focus is preserved.
- High Contrast Mode is supported where applicable.
- Reduced Motion preferences are respected where applicable.
- Functionality works correctly at 200%, 300%, and 400% browser zoom.

Supported assistive technologies should include:

- NVDA.
- JAWS.
- Narrator.
- VoiceOver.

## Keyboard Shortcut Requirements
For every new feature or modified workflow:

Review all new:

- Buttons.
- Controls.
- Commands.
- Actions.
- Workflows.

Determine whether keyboard shortcut support is appropriate.

When keyboard shortcuts are added:

- Register them in the Keyboard Shortcut Manager.
- Provide a user-friendly command name.
- Provide the associated action/function.
- Display the current assigned shortcut.
- Allow customization where supported.
- Avoid duplicate assignments.
- Respect existing keyboard shortcut limitations.

Keyboard shortcuts shall be displayed alphabetically in:

- Keyboard Shortcut Manager.
- Welcome screen.
- Help documentation.

When applicable:

- Accessible tooltips shall display assigned shortcuts.
- Tooltip shortcut information shall update when shortcuts are changed.

## Help Documentation Requirements
Whenever functionality changes, update the ART Help documentation.

Documentation updates shall:

- Follow the existing Help structure.
- Maintain existing formatting and styling.
- Maintain existing terminology.
- Maintain the established writing style.
- Use proper semantic heading hierarchy.
- Update the accessible Table of Contents.
- Add new sections where appropriate.
- Update existing sections when functionality changes.

Do not unnecessarily rewrite existing approved documentation.

## Settings Requirements
When new configurable functionality is added:

Review whether:

- A Settings option is required.
- The option requires persistence.
- The option requires documentation.
- The option requires keyboard shortcut customization.
- The option requires validation.

## Testing Requirements
Before completion, verify:

- Core functionality works.
- Existing functionality remains functional.
- Error handling works appropriately.
- User workflows are documented.
- Accessibility requirements are reviewed.
- Documentation is updated.

## Final Completion Review
A feature is complete only when:

- Implementation is complete.
- Accessibility review is complete.
- Keyboard shortcut review is complete.
- Settings updates are complete when applicable.
- Help documentation is updated.
- Table of Contents is updated.
- Testing is complete.
- Changes follow ART development standards.
