import { announce, getAssignableActions, getShortcutDefinitions, getShortcutForAction } from './state.js';

const reservedShortcutSet = new Set([
    'Ctrl+L',
    'Ctrl+T',
    'Ctrl+W',
    'Ctrl+R',
    'Ctrl+P',
    'Ctrl+N',
    'Ctrl+O',
    'Ctrl+S',
    'Ctrl+Shift+S',
    'Ctrl+Shift+N',
    'Ctrl+Shift+T',
    'Alt+F4'
].map((value) => value.toLowerCase()));

let helpInitialized = false;
let lastHelpTrigger = null;
let previousDocumentTitle = '';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatShortcutValue(value) {
    const text = String(value || '').trim();
    return text || 'Unassigned';
}

function getCommandRows() {
    const shortcutByAction = new Map(getShortcutDefinitions().map((definition) => [definition.action, definition]));
    const customizable = new Set(getAssignableActions().map((item) => item.action));

    return [...shortcutByAction.values()]
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }))
        .map((definition) => {
            const shortcut = formatShortcutValue(definition.shortcut);
            const normalized = shortcut.toLowerCase();
            let limitation = 'None documented.';
            if (shortcut === 'Unassigned') {
                limitation = 'No shortcut assigned.';
            } else if (reservedShortcutSet.has(normalized)) {
                limitation = 'May be reserved by browser or operating system.';
            } else if (definition.action === 'openHelp' && normalized === 'f1') {
                limitation = 'F1 support depends on environment; ART intercepts F1 when possible.';
            }

            return {
                action: definition.action,
                label: String(definition.label || '').trim(),
                shortcut,
                defaultShortcut: formatShortcutValue(definition.defaultShortcut),
                customizable: customizable.has(definition.action) ? 'Yes' : 'No',
                purpose: String(definition.label || '').trim(),
                limitation
            };
        });
}

function buildShortcutListMarkup(rows) {
    return rows
        .map((row) => `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.shortcut)}</li>`)
        .join('');
}

function buildShortcutTableMarkup(rows) {
    return rows
        .map((row) => `
            <tr>
                <th scope="row">${escapeHtml(row.label)}</th>
                <td>${escapeHtml(row.shortcut)}</td>
                <td>${escapeHtml(row.defaultShortcut)}</td>
                <td>${escapeHtml(row.purpose)}</td>
                <td>${escapeHtml(row.customizable)}</td>
                <td>${escapeHtml(row.limitation)}</td>
            </tr>
        `)
        .join('');
}

