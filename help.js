import { announce, getAssignableActions, getShortcutDefinitions } from './state.js';

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
    const shortcutList = buildShortcutListMarkup(rows);
    const shortcutTable = buildShortcutTableMarkup(rows);

    return [
        {
            id: 'help-getting-started',
            title: 'Getting Started',
            content: `
                <p>ART is an accessibility-first reporting workspace for building accessibility audits, managing report data, and exporting documentation in multiple formats.</p>
                <p>Use Dashboard actions to create or open reports, then use the panel tabs for Builder, Editor, Viewer, and Help tasks.</p>
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
            id: 'help-features-workflows',
            title: 'Features and Workflows',
            content: `
                <ul>
                    <li>Create or open reports from Dashboard.</li>
                    <li>Configure report metadata and fields in Builder.</li>
                    <li>Record and edit findings in Editor.</li>
                    <li>Export reports from Viewer with current live data.</li>
                    <li>Use the Accessibility Lookup Tool for criterion lookup and copy workflows.</li>
                </ul>
            `
        },
        {
            id: 'help-settings-config',
            title: 'Settings and Configuration',
            content: `
                <p>Application Settings includes Keyboard Shortcut Manager, imported standards, the Paste Standards As Table workflow for clipboard tables, Security and Privacy controls, Integrations, Administrator Tools, and About metadata.</p>
                <p>If assigned in Keyboard Shortcut Manager, the Paste Standards As Table action can be opened directly with its configured shortcut.</p>
                <p>Google Workspace integration is optional and does not block local report workflows when disconnected.</p>
                <p>The Google Workspace integration flow does not require end users to configure OAuth client IDs, secrets, API keys, redirect URIs, or scopes.</p>
                <p>Use Connect Google Workspace to start authorization, review requested permissions in ART before redirect, confirm the connected account, and disconnect when needed.</p>
                <p>When disconnected, the Google modal shows an email field used for connect authorization. If a previously connected account exists, its email is prefilled and can be edited before reconnecting.</p>
                <p>Use explicit Import actions in Settings > Integrations to import ART report JSON files and template JSON files from Google Drive, and to import standards tables from Google Sheets.</p>
                <p>Google import workflows are user-initiated only and require an active connection with Privacy Mode disabled.</p>
                <p>ART uses incremental authorization. Additional scopes are requested only when you choose features that need them, such as importing standards from Google Sheets.</p>
                <p>Developer OAuth build configuration is isolated from user settings and documented separately for developers.</p>
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
                <p>ART supports report and template import workflows, the Settings-based standards table import workflow, and multi-format report export.</p>
                <p>When Google Workspace is connected, export can upload the ZIP package directly to Google Drive after explicit user approval.</p>
                <p>Google operations follow an explicit import/edit/export model and do not automatically synchronize or merge external documents.</p>
                <p>Export output reflects current report values and selected layout at export time.</p>
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
                <h3 id="help-about-art-name">Accessibility Reporting Tool (ART)</h3>
                <p>The <strong>Accessibility Reporting Tool (ART)</strong> was created to provide accessibility professionals, quality assurance testers, developers, designers, educators, and organizations with a streamlined, accessible, and efficient way to document, organize, and communicate accessibility evaluation results.</p>
                <p>ART was born from the recognition that many existing accessibility reporting workflows rely on generic office applications, spreadsheets, or tools that were not specifically designed for accessibility reporting. These approaches often require repetitive manual work, inconsistent formatting, and additional effort to produce reports that are both comprehensive and easy for others to understand. In addition, those few reporting systems which do exist which focus on accessibility tend to be inaccessible, hidden behind a pay wall, or whose interface and reporting structure is so rigidly set in place that it becomes unusable for most accessibility professionals.</p>
                <p>The goal of ART is to simplify that process by providing a dedicated application built specifically for creating, managing, and exporting accessibility reports. Rather than replacing accessibility expertise, ART is designed to support it by reducing administrative overhead and allowing evaluators to spend more time identifying issues, understanding standards, and communicating meaningful recommendations.</p>
                <p>The name <strong>ART</strong> stands for <strong>Accessibility Reporting Tool</strong>. The name was chosen because accessibility reporting is both a technical discipline and a craft. Producing high-quality reports requires careful observation, attention to detail, knowledge of accessibility standards, and the ability to communicate findings clearly to diverse audiences, making the field of accessibility an art-form. ART aims to support that process by making report creation more efficient, more consistent, and more accessible.</p>
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
                <p>The Accessibility Reporting Tool (ART) is released under the MIT License.</p>
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
                <p>The name Accessibility Reporting Tool (ART) identifies the official project.</p>
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
                <p>As ART grows, future roadmap priorities may include cloud integrations, project management integrations, additional reporting capabilities, localization, plugin or extension support, and other enhancements identified through community feedback and project goals.</p>
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
