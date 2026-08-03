# ART Command Reference

ART 2.0 uses application commands as the shared execution layer for user actions.

## Command Categories

### Application
- `openWelcome`
- `openCommandPalette`
- `focusMenuBar`
- `focusMenuSearch`
- `openBuilder`
- `openEditor`
- `openViewer`
- `focusNavigation`
- `focusDashboard`
- `configureDashboard`
- `continueWorking`
- `focusMainContent`
- `nextLandmark`
- `previousLandmark`

### Search
- `searchEverywhere`
- `searchCurrentReport`
- `searchCurrentProjectWorkspace`
- `searchAllProjects`
- `searchAccessibilityStandards`
- `searchHelpDocumentation`
- `searchCommands`
- `searchKeyboardShortcuts`
- `searchProjectAssets`
- `searchTemplates`
- `searchDashboard`
- `findInCurrentResource`
- `findNextMatch`
- `findPreviousMatch`
- `nextSearchResult`
- `previousSearchResult`
- `clearSearchHighlights`
- `clearSearchHistory`
- `saveCurrentSearch`
- `openSavedSearches`

### Workspace
- `newProjectWorkspace`
- `openProjectWorkspace`
- `openRecentProjectWorkspace`
- `closeProjectWorkspace`
- `saveProjectWorkspace`
- `saveProjectWorkspaceAs`
- `renameProjectWorkspace`
- `duplicateProjectWorkspace`
- `importProjectWorkspace`
- `exportProjectWorkspace`
- `deleteProjectWorkspace`
- `addProjectAsset`
- `createAssetFolder`
- `removeProjectAsset`
- `refreshWorkspaceAssets`
- `openProjectProperties`
- `openProjectStatistics`
- `openWorkspaceSettings`

### Report
- `newReport`
- `newReportFromTemplate`
- `openProject`
- `saveProject`
- `saveProjectAs`
- `importData`
- `openReport`
- `exportReport`
- `printPreview`
- `closeReport`
- `configureReport`
- `editReport`
- `viewReport`
- `deleteReport`
- `addField`
- `done`
- `addEntry`
- `attachFile`
- `validateReport`
- `reportStatistics`
- `openWorkingView`
- `exitWorkingView`
- `applyWorkingView`
- `saveWorkingView`
- `loadWorkingView`
- `deleteWorkingView`
- `refreshWorkingView`
- `resetWorkingView`
- `batchSetWorkingViewStatus`
- `batchAssignWorkingViewReviewer`
- `batchSetWorkingViewSeverity`
- `batchAddWorkingViewTag`
- `nextWorkingViewFinding`
- `previousWorkingViewFinding`
- `nextWorkingViewGroup`
- `previousWorkingViewGroup`
- `revealWorkingViewInExplorer`
- `revealWorkingViewInReport`
- `expandAllWorkingViewGroups`
- `collapseAllWorkingViewGroups`
- `setStandardReportView`
- `setWorkingReportView`
- `setOutlineReportView`
- `setCompactReportView`
- `setExpandedReportView`
- `setReadingReportView`
- `setReviewReportView`
- `toggleReportViewMode`

### Template
- `newTemplate`
- `useTemplate`
- `openTemplate`
- `editTemplate`
- `deleteTemplate`
- `importTemplate`
- `exportTemplate`

### Settings
- `openSettings`
- `settingsClose`
- `settingsRestoreShortcuts`
- `settingsImportStandard`
- `settingsPasteStandardTable`
- `settingsImportReportFile`
- `settingsImportTemplateFile`
- `settingsOpenIntegrations`
- `settingsPluginInstall`
- `settingsPluginValidate`
- `settingsPluginRefresh`
- `settingsPluginExportConfig`
- `settingsPluginImportConfig`
- `settingsTogglePrivacyMode`
- `settingsCreateBackup`
- `settingsResetApp`
- `settingsCloseReport`

### Lookup
- `focusLookup`
- `resetLookup`
- `copyEntry`
- `copyName`
- `copyDescription`
- `copyFailures`
- `copyFixes`
- `copyLink`

### Tools
- `openHelp`
- `openProgressLog`
- `spellCheck`
- `spellReplace`
- `spellReplaceAll`
- `spellIgnore`
- `spellIgnoreAll`
- `spellAddToDictionary`
- `spellUndoLastCorrection`
- `spellCancel`

## Command Behavior

- Commands are registered centrally in [commandCatalog.js](commandCatalog.js).
- Commands are executed through [commandExecutionService.js](commandExecutionService.js).
- Keyboard shortcuts resolve to commands through the same execution layer.
- The Command Palette is a registered Application Command and opens with Ctrl+Shift+P by default.
- The Command Palette displays the current shortcut assignments from the Keyboard Shortcut Manager.
- The Menu Bar and Menu Bar Command Search are registered Application Commands and use the shared command search engine.
- Global Context Menus are generated from the same Application Command Framework and context providers, rather than hard-coded menu lists.
- Context menu items show the current shortcut assignment when one exists.
- Search Everywhere and scope-specific search commands run through the Universal Search Framework provider registry.
- Search result surfaces use a shared Search Results Framework for consistent keyboard behavior and status announcements.
- Menu Bar focus uses F10, with Alt+/ as an alternate shortcut in the web application.
- Menu Bar Command Search uses Alt+Q.
- Project Workspace lifecycle and Project Asset operations are also registered commands, so they are available in Menu Bar, Command Search, Command Palette, and shortcut customization.
- UI controls should prefer command execution instead of duplicating workflow logic.
