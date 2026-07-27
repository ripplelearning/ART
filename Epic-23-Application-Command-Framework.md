# Epic 23 — Application Command Framework

Version: ART 2.0

---

"Read Epic-23-Application-Command-Framework.md completely. Analyze the current codebase and produce an implementation plan that maps each implementation phase to the files that will be created or modified, identifies existing features that can be reused, highlights any architectural risks, and estimates the scope of each phase. Do not modify any code yet."

# Implementation Strategy

## Overview

This epic establishes the architectural foundation for ART Version 2.0.

Unlike previous implementation epics, this epic is primarily an architectural
refactoring effort rather than the implementation of new end-user features.

The objective is to introduce a centralized Application Command Framework while
preserving the complete functionality, accessibility, and user experience
established in ART Version 1.0.

Existing business logic shall be reused whenever practical.

Existing application features shall continue to function exactly as they do
today unless explicitly modified by this specification.

The implementation shall prioritize stability, maintainability, and incremental
progress over large-scale rewrites.

---

# General Requirements

Implement this epic incrementally.

Do not rewrite mature application features unless required to integrate them
with the Command Framework.

Do not redesign the user interface.

Do not remove existing functionality.

Do not introduce unnecessary architectural changes outside the scope of this
epic.

The objective is to centralize execution while preserving existing behavior.

---

# Existing Functionality Preservation

The following application areas already exist and shall be preserved.

Dashboard

Report Builder

Report Viewer

Progress Log

Executive Summary

Usability Report

Accessibility Lookup Tool

Template Management

Keyboard Shortcut Manager

Application Settings

Import

Export

Local Storage

Report Validation

Help Documentation

User Guide

README

Existing Accessibility Features

Existing Keyboard Shortcuts

Existing Screen Reader Support

Existing Focus Management

Existing Modal Dialog Behavior

Existing Validation Logic

Existing business logic shall be integrated into the Command Framework rather
than rewritten whenever practical.

---

# Incremental Implementation Phases

Implement this epic using the following sequence.

Proceed to the next phase only after successfully completing the current phase.

---

## Phase 1

Implement the Command Registry.

Create the centralized Command Registry.

Implement Command metadata.

Implement Command registration.

Implement duplicate registration detection.

Do not modify existing application behavior during this phase.

Verify that the application builds successfully.

Create a checkpoint commit.

---

## Phase 2

Implement the Command Execution Service.

Create the centralized Command Execution Service.

Implement the Command execution pipeline.

Implement standardized execution results.

Do not refactor existing features yet.

Verify successful application build.

Create a checkpoint commit.

---

## Phase 3

Register Existing Commands.

Register existing application functionality as Application Commands.

Reuse existing business logic whenever practical.

Do not rewrite mature features.

Verify successful application build.

Create a checkpoint commit.

---

## Phase 4

Refactor Keyboard Shortcuts.

Modify existing keyboard shortcut handlers so that they invoke Application
Commands.

Do not change existing shortcut assignments.

Do not change existing keyboard workflows.

Preserve the existing Keyboard Shortcut Manager.

Verify that every existing shortcut continues to function correctly.

Verify successful application build.

Create a checkpoint commit.

---

## Phase 5

Refactor User Interface Components.

Modify existing buttons, dialogs, dashboard controls, and other application
actions so they invoke Application Commands.

Reuse existing business logic.

Preserve existing user workflows.

Do not redesign the user interface.

Verify successful application build.

Create a checkpoint commit.

---

## Phase 6

Integrate Existing Features.

Integrate existing functionality into the Command Framework where appropriate.

Examples include:

Report Validation

Template Management

Accessibility Lookup Tool

Import

Export

Settings

Help

Continue preserving existing behavior.

Verify successful application build.

Create a checkpoint commit.

---

## Phase 7

Documentation.

Create or update:

README.md

CHANGELOG.md

COMMANDS.md

ARCHITECTURE.md

Verify that all documentation accurately reflects the implemented
architecture.

Create a checkpoint commit.

---

## Phase 8

Validation.

Perform all validation described in this specification.

Resolve all discovered issues.

Run regression testing.

Verify accessibility.

Verify keyboard navigation.

Verify screen reader support.

Verify successful application build.

Create a checkpoint commit.

---

## Phase 9

Final Review.

Review the completed implementation.

Remove obsolete code that has been superseded by the Command Framework.

Remove unused imports.

Remove dead code.

Verify consistent code formatting.

Verify documentation.

Verify successful application build.

Run final regression testing.

Proceed to Source Control.

---

# Refactoring Requirements

Whenever practical:

Move existing business logic into reusable Commands.

Do not duplicate existing implementations.

Do not introduce alternate execution paths.

Do not remove existing functionality unless explicitly required.

The implementation shall improve maintainability without changing user-facing
behavior.

---

# Checkpoint Commits

At the completion of each implementation phase:

Verify the application builds successfully.

Verify that no regressions have been introduced.

Generate a concise Git commit message describing the completed phase.

Commit the completed work.

Do not push checkpoint commits unless explicitly instructed.

Checkpoint commits provide rollback points during implementation.

---

# Final Source Control

After all phases have been completed successfully:

Verify that every validation requirement has passed.

Verify that every regression test has passed.

Verify that all documentation has been updated.

Generate a concise, descriptive Git commit message summarizing the completed
implementation.

Commit all remaining changes.

Push the completed implementation to the current working branch.

Report:

The generated commit message.

Confirmation that the build succeeded.

Confirmation that validation passed.

Confirmation that regression testing passed.

Confirmation that documentation was updated.

Confirmation that the commit completed successfully.

Confirmation that the push completed successfully.

---

# Implementation Success Criteria

This epic shall be considered complete only when:

The centralized Command Framework has been implemented.

Existing functionality has been preserved.

Existing business logic has been reused whenever practical.

No unnecessary rewrites have been introduced.

The application builds successfully.

Regression testing passes.

Accessibility is preserved.

Documentation is current.

The repository is prepared for Epic 24 and all future ART Version 2.x
development.

# Objective

Implement a centralized Application Command Framework that becomes the single
execution layer for all user actions throughout ART.

