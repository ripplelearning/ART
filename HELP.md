# ART Help: Plugin and Package Framework

## What Are Plugins?
Plugins are executable ART extensions that register capabilities through approved extension points. Plugins do not modify core source files at runtime and do not bypass ART frameworks.

Examples:

- import and export providers
- search providers
- dashboard providers
- explorer providers
- context menu providers
- validation providers
- AI and integration providers

## What Are Packages?
Packages are non-executable content bundles that ART registers as resources after existing workflows complete.

Examples:

- accessibility standards bundles
- report templates
- keyboard profiles
- working view presets
- dashboard layouts
- saved searches

## Existing Workflow Integration
The Plugin Framework does not replace existing workflows.

Continue using:

- Import Accessibility Standard
- Connect Integrations
- Import Template
- Keyboard Shortcut Manager
- Working View Framework
- Dashboard Framework

After those workflows complete, ART registers package/plugin metadata through the Plugin Framework.

## Plugin Lifecycle
Plugins move through lifecycle states:

- Discover
- Validate
- Register
- Load
- Initialize
- Enable
- Disable
- Update
- Unload
- Uninstall

## Plugin and Package Manager
Use Application Settings -> Administrator Tools -> Plugin & Package Manager to:

- install plugin manifests
- enable/disable plugins
- uninstall external plugins
- validate all registered extensions
- inspect registered package metadata
- review plugin dependencies and dependency diagnostics
- review declared plugin permissions
- export plugin framework configuration
- import plugin framework configuration

## Dependency and Permission Behavior
- Plugins can declare required or optional plugin dependencies.
- ART blocks plugin enable when required dependencies are missing, disabled, or below required version.
- ART blocks disable/uninstall when another enabled plugin depends on the target plugin.
- Plugin manifests can declare required permissions, and Plugin Manager surfaces elevated permissions for review.