function getHelpSections(rows) {
    const closeWorkspaceShortcut = formatShortcutValue(getShortcutForAction('closeProjectWorkspace') || 'Alt+Ctrl+Shift+C');
    const shortcutList = buildShortcutListMarkup(rows);
    const shortcutTable = buildShortcutTableMarkup(rows);

    return [
        {
            id: 'help-getting-started',
            title: 'Getting Started',
            content: `
                <p>ART (the Accessibility Reporting Tool) Version 1.5 is an accessibility-first reporting workspace for building accessibility audits, managing report data, and exporting documentation in multiple formats.</p>
                <p>Use Dashboard actions to create or open a Project Workspace, then use the panel tabs for Builder, Editor, Viewer, and Help tasks.</p>
            `
        },
        {
            id: 'help-art-overview',
            title: 'ART Overview',
            content: `
                <p><strong>Purpose:</strong> ART helps teams document findings against WCAG success criteria.</p>
                <p><strong>Intended users:</strong> accessibility specialists, QA teams, and project teams that track conformance work.</p>
                <p><strong>What ART does not do:</strong> ART does not automatically scan websites or replace manual accessibility analysis.</p>
            `
        },
        {
            id: 'help-user-interface',
            title: 'User Interface',
            content: `
                <p>ART includes four major regions: panel selector, Dashboard, main panel content, and the Accessibility Lookup Tool.</p>
                <ul>
                    <li>Panel selector: choose Welcome, Builder, Editor, and Report Viewer.</li>
                    <li>Dashboard: report lifecycle and settings actions.</li>
                    <li>Main panel: active workflow content.</li>
                    <li>Accessibility Lookup Tool: search and reference criteria.</li>
                </ul>
            `
        },
        {
            id: 'help-navigation',
            title: 'Navigation',
            content: `
                <p>Use keyboard shortcuts, tab navigation, and landmark cycling to move through ART.</p>
                <p>Landmark navigation cycles continuously through key regions, and Help opens independently without changing your current work state.</p>
                <p>Architecture note: this integrated Help module is isolated so it can migrate to a desktop Help window in future Electron or Tauri packaging.</p>
            `
        },
        {
            id: 'help-command-palette',
            title: 'Command Palette',
            content: `
                <p>The Command Palette is ART's keyboard-first command launcher. It opens with <strong>Ctrl+Shift+P</strong> and lets you search registered Application Commands without leaving the keyboard.</p>
                <p>Type to filter commands instantly, use the Arrow keys to move through results, and press <strong>Enter</strong> to execute the selected command.</p>
                <p>The Command Palette always shows the current shortcut assignment for each command, so any change made in Application Settings is reflected immediately.</p>
            `
        },
        {
            id: 'help-universal-search',
            title: 'Universal Search Framework',
            content: `
                <p>ART includes a Universal Search Framework that unifies search across commands, reports, templates, project workspaces, project assets, keyboard shortcuts, help topics, dashboard widgets, and imported accessibility standards.</p>
                <p>Use <strong>Ctrl+K</strong> to open <strong>Search Everywhere</strong>, then type a query and use Arrow keys plus Enter to activate results.</p>
                <p>The same reusable search results framework is used by Search Everywhere, Command Palette, Menu Bar Command Search, and Dashboard Search so behavior, keyboard interaction, and status announcements remain consistent.</p>
                <p>Search supports phrase queries (<strong>"quoted phrase"</strong>), wildcard terms (<strong>*</strong> and <strong>?</strong>), and include/exclude terms with <strong>+</strong> and <strong>-</strong> prefixes.</p>
                <p>Use <strong>Save Search</strong> to store frequently used queries, and use <strong>Clear History</strong> to remove stored query history.</p>
            `
        },
        {
            id: 'help-menu-bar',
            title: 'Menu Bar and Command Search',
            content: `
                <p>ART includes a keyboard-first Menu Bar that groups application commands into familiar menus such as File, Edit, View, Search, Report, Tools, Templates, and Help.</p>
                <p>Use <strong>F10</strong> or <strong>Alt+/</strong> to focus the Menu Bar, and use <strong>Alt+Q</strong> to jump directly to Menu Bar Command Search from anywhere in ART.</p>
                <p>Menu Bar Command Search uses the same centralized command search engine as the Command Palette, so both surfaces stay synchronized with current commands and shortcuts.</p>
            `
        },
        {
            id: 'help-context-menus',
            title: 'Global Context Menus',
            content: `
                <p>ART now uses a reusable Global Context Menu Framework for right-click, keyboard menu key, Shift+F10, touch-and-hold, and other menu invocation methods.</p>
                <p>Context menus are generated from the Application Command Framework and the current application context, so the same commands appear consistently for the same situation.</p>
                <p>The last item in every context menu is <strong>Command Search</strong>.</p>
                <p>Command Search uses the same command search engine, listbox roles, keyboard interaction model, statuses, and shortcut-aware command execution behavior as Menu Bar Command Search.</p>
                <p>Commands show their current shortcut assignment when one exists, and context menus follow the same accessibility model throughout ART.</p>
            `
        },
        {
            id: 'help-dashboard-widgets',
            title: 'Dashboard Widgets and Layouts',
            content: `
                <p>The Dashboard now uses a widget framework that dynamically renders registered dashboard widgets instead of relying on a fixed dashboard structure.</p>
                <p>Use <strong>Configure Dashboard</strong> to select Dashboard Cards, Dashboard Tabs, or Compact Dashboard layouts; show or hide widgets; reorder widgets; and assign widgets to tabs.</p>
                <p>Custom widgets support heading text, descriptions, markdown content, optional command actions, links, and import/export workflows.</p>
                <p>Widget expand/collapse state and dashboard configuration are persisted between sessions.</p>
                <p>The Continue Working workflow restores the most recent Project Workspace context when available.</p>
            `
        },
        {
            id: 'help-project-workspace',
            title: 'Project Workspace Framework',
            content: `
                <p>ART uses a Project Workspace model so reports, templates, assets, and workspace context can be managed as one accessibility project.</p>
                <p>Project Workspace commands include create, open, open recent, close, save, save as, rename, duplicate, import, export, and delete.</p>
                <p>One Project Workspace is active at a time in Version 2.0. The underlying architecture is prepared for future multi-workspace support without redesign.</p>
                <p>Resource Navigator groups workspace resources by category and supports keyboard-first navigation and filtering.</p>
                <p>When a Project Workspace is active, Resource Navigator includes a <strong>Close Workspace</strong> button. The default shortcut is <strong>${escapeHtml(closeWorkspaceShortcut)}</strong>, and this assignment can be changed in Keyboard Shortcut Manager.</p>
            `
        },
        {
            id: 'help-visual-accessibility',
            title: 'Visual Accessibility and Personalization',
            content: `
                <p>Application Settings includes a centralized Theme Engine for visual accessibility and personalization.</p>
                <p>Use it to choose a built-in theme, adjust zoom and font size, switch interface density, enable enhanced focus indicators, reduce motion, and change border visibility.</p>
                <p>Settings changes use live preview, so you can review appearance updates before applying them. Restore Defaults returns ART to its built-in visual configuration.</p>
                <p>Future versions can introduce named appearance profiles without redesigning the existing settings flow.</p>
            `
        },
        {
            id: 'help-features-workflows',
            title: 'Features and Workflows',
            content: `
                <ul>
                    <li>Create or open reports from Dashboard.</li>
                    <li>Configure report metadata and fields in Builder.</li>
                    <li>Record and edit findings in Editor.</li>
                    <li>Use Attachment fields with Attach File to add one or more files directly from your device.</li>
                    <li>Export reports from Viewer with current live data.</li>
                    <li>Use the Accessibility Lookup Tool for criterion lookup and copy workflows.</li>
                </ul>
            `
        },
        {
            id: 'help-plugin-package-framework',
            title: 'Plugin and Package Framework',
            content: `
                <p>ART Version 1.5 includes a Plugin Framework and Plugin &amp; Package Manager in Application Settings under Administrator Tools.</p>
                <p>Use Plugin &amp; Package Manager to install or update plugin manifests, enable or disable plugins, uninstall external plugins, validate extensions, and inspect package metadata.</p>
                <p>Plugins can declare dependencies and permissions. ART blocks enable when required dependencies are missing or incompatible, and blocks disable/uninstall when enabled dependent plugins still require a plugin.</p>
                <p>You can export and import Plugin Framework configuration to preserve plugin and package registration across environments.</p>
                <p>The Plugin Framework registers capabilities and package metadata after existing workflows complete; it does not replace core report, template, settings, or integration workflows.</p>
            `
        },
        {
            id: 'help-progress-log-workflow',
            title: 'Progress Log Workflow',
            content: `
                <p>The Progress Log is an optional workflow for Audit Log reports that keeps internal evaluation tracking separate from report findings.</p>
                <p>Enable the Progress Log in Builder, then open it from Editor or Viewer to manage evaluation items, status updates, findings counts, and assignment details.</p>
                <p>When Appendix output is enabled, the Progress Log can be included in exported report packages as a separate reference section.</p>
            `
        },
        {
            id: 'help-evaluation-item-selection',
            title: 'Evaluation Item Selection Box',
            content: `
                <p>The Evaluation Item Selection Box field type lets a report field point to a Progress Log evaluation item by name.</p>
                <p>Use it when a field should reference one of the current Progress Log items instead of a freeform value.</p>
                <p>The available choices stay synchronized with the current Progress Log entries for the active report.</p>
            `
        },
        {
            id: 'help-attachments',
            title: 'Report Attachments',
            content: `
                <p>The Attachment field type adds an Attach File button in Report Editor and supports selecting one or more files through the operating system file picker.</p>
                <p>Attachment fields accept any file type. Attached files are stored with the report data and reopen with the report.</p>
                <p>In Report Viewer, attached file names are displayed as links with preview and open or download actions.</p>
                <p>The <strong>Attach File in Report Editor</strong> command is assignable in Keyboard Shortcut Manager and defaults to <strong>${escapeHtml(formatShortcutValue(getShortcutForAction('attachFile') || 'Alt+Shift+T'))}</strong>.</p>
                <p>Template create, import, and export workflows preserve Attachment field configuration and attached file payloads when those files are present in the template data.</p>
            `
        },
        {
            id: 'help-report-views-framework',
            title: 'Report Views Framework',
            content: `
                <p>The Report Views Framework provides temporary Working Views for grouping, filtering, sorting, and reviewing findings without changing report content by default.</p>
                <p>Use <strong>Open Working View</strong> from Report Viewer actions, context menus, or commands to configure grouping, sorting, filter criteria, and search text.</p>
                <p>Working View Properties supports up to three grouping levels and up to three sorting levels so complex audit queues can be organized consistently.</p>
                <p>Built-in presets include triage, reviewer queue, and WCAG-by-page flows. Presets can be saved as report, project, or global scope.</p>
                <p>Batch actions can set status, assign reviewer, set severity, or add a tag to currently visible findings.</p>
                <p>Use <strong>Reveal in Explorer</strong> to open Explorer view and focus the associated report resource from a Working View finding.</p>
                <p>Use <strong>Apply Working View</strong> only when you want to commit the current presentation order to the active report organization.</p>
                <p>You can save, load, refresh, reset, and delete Working View presets with report, project, or global scope.</p>
                <p>Default shortcuts: <strong>Open Working View</strong> is <strong>${escapeHtml(formatShortcutValue(getShortcutForAction('openWorkingView') || 'Ctrl+Alt+W'))}</strong>, <strong>Exit Working View</strong> is <strong>${escapeHtml(formatShortcutValue(getShortcutForAction('exitWorkingView') || 'Ctrl+Alt+X'))}</strong>, and <strong>Apply Working View</strong> is <strong>${escapeHtml(formatShortcutValue(getShortcutForAction('applyWorkingView') || 'Ctrl+Alt+Shift+W'))}</strong>.</p>
            `
        },
        {
            id: 'help-settings-config',
            title: 'Settings and Configuration',
            content: `
                <p>Application Settings includes Keyboard Shortcut Manager, imported standards, the Paste Standards As Table workflow for clipboard tables, Security and Privacy controls, Integrations, Administrator Tools, and About metadata.</p>
                <p>If assigned in Keyboard Shortcut Manager, the Paste Standards As Table action can be opened directly with its configured shortcut.</p>
                <p>Settings > Integrations provides local and network file import actions for reports, templates, and standards.</p>
                <p>Import workflows are user-initiated and respect Privacy Mode.</p>
                <p>No cloud account configuration is required for report and template management.</p>
                <p>Shortcut assignments shown in this Help page are dynamically synced from your current settings.</p>
            `
        },
        {
            id: 'help-security-privacy',
            title: 'Security and Privacy',
            content: `
                <p>ART follows an accessibility-first, privacy-by-default, and user-controlled security model.</p>
                <ul>
                    <li><strong>Privacy by Default:</strong> ART does not automatically transmit, upload, synchronize, or share user data.</li>
                    <li><strong>Non-Destructive Operation:</strong> ART does not automatically delete, rename, move, or overwrite external files.</li>
                    <li><strong>Data Ownership:</strong> Users retain ownership of data created, imported, exported, and managed in ART.</li>
                    <li><strong>External Integrations:</strong> Integrations require explicit user authorization and least-privilege permissions.</li>
                    <li><strong>Permission Transparency:</strong> ART explains requested integration permissions before opening provider authorization pages.</li>
                    <li><strong>Incremental Authorization:</strong> ART requests additional scopes only when you choose an action that needs them.</li>
                    <li><strong>Privacy Mode:</strong> Privacy Mode disables cloud connections and external integration activity.</li>
                    <li><strong>Backups and Restore:</strong> Backups contain ART-managed data only and remain under user control.</li>
                    <li><strong>Future Backup Encryption:</strong> ART plans optional encrypted backups for enterprise deployments and sensitive environments.</li>
                    <li><strong>Network Activity Indicator:</strong> Dashboard shows accessible connection status text and activity detail.</li>
                    <li><strong>Data Transmission Policy:</strong> ART informs users what is sent, where it is sent, and why before external transfer.</li>
                    <li><strong>What ART stores:</strong> ART-managed reports, templates, standards, settings, shortcuts, and security audit events.</li>
                    <li><strong>What ART does not transmit:</strong> Data is not transmitted to external services without explicit user approval.</li>
                    <li><strong>Enterprise Considerations:</strong> Security controls and audit events support governance and policy review.</li>
                </ul>
            `
        },
        {
            id: 'help-development-standards',
            title: 'Development Standards',
            content: `
                <p>ART is a non-destructive application. It is designed to assist users in creating, managing, and exporting accessibility information while preserving the integrity of user data and external files.</p>
            `
        },
        {
            id: 'help-accessibility',
            title: 'Accessibility',
            content: `
                <p>ART uses semantic regions, visible focus indicators, reduced-motion support, and high-contrast-friendly patterns.</p>
                <p>Known limitations and recommended workflows should be expanded over time as ART evolves.</p>
            `
        },
        {
            id: 'help-shortcuts',
            title: 'Keyboard Shortcuts',
            content: `
                <p>The list below is sorted alphabetically by command name and reflects current shortcut assignments.</p>
                <h3 id="help-shortcuts-quick-list">Shortcut Quick List</h3>
                <ul>${shortcutList}</ul>
                <h3 id="help-shortcuts-reference">Shortcut Reference</h3>
                <div class="help-table-wrapper">
                    <table>
                        <caption class="sr-only">ART shortcut command reference</caption>
                        <thead>
                            <tr>
                                <th scope="col">Command Name</th>
                                <th scope="col">Current Shortcut</th>
                                <th scope="col">Default Shortcut</th>
                                <th scope="col">Command Purpose</th>
                                <th scope="col">Customizable</th>
                                <th scope="col">Limitations</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shortcutTable}
                        </tbody>
                    </table>
                </div>
            `
        },
        {
            id: 'help-import-export',
            title: 'Import and Export',
            content: `
                <p>ART supports Project Workspace portability through Project.artproj and folder-based workspace organization.</p>
                <p>Workspace export supports Project Workspace Folder output and a portable JSON package path for browser-based ZIP-style workflows.</p>
                <p>Workspace import supports Project Workspace folders and Project.artproj-compatible payloads.</p>
                <p>ART also supports report and template workflows using .art (project payload) and .artx (template) formats.</p>
                <p>Open ART Project continues to support .art (project) files for report/project payload compatibility workflows.</p>
                <p>ZIP exports include the selected output format, ART JSON payload, an editable .art project file, and any report attachments under an attachments folder.</p>
                <p>Template exports (.artx and template JSON) also preserve Attachment field data, including attached files contained in the template payload.</p>
                <p>Import supports legacy report/template JSON and standards table workflows, including Settings-based standards import.</p>
                <p>ART validates format headers and version fields during import. Files may be rejected when formatVersion or schemaVersion is missing or not supported by the current ART version.</p>
                <p>Import and export workflows use local or network-accessible file locations selected by the user.</p>
                <p>Export output reflects current report values and selected layout at export time.</p>
            `
        },
        {
            id: 'help-progress-log-appendix',
            title: 'Progress Log Appendix',
            content: `
                <p>The Progress Log Appendix summarizes the active evaluation items that were attached to the report when export was generated.</p>
                <p>This appendix is optional and can be enabled from the Builder when the Progress Log is turned on.</p>
                <p>The appendix helps reviewers keep track of evaluation progress without mixing that workflow data into the report findings themselves.</p>
            `
        },
        {
            id: 'help-templates-reports',
            title: 'Templates and Reports',
            content: `
                <p>Templates accelerate report setup. Reports track current project findings and metrics.</p>
                <p>Dashboard actions provide configure, edit, view, and delete operations for active reports.</p>
            `
        },
        {
            id: 'help-wcag-lookup',
            title: 'Accessibility Lookup Tool',
            content: `
                <p>The Accessibility Lookup Tool supports search, filtering, and copy actions for criterion content.</p>
                <p>Criterion links open external resources in a new tab where supported.</p>
            `
        },
        {
            id: 'help-faq',
            title: 'Frequently Asked Questions',
            content: `
                <details>
                    <summary>How do I keep my custom shortcuts visible in Help?</summary>
                    <p>Shortcut entries in Help are generated from the same source used by Keyboard Shortcut Manager.</p>
                </details>
                <details>
                    <summary>Can Help stay open while I keep my report context?</summary>
                    <p>Yes. Help opens independently and does not switch your selected workflow tab.</p>
                </details>
                <details>
                    <summary>Can this FAQ be expanded later?</summary>
                    <p>Yes. This section is designed to be extended as ART evolves.</p>
                </details>
            `
        },
        {
            id: 'help-about-art',
            title: 'About ART',
            content: `
                <h3 id="help-about-art-name">ART (the Accessibility Reporting Tool)</h3>
                <p>The <strong>ART (the Accessibility Reporting Tool)</strong> was created to provide accessibility professionals, quality assurance testers, developers, designers, educators, and organizations with a streamlined, accessible, and efficient way to document, organize, and communicate accessibility evaluation results.</p>
                <p>ART was born from the recognition that many existing accessibility reporting workflows rely on generic office applications, spreadsheets, or tools that were not specifically designed for accessibility reporting. These approaches often require repetitive manual work, inconsistent formatting, and additional effort to produce reports that are both comprehensive and easy for others to understand. In addition, those few reporting systems which do exist which focus on accessibility tend to be inaccessible, hidden behind a pay wall, or whose interface and reporting structure is so rigidly set in place that it becomes unusable for most accessibility professionals.</p>
                <p>The goal of ART is to simplify that process by providing a dedicated application built specifically for creating, managing, and exporting accessibility reports. Rather than replacing accessibility expertise, ART is designed to support it by reducing administrative overhead and allowing evaluators to spend more time identifying issues, understanding standards, and communicating meaningful recommendations.</p>
                <p>The name <strong>ART</strong> reflects the craft and discipline of accessibility reporting. Producing high-quality reports requires careful observation, attention to detail, knowledge of accessibility standards, and the ability to communicate findings clearly to diverse audiences, making accessibility reporting an art form. ART aims to support that process by making report creation more efficient, more consistent, and more accessible.</p>
                <p>From its inception, ART has been guided by an accessibility-first philosophy. Accessibility and universal design are not optional features or enhancements added later; they are the foundation upon which every aspect of the application is designed, implemented, and evaluated. Keyboard accessibility, screen reader compatibility, semantic HTML, adherence to web standards, and support for a wide range of users are core principles that influence every design and development decision.</p>
                <p>ART is intended to serve users with a broad range of experience, from individuals learning accessibility evaluation to seasoned professionals conducting detailed audits for clients and organizations. The application emphasizes discoverability, efficiency, flexibility, and consistency while remaining approachable for new users.</p>
                <p>As an open-source project, ART welcomes community participation. Constructive feedback, accessibility testing, documentation improvements, bug reports, feature suggestions, and well-documented code contributions all play an important role in helping the project grow. The long-term success of ART depends upon collaboration with people who share a commitment to improving digital accessibility.</p>
                <p>The long-term vision for ART is to become a comprehensive, standards-based accessibility reporting platform that continues to evolve alongside WCAG, assistive technologies, and industry best practices. Future development will focus on expanding reporting capabilities, improving workflow efficiency, enhancing integrations with other tools and services, and maintaining a user experience that remains accessible to everyone.</p>
                <h3 id="help-about-art-credits">Project Credits</h3>
                <p>ART is the vision and project of <strong>Tristen Breitenfeldt</strong> (GitHub: <strong>Ripplelearning</strong>), who provides project management, user experience design, accessibility testing, quality assurance testing, and overall product direction.</p>
                <p>Development of ART is assisted by <strong>GitHub Copilot</strong>, which is used as an AI-assisted software development tool to support implementation and developer productivity.</p>
                <p>Planning, design refinement, accessibility guidance, workflow development, and documentation assistance have been supported through collaboration with <strong>ChatGPT</strong>.</p>
                <p>The ART project remains committed to providing a free, accessible, community-driven tool that helps make accessibility reporting more delightfully efficient, more consistent, and more usable for everyone.</p>
            `
        },
        {
            id: 'help-credits-oss',
            title: 'Licensing, Distribution, and Project Identity',
            content: `
                <h3 id="help-license-commitment">MIT License and Open Source Commitment</h3>
                <p>ART is released under the MIT License.</p>
                <p>The MIT License provides broad permission to use, modify, distribute, and incorporate ART into other projects, including commercial applications, subject to the terms of the license. A copy of the MIT License is included with the project and governs the use and distribution of the ART source code.</p>
                <p>Legal terms are defined in the top-level <strong>LICENSE</strong> file. This Help section focuses on project philosophy, contribution expectations, and project identity guidance.</p>

                <h3 id="help-license-distribution">Distribution Philosophy</h3>
                <p>Although the MIT License permits commercial use and redistribution, ART was created as a community-focused project intended to improve digital accessibility for everyone.</p>
                <p>The project encourages individuals, organizations, educators, and accessibility professionals to share ART freely whenever practical, helping make accessibility reporting more consistent, efficient, and accessible across the community.</p>
                <p>Commercial redistribution is permitted under the MIT License. However, distributors are encouraged to support the project's open and inclusive mission by preserving access to the original project, acknowledging its origins, and contributing improvements back to the community whenever possible.</p>

                <h3 id="help-license-attribution">Attribution and Ownership</h3>
                <p>If you distribute ART or a modified version of ART, you are encouraged to acknowledge the original project and its creator.</p>
                <p>The official ART project was conceived and is led by Tristen Breitenfeldt (GitHub: Ripplelearning), who provides project management, product vision, user experience (UX) design, accessibility design, accessibility testing, quality assurance (QA) testing, documentation direction, and overall project leadership.</p>
                <p>Development of ART is assisted by GitHub Copilot, which is used as an AI-assisted software development tool, and ChatGPT, which assists with planning, accessibility guidance, UX refinement, workflow design, feature specification, and documentation development.</p>

                <h3 id="help-license-identity">Project Identity</h3>
                <p>The name ART identifies the official project.</p>
                <p>If you create and distribute a substantially modified or forked version of ART, you are strongly encouraged to use a different project name and branding. Doing so helps avoid confusion between community-created derivatives and the official ART project.</p>
                <p>Using a distinct name also allows users to clearly identify which version they are using, where to report issues, and where to obtain official documentation and updates.</p>

                <h3 id="help-license-contributions">Community Contributions</h3>
                <p>Community participation is welcomed and appreciated.</p>
                <p>Contributions may include:</p>
                <ul>
                    <li>Bug reports</li>
                    <li>Feature requests</li>
                    <li>Accessibility testing</li>
                    <li>Documentation improvements</li>
                    <li>User experience feedback</li>
                    <li>Code contributions</li>
                    <li>Performance improvements</li>
                    <li>Compatibility testing</li>
                    <li>Translation and localization</li>
                    <li>Suggestions for improving usability</li>
                </ul>
                <p>Contributors are encouraged to document proposed changes thoroughly, explain the purpose of new functionality, and consider accessibility implications throughout the development process.</p>
                <p>Accessibility should remain a primary consideration for every contribution. New features and enhancements should strive to maintain or improve ART's usability for keyboard users, screen reader users, users with low vision, users with cognitive disabilities, and users of other assistive technologies.</p>

                <h3 id="help-license-values">Community Values</h3>
                <p>ART is built on the belief that accessibility should be practical, collaborative, and available to everyone.</p>
                <p>The project values:</p>
                <ul>
                    <li>Accessibility-first design</li>
                    <li>Inclusive user experiences</li>
                    <li>Open collaboration</li>
                    <li>Thoughtful documentation</li>
                    <li>Standards-based development</li>
                    <li>Continuous learning and improvement</li>
                    <li>Respectful community participation</li>
                </ul>
                <p>Everyone is welcome to contribute ideas, feedback, testing, documentation, and code that helps ART better serve the accessibility community.</p>
            `
        },
        {
            id: 'help-technology',
            title: 'Technology Documentation',
            content: `
                <ul>
                    <li>Vanilla JavaScript modules manage rendering, state, and workflow logic.</li>
                    <li>Local storage persists report data, settings, and shortcut assignments.</li>
                    <li>SheetJS and JSZip support export packaging and spreadsheet output.</li>
                    <li>Typo.js and Hunspell dictionary data support spell-check workflows.</li>
                    <li>AI tools can assist planning and implementation but do not own project authorship.</li>
                </ul>
            `
        },
        {
            id: 'help-future-development',
            title: 'Future Development',
            content: `
                <p>ART is an actively evolving project whose long-term vision is to become a comprehensive, accessible, and standards-focused platform for creating, managing, and sharing accessibility reports. Future development will continue to be guided by user feedback, evolving accessibility standards, and the practical needs of accessibility professionals.</p>
                <p>Current priorities include:</p>
                <ul>
                    <li>Continuing to improve keyboard accessibility and screen reader support throughout the application.</li>
                    <li>Expanding report creation, editing, and export capabilities.</li>
                    <li>Improving template management and report customization.</li>
                    <li>Enhancing documentation and in-application Help.</li>
                    <li>Expanding the Accessibility Lookup Tool with additional guidance and reference information.</li>
                    <li>Supporting additional import and export formats and integrations where they provide meaningful value.</li>
                    <li>Improving workflow efficiency for both individual evaluators and collaborative teams.</li>
                    <li>Maintaining compliance with current and future accessibility standards and best practices.</li>
                    <li>Improving application performance, reliability, and maintainability.</li>
                    <li>Expanding automated and manual accessibility testing.</li>
                    <li>Encouraging community participation through thoughtful feature requests, accessibility feedback, documentation improvements, testing, and well-documented code contributions.</li>
                </ul>
                <p>As ART grows, future roadmap priorities may include cloud integrations, project management integrations, additional reporting capabilities, localization, and other enhancements identified through community feedback and project goals.</p>
                <p>The roadmap is intentionally flexible and may evolve as user needs, accessibility standards, and available technologies change. Feature priorities will be determined by their ability to improve usability, accessibility, maintainability, and the overall value of ART for its users.</p>
            `
        },
        {
            id: 'help-maintenance',
            title: 'Documentation Maintenance',
            content: `
                <ul>
                    <li>Update Help content whenever features, workflows, or exports change.</li>
                    <li>Shortcut references are generated from live shortcut definitions and remain synchronized with Keyboard Shortcut Manager.</li>
                    <li>Add new sections instead of overloading existing ones as ART scope expands.</li>
                </ul>
            `
        }
    ];
}