Rather than allowing individual buttons, dialogs, keyboard shortcuts, menu
items, or future user interface components to directly execute application
logic, every user action shall invoke a centralized Command.

The Command Framework shall become the architectural foundation upon which all
future ART functionality is built.

This framework shall support current functionality while providing a scalable
architecture for future features including:

- Command Palette
- Application Menu Bar
- Context Menus
- Dashboard Simplification
- Visual Accessibility
- Project Management
- Issue Tracker Integrations
- Desktop Application
- Future Plug-ins
- Future Automation

This epic intentionally introduces infrastructure rather than visible
application features.

Users should experience no functional regressions after implementation.

Existing functionality shall be preserved. Where possible, existing business logic shall be refactored into the Command Framework rather than rewritten. This epic is an architectural refactoring effort, not a feature rewrite.

---

# Background

Throughout ART Version 1.0, user interface components generally execute their
own implementation logic.

Examples include:

- Buttons
- Keyboard shortcuts
- Dashboard actions
- Dialog commands

Although this approach works well for a Version 1.0 application, it becomes
increasingly difficult to maintain as new features are introduced.

Future ART releases require a common execution architecture that allows every
user action to invoke a single reusable Command.

This architectural change significantly reduces duplicate logic, improves
maintainability, simplifies testing, and enables future extensibility.

---

# Vision

Every user action within ART shall ultimately execute exactly one Command.

Regardless of how a user initiates an action—

- Mouse
- Keyboard shortcut
- Menu item
- Command Palette
- Context Menu
- Future toolbar
- Future ribbon
- Automation
- Desktop menu
- Voice input

—the same Command shall execute.

The user interface shall never contain duplicated business logic.

User interface components exist only to present available Commands to the user.

---

# Design Philosophy

The Command Framework shall follow the following design principles.

## Single Responsibility

Every Command performs exactly one well-defined action.

Commands shall not perform unrelated tasks.

Each Command shall have a single, clearly defined purpose.

---

## Single Source of Truth

Commands shall be defined exactly once.

Buttons, keyboard shortcuts, menus, dialogs, and future user interface
components shall reference existing Commands.

Duplicate implementations shall not exist.

---

## User Interface Independence

Business logic shall not reside inside user interface controls.

Buttons shall execute Commands.

Menu items shall execute Commands.

Keyboard shortcuts shall execute Commands.

Dialogs shall execute Commands.

Future interface components shall execute Commands.

---

## Accessibility First

Accessibility is a core architectural requirement.

Every Command shall be fully operable without a mouse.

Every Command shall remain available to keyboard-only users.

Future screen reader enhancements shall build upon this framework.

Accessibility shall not be treated as a separate feature.

---

## Consistency

Commands shall provide a consistent experience regardless of invocation method.

Executing a Command from:

- a button
- a keyboard shortcut
- a menu item
- the Command Palette

shall always produce identical behavior.

---

## Extensibility

The architecture shall support future features without requiring modification
of existing Commands.

Future user interface components shall consume the existing Command Framework
rather than implementing duplicate logic.

Examples include:

- Desktop menus
- Context menus
- Ribbon interface
- Automation
- Voice control
- Issue Tracker integrations
- Plug-ins

---

# Architectural Goals

The Command Framework shall:

- Centralize application behavior.
- Reduce duplicate code.
- Simplify future development.
- Improve maintainability.
- Improve testability.
- Improve accessibility.
- Improve consistency.
- Improve documentation.
- Enable future desktop migration.

---

# Scope

This epic introduces infrastructure only.

This epic shall not implement:

- Menu Bar
- Command Palette
- Dashboard redesign
- Visual accessibility features
- Project management
- Jira integration

Those features will be implemented in subsequent epics and shall consume the
Command Framework introduced by this epic.

---

# Architectural Overview

The architecture shall follow the model below.

User Interaction

↓

User Interface Component

↓

Application Command

↓

Business Logic

↓

Application State

Examples of User Interface Components include:

- Button
- Menu Item
- Keyboard Shortcut
- Command Palette
- Context Menu
- Dashboard Action

These components shall never contain application business logic.

Their sole responsibility is to invoke an existing Command.

---

# User Interface Responsibilities

User interface components are responsible only for:

- displaying Commands
- enabling or disabling Commands
- invoking Commands
- displaying results
- displaying errors
- displaying progress

User interface components shall not:

- implement business logic
- duplicate application logic
- maintain separate execution paths
- bypass the Command Framework

---

# Business Logic Responsibilities

Business logic shall execute only through Commands.

Commands shall be responsible for:

- validation
- execution
- updating application state
- error handling
- completion notification

Commands shall not depend upon a specific user interface.

Commands shall remain reusable regardless of how they are invoked.

---

# Future Compatibility

The architecture introduced by this epic shall become the required foundation
for all future ART development.

Beginning with Epic 23:

- All newly implemented functionality shall be exposed as one or more
  Application Commands.

- New user interface components shall invoke existing Commands whenever
  possible.

- Duplicate implementations shall not be introduced.

- Future epics shall integrate with the Command Framework instead of bypassing
  it.

---

# Version 2.0 Development Standard

Beginning with ART Version 2.0, every implementation epic shall follow this
architectural model.

No new application feature shall introduce duplicate business logic when an
existing Command can be reused.

The Command Framework becomes the official execution architecture for ART.

Subsequent Version 2.0 epics shall extend this framework rather than replacing
or bypassing it.

---

# Command Registry

## Overview

The Application Command Framework shall maintain a centralized Command Registry.

The Command Registry shall serve as the authoritative source for every executable
application command.

Each command shall be defined exactly once.

No duplicate command definitions shall exist.

Every user interface component shall reference an existing Command rather than
implementing its own business logic.

The Command Registry shall become the single source of truth for:

- Command identification
- Display names
- Descriptions
- Categories
- Keyboard shortcuts
- Help topics
- Command state
- Visibility
- Future menu placement
- Future Command Palette integration

The Command Registry shall not contain user interface logic.

---

# Command Responsibilities

Each Command shall be responsible only for:

- validating execution requirements
- executing a single application action
- reporting completion
- reporting failure
- updating application state

Commands shall not:

- create user interface controls
- render dialogs
- render menus
- display buttons
- contain presentation logic

