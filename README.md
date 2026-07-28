# ART (the Accessibility Reporting Tool) Version 1.0

ART is an accessibility-first reporting workspace for documenting accessibility findings, managing standards-based criteria, and exporting reports.

## Command Framework
ART 2.0 introduces a centralized Application Command Framework that routes user actions through reusable commands instead of duplicated UI logic.
The Command Palette provides keyboard-first access to those commands and opens with Ctrl+Shift+P.

Shortcut changes made in Application Settings are reflected throughout ART, including the Command Palette and other shortcut displays.

## Visual Accessibility
ART 2.0 also introduces a centralized Theme Engine for visual accessibility and personalization.
It supports built-in themes, zoom, font size, interface density, enhanced focus indicators, reduced motion, border visibility, live preview, and future appearance profiles.

Visual settings are managed from Application Settings and are applied consistently throughout ART.

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
- Use the Command Palette to search and execute commands without leaving the keyboard.
- Use Help in the app for end-user workflow guidance.

## Development Workflow
- Review [ART Development Standards](docs/ART-Development-Standards.md) before implementing changes.
- Confirm completion criteria in [ART Definition of Done](docs/ART-Definition-of-Done.md) before finalizing work.
- Follow contribution expectations in [Contributing Guide](CONTRIBUTING.md).
- Run `powershell -ExecutionPolicy Bypass -File .\\verify-all.ps1` before final review.
