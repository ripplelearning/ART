# ART Security and Privacy

## Scope

ART Version 1.5 is a local-first browser application. By default, report, project, task, Progress Log, and configuration data is stored in the browser on the user's device. ART does not automatically upload, synchronize, or share this data.

This document describes the current local application boundary and the requirements for future hosted or self-hosted deployments. It does not claim security certification, SOC 2 compliance, ISO/IEC 27001 certification, FedRAMP authorization, or production hosted-service controls.

## Current Security Boundary

- Local data in browser storage is not equivalent to encrypted enterprise storage. Users should protect their device and browser profile appropriately.
- ART Project exports can include reports, tasks, Shared Progress Logs, and other user-created application data. Review exports before sharing them.
- Imported files are untrusted input. ART validates supported structured formats before applying them; imported content must not be treated as executable instructions.
- Privacy Mode blocks user-initiated external communication through ART's guarded navigation and integration paths.
- Authentication credentials, passwords, passkeys, OAuth tokens, refresh tokens, and provider secrets must not be written to reports, ART Project exports, ordinary logs, or source code.
- The current identity service stores only non-secret local profile/device identity and browser-session identity metadata. It is not a secure authentication provider or authorization service.
- Local file/project access is controlled by the user and operating system. ART has no server-side organization isolation or role-based enforcement yet.

## Report a Vulnerability

Do not include secrets, credentials, personal data, report contents, or proof-of-concept exploits in public issues.

Report suspected security vulnerabilities privately to the project maintainers through the contact method listed by the repository owner. Include:

- A concise description of the issue and its potential impact.
- Reproduction steps using sanitized test data.
- ART version, browser/operating system, and deployment context.
- Any mitigations already identified.

Maintainers should acknowledge receipt, assess severity, develop and test a remediation, coordinate disclosure, and publish an advisory when appropriate. Do not claim a fixed status until a tested release is available.

## Security Release Checklist

Before a significant release, maintainers should review:

- Input validation and output encoding for changed import, export, template, report, and rich-content paths.
- Whether a change introduces credentials, tokens, secrets, personal data, or new external communication.
- Privacy Mode, external-navigation guards, and explicit user confirmation for any data transfer.
- Browser-storage implications and whether sensitive data is unnecessarily persisted.
- Commands, keyboard shortcuts, context menus, and History/Undo paths for authorization bypass risks.
- Keyboard and screen-reader accessibility of security-relevant controls, dialogs, and messages.
- Dependency updates, known vulnerability review, and secret scanning in the source repository.
- Regression suite results and targeted tests for security-sensitive behavior.

## Future Hosted and Self-Hosted Requirements

Hosted and self-hosted ART require separate security architecture and operational controls before production use, including HTTPS/TLS, secure authentication, server-side authorization, organization isolation, secure credential/token storage, API protection, audit-log protection, rate limiting, backup/recovery, monitoring, incident response, dependency scanning, and deployment hardening.

Epics 49 through 52 define the prerequisite authentication, file-based collaboration, authorization, and storage-provider work. No client-side visibility control is a substitute for server-side authorization.
