# ART Project Format and Portability

## Overview

ART supports portable, editable project and template files so users can move work between devices, browser profiles, and team members.

- Project Workspace folders store complete accessibility project context.
- `Project.artproj` stores Project Workspace metadata and workspace relationships.
- `.art` files store full project state for continued editing.
- `.artx` files store reusable report templates.

These formats are JSON-based, versioned, and intended for long-term forward-compatible use.

## File Formats

### ART Project Workspace (`Project.artproj`)

The `Project.artproj` format represents an editable Project Workspace descriptor.

Required top-level fields:

- `format` (`"ART Project Workspace"`)
- `formatVersion` (example: `"2.0"`)
- `schemaVersion` (example: `"2.0"`)
- `metadata` (project identity and lifecycle metadata)
- `workspace` (workspace resources, relationships, and workspace state)
- `artProjectPayload` (ART project payload used to restore report/template state)

Standard workspace folder structure includes:

- `Reports/`
- `Audit Logs/`
- `Progress Logs/`
- `Templates/`
- `Project Assets/` (Planning, Requirements, Timeline, Documentation, Credentials, Designs, Meeting Notes, Images, Other)
- `Attachments/`
- `Exports/`
- `Backups/`
- `.art/`

Project Workspaces are designed to be copied, moved, archived, restored, and shared without absolute path dependencies.

### ART Project (`.art`)

The `.art` format represents an editable ART project snapshot.

Required top-level fields:

- `format` (`"ART Project"`)
- `formatVersion` (example: `"1.0"`)
- `schemaVersion` (example: `"1.0"`)
- `metadata` (creation and save metadata)
- `project` (project payload used to restore editing state)

Current schema reference:

- `art-project.schema.json`

### ART Template (`.artx`)

The `.artx` format represents a reusable template for report creation.

Required top-level fields:

- `format` (`"ART Template"`)
- `formatVersion` (example: `"1.0"`)
- `schemaVersion` (example: `"1.0"`)
- `template` (template content payload)

Current schema reference:

- `art-template.schema.json`

## Save and Open Workflows

- `Open Workspace` opens Project Workspace folders that contain `Project.artproj`.
- `Save Workspace` writes Project Workspace metadata and standard folder organization.
- `Save Workspace As` prompts for destination and workspace folder creation.
- `Export Workspace` supports folder export and portable package export for browser-compatible workflows.
- `Open ART Project...` opens `.art` files.
- `Save Project` saves current state to the active `.art` file path when available.
- `Save Project As...` prompts for a new `.art` location and file name.
- `Import...` is used for import workflows (legacy report JSON, templates, and standards).

## Recovery Behavior

ART tracks unsaved changes in local application state.

- If the browser or app closes unexpectedly, ART retains local unsaved data in the current profile.
- Recovered state is surfaced to the user as a recoverable project state.
- Recovery does not silently overwrite an existing saved `.art` file.

## Keyboard Shortcuts (Default)

- Open Project: `Ctrl+O`
- Save Project: `Ctrl+S`
- Save Project As: `Ctrl+Shift+S`
- Import Data: `Ctrl+Shift+I`
- New Project Workspace: `Ctrl+Alt+N`
- Open Project Workspace: `Ctrl+Alt+O`
- Save Project Workspace: `Ctrl+Alt+S`
- Save Project Workspace As: `Ctrl+Alt+Shift+S`
- Continue Working: `Ctrl+Alt+R`
- Add Project Asset: `Ctrl+Alt+A`
- Attach File in Report Editor: `Alt+Shift+T`

Shortcut assignments remain user-configurable through ART shortcut settings.

## Portability and Privacy

Project and template portability is supported while preserving user privacy expectations:

- `.art` and `.artx` files are designed for transfer between profiles and devices.
- Local integration login identity and profile-bound connection metadata are not exported in backup/restore payloads.
- Connection state persistence remains profile-local unless explicitly reset.

## Versioning and Compatibility

- ART validates `format`, `formatVersion`, and `schemaVersion` before import.
- Future versions should increase format/schema versions and preserve migration compatibility where feasible.
- Unknown additional properties are tolerated for forward compatibility where safe.