---

# Command Identification

Every Command shall have a permanent unique identifier.

Command identifiers shall remain stable between releases whenever possible.

Identifiers shall follow the format:

Category.Action

Examples:

File.NewReport

File.OpenReport

File.SaveReport

File.SaveReportAs

File.Import

File.Export

Template.Use

Template.View

Template.Edit

Template.Delete

Project.New

Project.Open

Project.Save

Project.Close

Report.Edit

Report.View

Report.Configure

Report.Validate

Report.Export

Lookup.SearchAccessibilityStandards

Lookup.OpenStandard

Settings.Open

Help.UserGuide

Help.Documentation

Help.About

Application.Exit

These identifiers shall never be displayed directly to users.

---

# Command Categories

Commands shall be organized into logical categories.

Initial categories shall include:

Application

File

Project

Report

Template

Lookup

Settings

Tools

Help

Future epics may introduce additional categories without modifying the existing
framework.

---

# Command Metadata

Each Command shall expose standardized metadata.

The metadata model shall be sufficiently flexible to support future user
interface components without modification.

Each Command shall expose the following properties.

---

Command ID

A permanent unique identifier.

Example:

Report.Validate

---

Display Name

The user-facing name displayed in menus, the Command Palette, dialogs,
documentation, and future desktop interfaces.

Example:

Validate Report

---

Description

A concise description explaining the purpose of the command.

Example:

Validates the current report for missing required information.

Descriptions shall be reused by:

- Help documentation
- Command Palette
- Tooltips
- Future desktop interfaces

---

Category

The logical grouping to which the command belongs.

Example:

Report

---

Execution Handler

A reference to the application logic responsible for executing the command.

The handler shall not be duplicated.

Every invocation shall execute the same handler.

---

Enabled State

Each Command shall expose whether it is currently available.

Examples:

Save Report

enabled only when a report is open.

Close Report

enabled only when a report is open.

Export Report

enabled only when export is available.

User interface components shall respect the enabled state automatically.

---

Visibility

Commands shall expose whether they should currently be visible.

This supports future:

- Menu customization
- Context menus
- Command Palette filtering
- Role-based functionality

Visibility shall be independent of enabled state.

---

Keyboard Shortcut

Each Command may optionally expose one default keyboard shortcut.

Examples:

Ctrl+S

Ctrl+Shift+S

Ctrl+N

F1

Commands are not required to define a shortcut.

Future versions may allow users to customize shortcuts.

---

Help Topic

Each Command shall optionally reference an associated Help topic.

Future versions of ART may use this information to provide context-sensitive
Help.

---

Future Menu Location

Commands may optionally define a preferred menu location.

Examples:

File

Report

Templates

Tools

Help

This property shall not create menus.

It exists solely to support future Menu Bar implementation.

---

Future Command Palette Availability

Each Command shall expose whether it should appear within the Command Palette.

Most commands shall be searchable.

Administrative or internal commands may be excluded.

---

Future Context Menu Availability

Commands may specify whether they are appropriate for context menus.

Example:

Delete Template

may appear only within the Template list.

---

Future Automation Support

The metadata model shall support future automation without requiring structural
changes.

Future automation systems shall invoke existing Commands rather than bypassing
them.

---

# Command Registration

Commands shall register with the Command Registry during application startup.

Registration shall occur exactly once.

Duplicate registration attempts shall generate an application error.

Commands shall not register themselves multiple times.

---

# Command Discovery

The registry shall support querying Commands by:

- Command ID
- Display Name
- Category
- Keyboard Shortcut
- Help Topic
- Future menu location

Future epics shall use these query capabilities rather than maintaining
independent command lists.

---

# Command Lifecycle

Each Command shall follow a consistent lifecycle.

Registration

↓

Availability evaluation

↓

Invocation

↓

Validation

↓

Execution

↓

Application state update

↓

Completion notification

↓

Ready for next invocation

Every command shall follow this lifecycle regardless of how it is initiated.

---

# Future Compatibility

The metadata model defined by this epic shall be considered extensible.

Future properties may be added without breaking existing Commands.

Future user interface components shall consume existing metadata rather than
maintaining duplicate configuration.

---

# Command Execution Framework

## Overview

The Command Execution Framework shall provide a centralized mechanism for
executing every Application Command.

Regardless of how a Command is invoked—

- Button
- Keyboard shortcut
- Menu item
- Command Palette
- Context Menu
- Dashboard action
- Future desktop interface
- Future automation

—the same execution pipeline shall be followed.

No alternate execution paths shall exist.

---

# Command Execution Service

Implement a centralized Command Execution Service responsible for invoking all
registered Commands.

The Command Execution Service shall become the only mechanism by which Commands
are executed.

User interface components shall never invoke business logic directly.

Instead, user interface components shall request execution of a Command by
passing its unique Command ID to the Command Execution Service.

---

# Command Invocation

Commands may be invoked by:

- Mouse interaction
- Keyboard interaction
- Touch interaction
- Voice input
- Future automation
- Programmatic requests

Regardless of the invocation method, identical behavior shall occur.

Invocation source shall not alter Command behavior.

---

# Command Execution Pipeline

Every Command shall follow the same execution sequence.

Command Requested

↓

Locate Command

↓

Verify Registration

↓

Verify Visibility

↓

Verify Enabled State

↓

Validate Preconditions

↓

Execute Command Handler

↓

Update Application State

↓

Notify Completion

↓

Return Execution Result

No step in the execution pipeline shall be bypassed.

---

# Command Lookup

When execution is requested, the Command Execution Service shall locate the
requested Command using its Command ID.

If the Command cannot be located:

- execution shall stop immediately
- no application state shall change
- an error shall be logged
- the failure shall be reported to the caller

The application shall remain stable.

---

# Registration Verification

Before execution, verify that the requested Command has been successfully
registered.

Unregistered Commands shall never execute.

Attempting to execute an unknown Command shall not crash the application.

---

# Visibility Verification

Commands that are currently hidden shall not be executable through the user
interface.

Future administrative or internal Commands may remain registered while hidden.

Visibility shall be evaluated before execution begins.

---

# Enabled State Verification

