# Package Authoring Guide

## Package Model
ART packages are non-executable metadata and content bundles. They are registered by Plugin Framework services after existing workflows succeed.

## Required Fields
Each package should define:

- packageId
- packageType
- displayName
- version
- supportedArtVersion
- sourceWorkflow

## Supported Package Types
- accessibility-standards
- report-templates
- dashboard-layouts
- keyboard-profiles
- working-view-presets
- saved-searches
- sample-data
- documentation-packages
- integration-providers

## Directory Conventions
Mirror package types under [packages](packages) so category ownership is clear:

- packages/accessibility-standards
- packages/report-templates
- packages/dashboard-layouts
- packages/keyboard-profiles
- packages/working-view-presets
- packages/saved-searches
- packages/sample-data
- packages/documentation-packages
- packages/integration-providers

## Accessibility Standards Package Shape
Standards packages follow the ART standards payload structure.

```json
{
  "artAccessibilityStandardsVersion": "1.0",
  "package": {
    "packageId": "standard-package-example",
    "packageType": "accessibility-standards",
    "displayName": "Example Standard",
    "version": "1.0",
    "supportedArtVersion": "1.5",
    "sourceWorkflow": "settingsImportStandard"
  },
  "standards": [
    {
      "internalId": "example-standard",
      "displayName": "Example Standard",
      "version": "1.0",
      "source": "Example",
      "criteria": [
        {
          "number": "1.1",
          "title": "Example Criterion",
          "level": "A",
          "desc": "Example criterion description."
        }
      ]
    }
  ]
}
```

## Validation Guidance
Package validation checks:

- package metadata completeness
- ART version compatibility
- supported package type
- duplicate package identifiers

## Best Practices
- Keep identifiers stable.
- Use semantic names and descriptions.
- Preserve existing import workflows.
- Include source workflow and provenance metadata.
