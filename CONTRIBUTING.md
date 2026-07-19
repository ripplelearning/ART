# Contributing to ART

Thank you for your interest in contributing to the Accessibility Reporting Tool (ART).

ART is an open-source accessibility-focused project designed to help organizations identify, understand, document, and improve accessibility.

Contributions are welcome when they support ART's mission, maintain accessibility standards, and follow the project guidelines.

## Before Contributing
Before submitting contributions, please review:

- [ART Development Standards](docs/ART-Development-Standards.md)
- [ART Definition of Done](docs/ART-Definition-of-Done.md)
- [Copilot Development Instructions](.github/copilot-instructions.md)
- [Feature Completion Requirements](AGENTS.md)

These documents define the standards expected for ART development.

## Related Documentation
- [Repository Overview](README.md)
- [ART Development Standards](docs/ART-Development-Standards.md)
- [ART Definition of Done](docs/ART-Definition-of-Done.md)
- [Copilot Development Instructions](.github/copilot-instructions.md)

## Types of Contributions
Contributions may include:

- Bug fixes.
- Accessibility improvements.
- Feature enhancements.
- Documentation improvements.
- Testing improvements.
- Accessibility standards packages.
- User experience improvements.
- Code quality improvements.

## Accessibility Expectations
Accessibility is a core requirement of ART.

All contributions should consider:

- WCAG compliance.
- Keyboard accessibility.
- Screen reader compatibility.
- Semantic HTML.
- Proper focus management.
- Inclusive user experience.

Contributors should avoid:

- Removing existing accessibility features.
- Introducing inaccessible controls.
- Using ARIA where native HTML provides equivalent functionality.

## Code Expectations
Contributions should:

- Follow existing ART coding patterns.
- Use clear naming conventions.
- Avoid unnecessary complexity.
- Include appropriate comments for complex logic.
- Preserve existing functionality.
- Avoid introducing duplicate systems.

## Documentation Expectations
Changes that affect users should include documentation updates.

Update documentation when adding or changing:

- Features.
- Controls.
- Settings.
- Keyboard shortcuts.
- User workflows.
- Accessibility behavior.

Documentation should:

- Follow existing ART formatting.
- Maintain consistent terminology.
- Use proper heading hierarchy.
- Remain accessible.

## Keyboard Shortcut Contributions
When adding commands, controls, or workflows:

Review whether keyboard shortcut support is appropriate.

If shortcuts are added:

- Register them with the Keyboard Shortcut Manager.
- Document them.
- Avoid conflicts.
- Ensure they remain discoverable.

## Accessibility Standards Contributions
ART supports importing and managing accessibility standards.

Contributions involving standards should include:

- Clear documentation.
- Source information.
- Licensing information when applicable.
- Accurate requirement information.
- Appropriate metadata.

Standards contributions should include information such as:

- Standard name.
- Version when available.
- Requirement identifiers.
- Descriptions.
- References.
- Categories.
- Tags.
- Related accessibility information.

## Pull Request Expectations
Pull requests should:

- Clearly describe the purpose of the change.
- Explain user impact.
- Include testing information.
- Identify accessibility considerations.
- Include documentation updates when needed.

Before opening or updating a pull request, run the ART verification scripts:

- `powershell -ExecutionPolicy Bypass -File .\\verify-all.ps1`
- `powershell -ExecutionPolicy Bypass -File .\\verify-epic13.ps1`
- `powershell -ExecutionPolicy Bypass -File .\\verify-epic20.ps1`

Large changes should be discussed before implementation.

## AI-Assisted Development
AI-assisted tools, including GitHub Copilot, may be used during development.

AI-generated code must:

- Follow ART development standards.
- Be reviewed by contributors.
- Meet accessibility requirements.
- Include appropriate documentation updates.
- Be tested before submission.

AI tools assist development but do not replace human review.

## Project Philosophy
ART exists to improve accessibility through practical tools, shared knowledge, and inclusive development.

Contributors are encouraged to:

- Share improvements.
- Document their work.
- Consider diverse users.
- Maintain accessibility as a primary goal.

Thank you for helping improve ART.