Verify that the requested Command is currently enabled.

Examples include:

Save Report

enabled only when an editable report is open.

Close Report

enabled only when a report is open.

Delete Template

enabled only when a template is selected.

If a Command is disabled:

- execution shall not continue
- no application state shall change
- the caller shall receive an appropriate result

Disabled Commands shall never perform partial execution.

---

# Preconditions

Each Command may define execution preconditions.

Examples include:

- report exists
- project exists
- template selected
- user confirmation completed
- required data available

Preconditions shall be evaluated before execution begins.

If any precondition fails:

- execution shall terminate
- application state shall remain unchanged
- failure shall be reported

---

# Command Handler

Every Command shall reference exactly one Command Handler.

The Command Handler contains the business logic associated with that Command.

Business logic shall never be duplicated elsewhere in the application.

The Command Handler shall remain independent of the user interface.

---

# State Updates

Upon successful execution, Commands may update application state.

Examples include:

- opening reports
- saving reports
- modifying templates
- updating settings
- refreshing dashboard data
- updating project information

State changes shall occur only after successful execution.

Failed Commands shall not partially modify application state.

---

# Completion Notification

After successful execution, the Command Execution Service shall notify the
requesting component that execution has completed.

Notification shall include:

- success
- failure
- cancellation (if applicable)

Future versions may expose additional execution information.

---

# Execution Results

Commands shall return a standardized execution result.

The result shall communicate:

- Success
- Failure
- Cancelled

Future versions may extend the execution result with additional metadata.

All Commands shall return results using the same model.

---

# Error Handling

Execution failures shall be handled gracefully.

The application shall never terminate unexpectedly because a Command fails.

Unexpected exceptions shall be:

- logged
- reported
- isolated

One failing Command shall not prevent future Commands from executing.

---

# User Notifications

Commands may notify users of significant events.

Examples include:

- Report saved.
- Project created.
- Export completed.
- Validation completed.
- Template deleted.

Notifications shall be generated consistently regardless of invocation source.

---

# Long Running Commands

Future Commands may require extended execution time.

Examples include:

- large exports
- project imports
- issue tracker synchronization
- document generation

The Command Framework shall be designed to support future progress reporting
without architectural changes.

Implementation of progress reporting is outside the scope of this epic.

---

# Cancellation Support

Future Commands may support cancellation.

Examples include:

- export
- import
- synchronization

The Command Framework shall be designed so that cancellation can be introduced
without redesigning the execution architecture.

Cancellation functionality is not implemented in this epic.

---

# Logging

Every Command execution shall be eligible for diagnostic logging.

Future logging may include:

- Command ID
- execution start
- execution completion
- execution duration
- success/failure
- error information

Logging implementation is outside the scope of this epic.

The framework shall be designed to support it.

---

# Transaction Integrity

Commands that modify application data shall execute as complete operations.

Commands shall not leave the application in a partially updated state.

If execution fails:

- completed changes shall remain valid, or
- the operation shall terminate before modifying application state.

Future transactional behavior may be expanded where appropriate.

---

# Reentrancy

A Command shall not execute recursively unless explicitly designed to do so.

The framework shall prevent accidental recursive execution.

Future nested Command execution may be supported where appropriate.

---

# Thread Safety

The Command Framework shall be designed to support future asynchronous
execution.

Current implementation may remain synchronous.

Future architectural enhancements shall not require redesign of existing
Commands.

---

# Performance

The Command Framework shall introduce minimal execution overhead.

Command lookup shall be efficient.

Execution latency introduced by the framework shall not be perceptible to
users.

---

# Extensibility

Future Command capabilities may include:

- Undo
- Redo
- Macro recording
- Automation
- Plug-ins
- Scripting
- Voice commands
- AI-assisted workflows

The architecture implemented by this epic shall accommodate these future
capabilities without requiring fundamental redesign.

---

# Architectural Rules

Beginning with ART Version 2.0:

Business logic shall never be executed directly from:

- Buttons
- Menu items
- Keyboard shortcut handlers
- Dialog controls
- Dashboard actions
- Context menus

Every executable application action shall be exposed as an Application Command
and executed exclusively through the Command Execution Service.

This requirement applies to all future development.

---

# Keyboard Shortcut Framework

## Overview

Beginning with ART Version 2.0, keyboard shortcuts shall become a presentation
layer over the Application Command Framework.

Keyboard shortcuts shall no longer execute application business logic directly.

Instead, every keyboard shortcut shall invoke an Application Command through the
Command Execution Service.

This ensures that keyboard interactions produce identical behavior to buttons,
menus, the Command Palette, and future user interface components.

---

# Objectives

The Keyboard Shortcut Framework shall:

- Centralize keyboard shortcut registration.
- Eliminate duplicate shortcut implementations.
- Improve maintainability.
- Support future shortcut customization.
- Support future desktop implementations.
- Maintain complete keyboard accessibility.

---

# Registration

Keyboard shortcuts shall register with the Application Command Framework during
application startup.

Each shortcut shall reference a registered Command.

Keyboard shortcuts shall not contain application logic.

Registration shall occur only once.

Duplicate registrations shall generate an application error.

---

# Shortcut Metadata

Each registered keyboard shortcut shall include:

- Associated Command ID
- Default shortcut
- Display name
- Category
- Description
- Availability
- Future customization eligibility

The shortcut metadata shall be maintained by the Command Registry.

---

# Shortcut Execution

When a keyboard shortcut is pressed, the following sequence shall occur.

Keyboard Shortcut Detected

↓

Locate Associated Command

↓

Invoke Command Execution Service

↓

Execute Command

↓

Return Result

Keyboard shortcut handlers shall never directly call application business logic.

---

# Shortcut Availability

Keyboard shortcuts shall respect the enabled state of their associated Command.

If the associated Command is disabled:

- the shortcut shall not execute
- application state shall remain unchanged
- no partial execution shall occur

Shortcut availability shall automatically update as Command state changes.

---

# Conflict Prevention

The framework shall prevent duplicate keyboard shortcut registrations.

Two Commands shall not register the same keyboard shortcut unless explicitly
supported by future context-sensitive shortcut behavior.

If a conflict occurs:

