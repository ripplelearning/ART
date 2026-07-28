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
- `focusMainContent`
- `nextLandmark`
- `previousLandmark`

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
- `validateReport`
- `reportStatistics`

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
- Menu Bar focus uses F10, with Alt+/ as an alternate shortcut in the web application.
- Menu Bar Command Search uses Alt+Q.
- UI controls should prefer command execution instead of duplicating workflow logic.