function buildTocMarkup(sections) {
    return `
        <div class="help-toc-header">
            <h3 id="help-toc-heading">Contents</h3>
            <label for="help-search">Find in Help</label>
            <input id="help-search" type="search" placeholder="Search headings and content">
        </div>
        <ul aria-labelledby="help-toc-heading">
            ${sections.map((section) => `<li><a href="#${section.id}">${escapeHtml(section.title)}</a></li>`).join('')}
        </ul>
    `;
}

function buildContentMarkup(sections) {
    return sections
        .map((section) => `
            <section id="${section.id}" aria-labelledby="${section.id}-heading" data-help-section>
                <h2 id="${section.id}-heading">${escapeHtml(section.title)}</h2>
                ${section.content}
            </section>
        `)
        .join('');
}

function bindHelpSearch() {
    const input = document.getElementById('help-search');
    const toc = document.getElementById('help-toc');
    const sections = Array.from(document.querySelectorAll('[data-help-section]'));
    if (!input || !toc || sections.length === 0) return;

    input.addEventListener('input', () => {
        const query = String(input.value || '').trim().toLowerCase();

        sections.forEach((section) => {
            const text = section.textContent?.toLowerCase() || '';
            const visible = !query || text.includes(query);
            section.hidden = !visible;
        });

        toc.querySelectorAll('a[href^="#help-"]').forEach((link) => {
            const targetId = link.getAttribute('href')?.slice(1) || '';
            const target = document.getElementById(targetId);
            const item = link.closest('li');
            if (!item || !target) return;
            item.hidden = Boolean(query) && target.hidden;
        });
    });
}

