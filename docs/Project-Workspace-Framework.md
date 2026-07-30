# Project Workspace Framework

## Overview

The Project Workspace Framework in ART 2.0 organizes reports, templates, project assets, and workspace context as one persistent accessibility project.

A Project Workspace is represented by:

- Workspace metadata and lifecycle state in application state.
- A portable folder structure on disk.
- A Project.artproj descriptor file that records workspace-level metadata, relationships, and workspace state.

## Goals

- Keep report workflows intact while adding project-level organization.
- Preserve dashboard and command framework integration.
- Support one active workspace in Version 2.0 while remaining ready for future multi-workspace support.
- Keep resource models extensible for future integrations and plugins.

## Source Files

- projectWorkspaceFramework.js: Workspace lifecycle orchestration, folder persistence, import/export, Resource Navigator rendering, workspace dialogs, asset workflows.
- state.js: Workspace data model, normalization, persistence, recent workspace tracking, workspace statistics, project health, relationship storage, workspace events.
- commandCatalog.js: Workspace command registration and command handlers.
- menuBar.js: Workspace command menu-path mapping.
- dashboard.js: Workspace framework initialization and dashboard widget context integration.
- navigation.js: Shortcut tooltips for workspace controls.
- style.css: Resource Navigator and workspace dialog styling.

## Workspace Lifecycle Commands

- Create new Project Workspace
- Open Project Workspace
- Open recent Project Workspace
- Continue Working
- Close Project Workspace
- Save Project Workspace
- Save Project Workspace As
- Rename Project Workspace
- Duplicate Project Workspace
- Import Project Workspace
- Export Project Workspace
- Delete Project Workspace

## Resource Commands

- Add Project Asset
- Create Asset Folder
- Remove Project Asset
- Refresh Workspace Assets
- Open Project Properties
- Open Project Statistics
- Open Workspace Settings

## Persistence Model

Workspace persistence stores:

- Project identity metadata (name, id, owner, organization, status, version, timestamps).
- Resource references (reports, templates, assets, attachments, logs, backups, exports).
- Resource metadata (asset tags, categories, linked report ids, linked finding ids, relative paths).
- Workspace relationships.
- Workspace state (open reports, active report, dashboard configuration, navigator state).
- Project statistics and health summaries.

## Project Workspace Folder Structure

- Project.artproj
- Reports/
- Audit Logs/
- Progress Logs/
- Templates/
- Project Assets/
- Project Assets/Planning/
- Project Assets/Requirements/
- Project Assets/Timeline/
- Project Assets/Documentation/
- Project Assets/Credentials/
- Project Assets/Designs/
- Project Assets/Meeting Notes/
- Project Assets/Images/
- Project Assets/Other/
- Attachments/
- Exports/
- Backups/
- .art/

## Events

Workspace framework publishes events for:

- WorkspaceCreated
- WorkspaceOpened
- WorkspaceSaved
- WorkspaceClosed
- WorkspaceRenamed
- WorkspaceDuplicated
- WorkspaceDeleted
- WorkspaceUpdated
- WorkspaceRestored
- ProjectAssetAdded
- ProjectAssetRemoved
- RelationshipUpdated
- ValidationCompleted
- RecentUpdated

Events are emitted as custom events so other ART frameworks and future plugins can subscribe without direct coupling.