- registration shall fail
- the conflict shall be logged
- duplicate execution shall not occur

---

# Browser Shortcut Compatibility

Because ART operates as a web application, certain browser-reserved keyboard
shortcuts cannot be intercepted reliably.

Examples include:

- Alt
- Alt+F
- Ctrl+L
- Ctrl+T
- Ctrl+N
- Ctrl+W
- Ctrl+Shift+T
- Ctrl+Tab

The framework shall avoid assigning shortcuts that conflict with common browser
behavior whenever practical.

Future desktop versions may expose additional shortcuts unavailable within web
browsers.

---

# Focus Independence

Keyboard shortcuts shall function regardless of which application control
currently has keyboard focus, provided:

- the shortcut is valid
- the associated Command is enabled
- the focused control does not require exclusive keyboard input

Text editing controls shall retain expected editing behavior.

The framework shall not interfere with normal typing.

---

# Accessibility

Every keyboard shortcut shall remain fully operable without use of a mouse.

Keyboard shortcuts shall:

- support screen readers
- support keyboard-only users
- preserve logical focus
- avoid unexpected focus changes

Executing a keyboard shortcut shall not move focus unless the associated Command
explicitly requires a focus change.

---

# Focus Management

When a Command changes keyboard focus, focus management shall be performed by the
Command itself rather than the keyboard shortcut.

Examples include:

- Opening dialogs
- Creating new Evaluation Items
- Opening Help
- Displaying Validation Results

The shortcut merely invokes the Command.

The Command determines whether focus changes are necessary.

---

# Future Shortcut Customization

The framework shall support future user customization of keyboard shortcuts.

This epic shall not implement shortcut customization.

However, the architecture shall support:

- changing shortcuts
- restoring defaults
- exporting shortcuts
- importing shortcuts
- conflict detection

without redesign.

---

# Future Shortcut Profiles

The framework shall support future shortcut profiles.

Examples may include:

- Default
- Screen Reader Optimized
- Desktop
- Custom

Profile implementation is outside the scope of this epic.

---

# Display

Future user interface components shall obtain keyboard shortcut information from
the Command Registry.

Examples include:

- Menu Bar
- Command Palette
- Help documentation
- Tooltips
- Keyboard Shortcut Reference

No duplicate shortcut definitions shall exist.

---

# Keyboard Shortcut Documentation

Shortcut documentation shall be generated from the Command Registry.

Future documentation shall not require manual synchronization.

The registry shall become the single source of truth.

---

# Reserved Commands

Certain Commands may intentionally have no keyboard shortcut.

Examples include:

- Dangerous operations
- Administrative functions
- Rarely used configuration tasks

Lack of a shortcut shall not prevent the Command from appearing in:

- Menus
- Command Palette
- Context Menus

---

# Error Handling

Invalid keyboard shortcut registrations shall:

- generate an application error
- not register
- not interfere with other shortcuts

The application shall remain stable.

---

# Future Desktop Compatibility

The Keyboard Shortcut Framework shall support future desktop implementations
without modification.

Desktop-specific shortcuts may be added without redesigning the framework.

---

# Architectural Rules

Beginning with ART Version 2.0:

Keyboard shortcut handlers shall never contain business logic.

Keyboard shortcut handlers shall only:

- detect the shortcut
- identify the associated Command
- invoke the Command Execution Service

All application behavior shall be performed by the associated Command.

This requirement applies to every future keyboard shortcut implemented within
ART.

---

# Accessibility Framework & User Interface Integration

## Overview

The Application Command Framework shall preserve and enhance ART's
accessibility-first architecture.

This epic shall not reduce the accessibility of any existing feature.

Existing accessibility implementations shall be preserved unless modification is
required to integrate with the Command Framework.

All future user interface components shall execute Commands while maintaining
full keyboard accessibility, screen reader compatibility, logical focus
management, and semantic HTML.

---

# Architectural Principle

Accessibility shall remain a core architectural requirement rather than a
feature layered onto the application.

Every Command shall remain fully accessible regardless of how it is invoked.

---

# Existing Accessibility Features

The following functionality already exists within ART and shall be preserved:

- Keyboard shortcut management
- Keyboard navigation
- Screen reader announcements
- Report validation
- Focus management
- Modal dialog behavior
- Existing accessibility settings
- Existing accessible names and descriptions
- Existing ARIA relationships
- Existing live region announcements

This epic shall integrate these existing features with the Command Framework.

These features shall not be rewritten unless required for architectural
integration.

---

# User Interface Integration

All user interface controls that initiate application actions shall invoke
Commands.

Examples include:

- Buttons
- Hyperlinks that perform application actions
- Keyboard shortcuts
- Dashboard controls
- Dialog buttons
- Context menu items
- Future menu items
- Future Command Palette entries

Existing business logic shall remain unchanged whenever practical.

Only the invocation mechanism shall change.

---

# Buttons

Buttons shall no longer directly execute application logic.

Instead, buttons shall invoke the associated Application Command.

Buttons shall continue to:

- display correctly
- receive keyboard focus
- expose accessible names
- expose descriptions
- support keyboard activation
- support screen readers

Existing button behavior shall remain unchanged from the user's perspective.

---

# Keyboard Shortcuts

Existing keyboard shortcuts shall continue to function exactly as they do today.

The Keyboard Shortcut Manager shall continue to manage keyboard shortcuts.

Where practical, shortcut handlers shall invoke Application Commands rather than
directly executing business logic.

Existing shortcut assignments shall be preserved.

No existing shortcut shall be removed without explicit approval.

---

# Dialogs

Dialogs shall continue to function as they do in ART Version 1.0.

Dialog controls shall invoke Commands where appropriate.

Dialog-specific behavior, layout, validation, and focus management shall remain
within the dialog when appropriate.

Business logic shall execute through Commands.

---

# Report Validation

The existing Report Validation feature shall be preserved.

Report validation logic shall not be rewritten.

Instead, introduce an Application Command (for example, `Report.Validate`) that
invokes the existing validation implementation.

The behavior, validation rules, user interface, and results shall remain
unchanged.

---

# Accessibility Lookup Tool

The Accessibility Lookup Tool shall continue to function exactly as implemented.