function bindTocAnchors() {
    const toc = document.getElementById('help-toc');
    if (!toc) return;

    toc.querySelectorAll('a[href^="#help-"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href) return;
            const target = document.querySelector(href);
            if (!target) return;

            const headingId = target.getAttribute('aria-labelledby') || '';
            const heading = headingId
                ? document.getElementById(headingId)
                : target.querySelector('h1, h2, h3, h4, h5, h6');

            event.preventDefault();
            if (heading) {
                if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
                heading.focus({ preventScroll: true });
            }
            target.scrollIntoView({ block: 'start' });
            window.history.replaceState(null, '', href);
        });
    });
}

function renderHelpDocumentation() {
    const toc = document.getElementById('help-toc');
    const content = document.getElementById('help-content');
    if (!toc || !content) return;

    const rows = getCommandRows();
    const sections = getHelpSections(rows);
    toc.innerHTML = buildTocMarkup(sections);
    content.innerHTML = buildContentMarkup(sections);

    bindHelpSearch();
    bindTocAnchors();
}

function closeHelpDialog(restoreFocus = true) {
    const dialog = document.getElementById('help-dialog');
    if (!dialog) return;
    dialog.hidden = true;
    if (previousDocumentTitle) {
        document.title = previousDocumentTitle;
        previousDocumentTitle = '';
    }
    if (restoreFocus && lastHelpTrigger && typeof lastHelpTrigger.focus === 'function') {
        lastHelpTrigger.focus();
    }
}

export function openHelpDialog(trigger = null) {
    const dialog = document.getElementById('help-dialog');
    const closeButton = document.getElementById('btn-help-close');
    const content = document.getElementById('help-content');
    if (!dialog || !closeButton || !content) return;

    if (trigger) lastHelpTrigger = trigger;
    renderHelpDocumentation();
    if (!previousDocumentTitle) previousDocumentTitle = document.title;
    document.title = 'User Guide | ART Version 1.5';
    dialog.hidden = false;

    window.setTimeout(() => {
        closeButton.focus();
        announce('Help opened.');
    }, 0);
}

export function initHelp() {
    if (helpInitialized) return;
    const helpButton = document.getElementById('btn-help');
    const closeButton = document.getElementById('btn-help-close');
    const dialog = document.getElementById('help-dialog');

    renderHelpDocumentation();

    helpButton?.addEventListener('click', () => {
        openHelpDialog(helpButton);
    });

    closeButton?.addEventListener('click', () => {
        closeHelpDialog(true);
    });

    dialog?.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeHelpDialog(true);
    });

    window.addEventListener('art-shortcuts-updated', () => {
        if (!dialog || dialog.hidden) return;
        renderHelpDocumentation();
    });

    helpInitialized = true;
}