Search behavior, filtering, navigation, and accessibility shall remain
unchanged.

Future search commands may invoke existing functionality through Application
Commands.

---

# Template Management

Existing template functionality shall remain unchanged.

Examples include:

- Use Template
- View Template
- Edit Template
- Delete Template
- Import Template
- Export Template

Each operation may be exposed through an Application Command without rewriting
existing template management logic.

---

# Dashboard

Dashboard controls shall invoke Application Commands.

Existing dashboard behavior shall remain unchanged.

Dashboard layout changes are outside the scope of this epic.

---

# Focus Management

The Command Framework shall preserve all existing focus management.

Commands that currently move keyboard focus shall continue to do so.

Commands that do not currently move focus shall not introduce unnecessary focus
changes.

Focus shall never be lost following Command execution.

---

# Screen Reader Announcements

Existing live region announcements shall be preserved.

Future Commands may generate standardized accessibility notifications.

Examples include:

- Report saved.
- Export completed.
- Validation complete.
- Template imported.
- Project opened.

Announcement implementation shall remain centralized where practical.

---

# Accessible Names

Existing accessible names shall remain unchanged unless modification is required
to integrate with the Command Framework.

Command execution shall not alter accessible names.

---

# Keyboard Navigation

Logical keyboard navigation shall remain unchanged.

The introduction of the Command Framework shall not alter:

- Tab order
- Arrow key navigation
- Existing shortcut behavior
- Existing focus order

unless explicitly required by a future epic.

---

# Error Reporting

Command failures shall continue to produce accessible error notifications.

Errors shall remain available to screen reader users.

Existing error presentation shall be preserved whenever practical.

---

# Future Menu Bar Integration

Future menu items shall invoke existing Application Commands.

No duplicate business logic shall be introduced.

---

# Future Command Palette Integration

The Command Palette shall obtain its command list from the Command Registry.

Executing a command from the palette shall produce identical behavior to
executing the same command from any other user interface component.

---

# Future Desktop Compatibility

This architecture shall support desktop application development without
requiring accessibility redesign.

Desktop-specific accessibility enhancements may be added without modifying
existing Commands.

---

# Preservation Requirements

This epic is an architectural refactoring effort.

Existing functionality shall be preserved.

Existing business logic shall be reused whenever practical.

Existing accessibility features shall be retained.

Existing user workflows shall remain unchanged.

Only the mechanism by which application actions are invoked shall change.

The objective is to centralize execution while maintaining the user experience
established in ART Version 1.0.

---

# User Interface Integration Framework

## Overview

Beginning with ART Version 2.0, all user interface components that initiate
application actions shall integrate with the Application Command Framework.

User interface components shall become presentation layers that expose
Application Commands.

Business logic shall not reside within user interface components.

This architecture shall ensure that every application action behaves
consistently regardless of how it is invoked.

---

# Architectural Objective

Every user interface component shall become a consumer of the Command
Framework.

The Command Framework shall become the single execution mechanism throughout
the application.

The user interface shall be responsible only for:

- displaying available Commands
- collecting user input
- presenting application information
- displaying execution results
- displaying notifications
- managing user interaction

The user interface shall not implement business logic.

---

# Existing Functionality Preservation

This epic shall preserve all existing ART functionality.

Existing user interface layouts, workflows, keyboard interactions, and
accessibility features shall remain unchanged unless explicitly modified by a
future epic.

Existing business logic shall be reused whenever practical.

Only the execution architecture shall change.

---

# Buttons

Buttons shall invoke Application Commands.

Buttons shall not directly execute business logic.

Existing buttons shall continue to:

- receive focus
- support keyboard activation
- expose accessible names
- expose descriptions
- expose disabled state
- expose pressed state where appropriate

Button appearance shall remain unchanged.

---

# Hyperlinks

Hyperlinks that navigate to application content shall continue to function
normally.

Hyperlinks that initiate application actions shall invoke Application Commands.

Navigation links shall not be converted into Commands unless they perform an
application action.

---

# Dialogs

Dialogs shall continue to collect user input.

Dialog controls shall invoke Commands where appropriate.

Dialogs shall remain responsible for:

- layout
- user interaction
- data collection
- focus trapping
- accessibility

Commands shall remain responsible for business logic.

---

# Dashboard

The Dashboard shall invoke Application Commands.

Dashboard controls shall not contain business logic.

Dashboard redesign is outside the scope of this epic.

Future Dashboard enhancements shall consume the Command Framework introduced by
this epic.

---

# Command Palette Integration

The Command Palette will be implemented in a future epic.

The Command Palette shall obtain its list of available Commands directly from
the Command Registry.

The Command Palette shall not maintain its own command list.

Executing a Command from the Command Palette shall invoke the same Command
Execution Service used by every other user interface component.

---

# Menu Bar Integration

The Menu Bar will be implemented in a future epic.

Menu items shall reference Application Commands.

Menus shall not contain business logic.

Menu enablement, visibility, keyboard shortcuts, and display names shall be
obtained from the Command Registry.

Menu implementation shall require minimal additional code because Commands
already define their metadata.

---

# Context Menu Integration

Future context menus shall reference existing Commands.

Context menus shall determine which registered Commands are appropriate for
the current context.

Context menus shall never duplicate application logic.

---

# Toolbar Integration

If a toolbar is implemented in a future version of ART, toolbar buttons shall
invoke existing Application Commands.

Toolbar buttons shall not duplicate business logic.

Toolbar implementation shall require no architectural modifications.

---

# Future Desktop Integration

The future desktop application shall consume the same Application Command
Framework.

Desktop menu items

↓

Application Commands

Desktop toolbar buttons

↓

Application Commands

Desktop keyboard shortcuts

↓

Application Commands

Desktop context menus

↓

Application Commands

Desktop implementation shall not require redesign of existing Commands.

---

# Command Availability

User interface components shall automatically reflect Command state.

If a Command becomes disabled:

- associated buttons shall become disabled
- associated menu items shall become disabled
- associated Command Palette entries shall indicate the disabled state where
  appropriate

No independent enablement logic shall exist within user interface components.

---

# Command Visibility

User interface components shall automatically respect Command visibility.

Hidden Commands shall not appear in:

- menus
- Command Palette
- dashboard
- context menus

unless explicitly required.

Visibility decisions shall originate from the Command Registry.

---

# Dynamic User Interface

Future versions of ART may dynamically construct portions of the user
interface directly from the Command Registry.

Examples include:

- Menu Bar
- Command Palette
- Keyboard Shortcut Reference
- Help documentation
- Command Reference

This architecture shall support dynamic generation without requiring
structural modifications.

---

# Notifications

Commands may generate notifications.

The user interface shall present those notifications consistently.

Examples include:

- Report saved.
- Export completed.
- Validation completed.
- Template imported.
- Project opened.

Notification presentation shall remain independent from Command execution.

---

# Error Presentation

Command failures shall be presented consistently.

User interface components shall display:

- validation failures
- execution failures
- unexpected errors

using existing application error presentation mechanisms whenever practical.

---

# Future Integration

Future ART features shall integrate with the Command Framework.

Examples include:

- Projects
- Visual Accessibility
- Menu Bar
- Command Palette
- Issue Tracker Integration
- Automation
- Desktop Application
- Plug-ins

Future features shall consume existing Commands whenever practical.

Duplicate implementations shall not be introduced.

---

# Architectural Rule

Beginning with ART Version 2.0:

Every user interface component that initiates an application action shall
invoke an Application Command.

User interface components shall not contain business logic.

Commands shall remain the sole execution mechanism for application behavior.

This requirement applies to all future development.

---

# Developer Documentation Framework

## Overview

Beginning with ART Version 2.0, the repository shall maintain a set of living
developer documents.

These documents shall be considered part of the application architecture.

Whenever a future epic introduces, removes, renames, restructures, or modifies
application functionality, the corresponding documentation shall be updated as
part of the same implementation.

Documentation shall not become stale.

Documentation updates are considered a required deliverable of every future
development effort.

---

# Required Documentation

The ART repository shall maintain the following developer documentation.

- README.md
- CHANGELOG.md
- COMMANDS.md
- ARCHITECTURE.md

Additional documentation may be introduced in future releases.

---

# CHANGELOG.md

## Purpose

CHANGELOG.md shall provide a chronological history of significant application
changes.

It shall follow a consistent format throughout the lifetime of ART.

---

## Content

Each release shall include:

Version

Release date

Epic number(s)

Summary

Added

Changed

Fixed

Removed

Known Issues (if applicable)

Breaking Changes (if applicable)

---

## Automatic Maintenance

Every implementation epic shall update CHANGELOG.md.

Copilot shall never leave CHANGELOG.md outdated.

Changes shall accurately reflect the completed implementation.

Placeholder entries shall not be used.

---

# COMMANDS.md

## Purpose

COMMANDS.md shall serve as the authoritative reference for every registered
Application Command.

The document shall remain synchronized with the Command Registry.

---

## Command Documentation

Each Command shall include:

Command ID

Display Name

Category

Description

Default Keyboard Shortcut

Enabled Conditions

Visibility Rules

Future Menu Location

Available in Command Palette

Associated Help Topic

Primary Implementation Files

Related Features

Dependencies

Future Notes (optional)

---

## Automatic Maintenance

Whenever Commands are:

- added
- removed
- renamed
- merged
- deprecated

COMMANDS.md shall be updated automatically.

---

# ARCHITECTURE.md

## Purpose

ARCHITECTURE.md shall serve as the primary technical reference for ART.

It shall provide developers and AI coding assistants with a comprehensive map
of the application architecture.

The document shall explain both the overall architecture and the repository
organization.

---

## Repository Overview

Document:

- top-level folders
- application modules
- shared components
- utilities
- configuration files

---

## Feature Index

Every significant ART feature shall be documented.

Examples include:

Dashboard

Report Builder

Report Viewer

Executive Summary

Usability Report

Progress Log

Template Management

Accessibility Lookup Tool

Settings

Keyboard Shortcut Manager

Application Command Framework

Visual Accessibility

Projects

Issue Tracker Integration (future)

Desktop Application (future)

---

## Feature-to-File Mapping

Each documented feature shall include:

Purpose

Primary source files

Supporting source files

Configuration files

Stylesheets

Shared components

Utilities

Dependencies

Related Commands

Related documentation

Future epics affecting the feature

This mapping shall enable developers to immediately identify where a feature is
implemented.

---

## Command-to-File Mapping

Each registered Command shall identify:

Primary implementation file

Supporting files

Related dialogs

Associated settings

Related documentation

---

## Application Architecture

Document the relationship between:

User Interface

↓

Application Commands

↓

Business Logic

↓

Application State

↓

Persistence

↓

Import / Export

Future architectural changes shall update this section.

---

## Module Dependencies

Document how major application modules interact.

Examples include:

Dashboard

↓

Report Builder

↓

Templates

↓

Export

↓

Settings

The dependency graph shall remain current.

---

## Repository Evolution

When features are:

added

removed

renamed

moved

split

merged

ARCHITECTURE.md shall be updated to reflect the current repository structure.

---

## AI Development Guidance

ARCHITECTURE.md shall include sufficient detail for an AI coding assistant to
determine:

where a feature is implemented

which files contribute to the feature

which Commands invoke the feature

which modules depend upon the feature

where future enhancements should be implemented

The document shall minimize unnecessary repository searches during future
development.

---

# README.md

README.md shall continue to provide an overview of ART.

Whenever major application functionality changes, README.md shall be reviewed
and updated where appropriate.

---

# Documentation Quality

Documentation shall:

be accurate

be concise

be technically correct

avoid duplication

remain synchronized with the application

reflect the current implementation

---

# Documentation Validation

Before completing any implementation epic:

Verify that:

CHANGELOG.md is current.

COMMANDS.md accurately reflects the Command Registry.

ARCHITECTURE.md accurately reflects the repository structure and feature
organization.

README.md reflects current application capabilities.

No obsolete documentation remains.

---

# Architectural Rule

Beginning with ART Version 2.0:

Documentation is considered part of the implementation.

An epic is not complete until:

the code is complete,

the documentation has been updated,

the application builds successfully,

validation passes,

regression testing passes,

and source control tasks have been completed.

---

# Validation, Regression Testing, Acceptance Criteria & Source Control

## Overview

The Application Command Framework shall be implemented without introducing
regressions to existing ART functionality.

The primary objective of this epic is architectural refactoring while
preserving the complete user experience established in ART Version 1.0.

Existing features shall continue to function as they do today while executing
through the new Command Framework.

---

# Existing Functionality Preservation

The following application areas shall continue to function without regression.

Dashboard

Report Builder

Report Viewer

Field Configuration

Progress Log

Executive Summary

Usability Report

Accessibility Lookup Tool

Template Management

Application Settings

Keyboard Shortcut Manager

Import

Export

Local Storage

Help Documentation

User Guide

README

Accessibility Features

Existing keyboard shortcuts

Existing screen reader support

Existing focus management

Existing validation behavior

Existing modal dialog behavior

No feature shall be removed unless explicitly required by a future epic.

---

# Build Validation

Before completing implementation:

Verify that the application builds successfully.

Resolve:

Compilation errors

Type errors

Linting errors

Import errors

Build warnings that indicate implementation issues

No new build errors shall remain.

---

# Command Framework Validation

Verify that:

Every registered Command has a unique Command ID.

Every registered Command executes successfully.

Commands execute through the Command Execution Service.

Buttons invoke Commands.

Keyboard shortcuts invoke Commands.

Existing functionality produces identical results after refactoring.

Duplicate Command registrations are prevented.

Command metadata is complete.

The Command Registry initializes successfully.

---

# User Interface Validation

Verify that:

Existing buttons continue to function.

Existing dialogs continue to function.

Dashboard behavior remains unchanged.

Template Management behaves correctly.

Accessibility Lookup Tool functions correctly.

Existing workflows remain unchanged.

Existing reports continue to open, edit, save, import, and export correctly.

---

# Keyboard Validation

Verify that:

Existing keyboard shortcuts continue to function.

Keyboard Shortcut Manager continues to operate correctly.

No duplicate shortcuts exist.

Shortcut execution invokes Application Commands.

Shortcut customization (where currently supported) continues to function.

Keyboard-only workflows remain fully operational.

---

# Accessibility Validation

Verify that:

Screen reader compatibility is preserved.

Accessible names remain accurate.

Descriptions remain accurate.

ARIA relationships remain intact.

Logical heading structure is preserved.

Keyboard focus remains logical.

Focus is never lost.

Existing announcements continue to function.

No accessibility regressions are introduced.

The application continues to conform to its accessibility-first design
philosophy.

---

# Documentation Validation

Verify that:

README.md reflects current application functionality.

CHANGELOG.md has been updated.

COMMANDS.md accurately reflects the implemented Command Registry.

ARCHITECTURE.md accurately documents:

Repository organization

Feature-to-file mappings

Command-to-file mappings

Module relationships

Future development guidance

No outdated documentation remains.

---

# Regression Testing

Verify that the following workflows continue to operate correctly.

Create Report

Open Report

Save Report

Save Report As

Import Report

Export Report

Create Template

Edit Template

Delete Template

Import Template

Export Template

Configure Report

Validate Report

Accessibility Lookup Tool

Application Settings

Keyboard Shortcut Manager

Help Documentation

User Guide

Report Statistics

Progress Log

Field Configuration

No workflow shall exhibit behavioral regressions.

---

# Performance Validation

Verify that:

Application startup performance has not significantly degraded.

Command execution introduces no perceptible delay.

Command lookup remains efficient.

User interface responsiveness remains unchanged.

The application remains responsive during normal operation.

---

# Future Compatibility Validation

Verify that the implemented architecture supports future development of:

Command Palette

Menu Bar

Dashboard Simplification

Projects

Visual Accessibility

Desktop Application

Issue Tracker Integration

Automation

Plug-ins

No architectural redesign should be required to support these future epics.

---

# Acceptance Criteria

This epic shall be considered complete only when:

A centralized Command Registry exists.

A centralized Command Execution Service exists.

Existing functionality executes through the Command Framework wherever
appropriate.

Existing business logic has been reused whenever practical.

No unnecessary rewrites have been introduced.

The application builds successfully.

Existing functionality operates correctly.

No accessibility regressions have been introduced.

Documentation has been updated.

Regression testing has passed.

The repository is ready for future Version 2.0 development.

---

# Source Control

After implementation has been completed and all validation requirements have
passed:

Review all modified files.

Remove unused code introduced during refactoring.

Remove obsolete implementations that have been replaced by the Command
Framework.

Ensure code formatting is consistent throughout the repository.

Build the application.

Resolve all build issues.

Run all validation and regression testing described in this epic.

Update:

README.md

CHANGELOG.md

COMMANDS.md

ARCHITECTURE.md

Verify that documentation accurately reflects the implemented architecture.

Generate a concise, descriptive Git commit message summarizing the
implementation.

Commit all related changes.

Push the completed implementation to the current working branch.

Report:

The generated Git commit message.

Confirmation that the build completed successfully.

Confirmation that validation passed.

Confirmation that regression testing passed.

Confirmation that the documentation was updated.

Confirmation that the commit completed successfully.

Confirmation that the push completed successfully.

---

# Version 2.0 Development Standard

Beginning with Epic 23, every future implementation epic shall follow the
development process established by this specification.

Future epics shall:

Reuse existing Commands whenever practical.

Extend the Command Registry instead of bypassing it.

Update developer documentation.

Preserve accessibility.

Maintain keyboard-first usability.

Preserve screen reader compatibility.

Avoid duplicate business logic.

Build successfully.

Pass regression testing.

Update repository documentation.

Generate meaningful commit messages.

Commit and push completed work.

This development standard shall remain in effect for all future ART Version
2.x releases unless superseded by a later architectural specification.

---

# End of Epic 23

This epic establishes the architectural foundation for ART Version 2.0.

All future Version 2.0 development shall build upon this Command Framework.

Subsequent epics—including the Command Palette, Visual Accessibility,
Application Menu Bar, Dashboard Simplification, Projects, and future desktop
application—shall consume and extend this architecture rather than replacing
or bypassing it.

The Command Framework becomes the official execution architecture for ART.