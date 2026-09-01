# Epic 50 Quick Reference Guide
## ART Identity, Organization Folders, and File-Based Collaboration

---

## Framework Quick Reference

### 1. Identity & Profiles
**File**: `identityFramework.js`
```javascript
import { getLocalUserProfile, updateLocalUserProfile } from './identityFramework.js';

// Get current user
const profile = getLocalUserProfile();
// Returns: { localUserId, name, displayName, email, jobTitle, artRole, ... }

// Update profile
updateLocalUserProfile({ displayName: 'New Name', artRole: 'Tester' });
```

### 2. Document Metadata
**File**: `documentRevisionFramework.js`
```javascript
import { createDocumentMetadata, createRevision } from './documentRevisionFramework.js';

// Create new document
const doc = createDocumentMetadata({
    organizationId: 'org-123',
    isCollaborative: true
});

// Add revision
const revision = createRevision({
    documentId: doc.documentId,
    author: profile,
    changeDescription: 'Updated report findings'
});
```

### 3. Three-Way Merge
**File**: `fileBasedCollaborationFramework.js`
```javascript
import { performThreeWayMerge, prepareRefreshFromSharedFile } from './fileBasedCollaborationFramework.js';

// Check what to do
const refreshResult = prepareRefreshFromSharedFile({
    localDocument: myDoc,
    sharedDocument: sharedDoc,
    ancestorDocument: ancestorDoc
});

if (refreshResult.action === 'auto-merge') {
    // Merge successful
    const merge = performThreeWayMerge({...});
    console.log(`Merged ${merge.nonConflictingChanges.length} changes`);
}

if (refreshResult.action === 'conflict-resolution-required') {
    // Open merge dialog - conflicts need user resolution
}
```

### 4. Refresh Workflow
**File**: `refreshWorkflowEngine.js`
```javascript
import { executeRefreshWorkflow } from './refreshWorkflowEngine.js';

const result = await executeRefreshWorkflow({
    localDocument: currentDoc,
    sharedDocument: externalDoc,
    ancestorDocument: baselineDoc,
    trigger: clickedButton
});

// Result contains: { success, action, document, changesSummary, etc. }
console.log(result.changesSummary);
// { localChanges: 2, externalChanges: 3, conflictCount: 0, autoMergedCount: 5 }
```

### 5. Shared Tasks
**File**: `sharedTasksFramework.js`
```javascript
import { mergeTaskCollections, addCommentToTask, assignTask } from './sharedTasksFramework.js';

// Merge three versions of tasks
const result = mergeTaskCollections(baseTasks, localTasks, sharedTasks);

// Add comment
const updated = addCommentToTask(task, { text: 'Needs review', mentions: [reviewer] });

// Assign task
const assigned = assignTask(task, assignee);
```

### 6. @Mentions System
**File**: `mentionsFramework.js`
```javascript
import { findCollaborators, parseMentions, renderMentionSuggestions } from './mentionsFramework.js';

// Get mention suggestions
const suggestions = findCollaborators('@jo', { context: 'document' });
// Returns: [{ userId, displayName, email, jobTitle, artRole, ... }]

// Render for UI
const html = renderMentionSuggestions(suggestions);

// Parse text for mentions
const mentions = parseMentions('Hey @john and @sarah, please review');
// Returns: [{ text: '@john', name: 'john', ... }, { text: '@sarah', name: 'sarah', ... }]
```

### 7. Organization Folders
**File**: `state.js`
```javascript
import { getOrganizationFoldersConfig, updateOrganizationFoldersConfig } from './state.js';

// Get current config
const config = getOrganizationFoldersConfig();
// Returns: { configured, folderPath, organizationId, organizationName, includeSubfolders, ... }

// Update config
updateOrganizationFoldersConfig({
    folderPath: '/path/to/folder',
    organizationName: 'My Team',
    includeSubfolders: true
});

// Listen for updates
document.addEventListener('art-organization-folders-updated', (e) => {
    console.log('Folder config changed:', e.detail);
});
```

### 8. Manifest
**File**: `organizationManifestFramework.js`
```javascript
import { createOrganizationManifest, validateOrganizationManifest } from './organizationManifestFramework.js';

// Create manifest
const manifest = createOrganizationManifest({
    organizationName: 'Accessibility Team',
    description: 'Q4 audit reports'
});

// Validate
const validation = validateOrganizationManifest(manifest);
console.log(validation.valid); // true or false
console.log(validation.errors); // Array of error messages

// Add collaborator
const updated = addCollaboratorToManifest(manifest, {
    userId: 'user-123',
    displayName: 'John Doe',
    email: 'john@example.com'
});
```

### 9. File Discovery
**File**: `organizationFileDiscoveryFramework.js`
```javascript
import { discoverOrganizationFiles, classifyArtFile } from './organizationFileDiscoveryFramework.js';

// Discover files in organization folder
const result = await discoverOrganizationFiles({ forceRefresh: false });
console.log(`Found ${result.files.length} files`);

// Classify a file
const classification = classifyArtFile('my_report_q4.art', {});
// Returns: { fileType: 'report', category: 'reports', isArtFile: true, ... }

// Get summary
const summary = calculateDiscoverySummary(files);
// Returns: { totalFiles, totalArtFiles, totalSize, byCategory, byType }
```

### 10. Progress Log Collaboration
**File**: `sharedProgressLogMergeExtensions.js`
```javascript
import { mergeProgressLogEntries, detectProgressLogChanges } from './sharedProgressLogMergeExtensions.js';

// Detect changes
const changes = detectProgressLogChanges(baselineLog, currentLog);
console.log(`${changes.changeCount} changes detected`);

// Merge three versions
const result = mergeProgressLogEntries(baselineEntries, localEntries, sharedEntries);
console.log(`${result.conflicts.length} conflicts detected`);

// Resolve conflict
const resolved = resolveProgressConflict(conflict, 'merged', mergedEntry);
```

---

## Common Workflows

### Workflow 1: User Opens Document
```javascript
// 1. Load local document
const localDoc = loadDocument(docId);

// 2. Check for external changes
const metadata = getCollaborationMetadata();
if (!metadata.isCollaborative) return; // Not shared

// 3. Load shared version from folder
const sharedDoc = loadFromOrganizationFolder(metadata.sharedFilePath);

// 4. Get ancestor if exists
const ancestorDoc = loadAncestor(metadata.lastSyncedRevision);

// 5. Execute refresh
const result = await executeRefreshWorkflow({
    localDocument: localDoc,
    sharedDocument: sharedDoc,
    ancestorDocument: ancestorDoc,
    trigger: document.getElementById('btn-refresh')
});

// 6. Handle result
if (result.action === 'conflict-resolution-required') {
    // Merge dialog will open automatically
    announce(`${result.conflictCount} conflicts require resolution`);
}
```

### Workflow 2: User Saves Document
```javascript
// 1. Create change
const changes = detectDocumentChanges(lastSavedDoc, currentDoc);

// 2. Create change set
const changeSet = createChangeSet({
    documentId: doc.documentId,
    changes,
    summary: 'Updated findings section'
});

// 3. Create new revision
const revision = createRevision({
    documentId: doc.documentId,
    parentRevisionId: doc.currentRevisionId,
    author: profile,
    changeType: 'modified',
    changeDescription: changeSet.summary
});

// 4. Update document
const updated = {
    ...currentDoc,
    currentRevisionId: revision.revisionId,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: profile
};

// 5. Save locally
saveDocument(updated);

// 6. If collaborative, save to shared folder
if (getCollaborationMetadata().isCollaborative) {
    saveToOrganizationFolder(updated);
    updateCollaborationMetadata({
        lastSyncedRevision: revision.revisionId
    });
}

announce('Document saved');
```

### Workflow 3: User Mentions Collaborator
```javascript
// 1. User types @name in comment
const text = user-input; // "Hey @john, can you review?"

// 2. Parse mentions
const mentions = parseMentions(text);

// 3. For each mention, get suggestions
const suggestions = findCollaborators(mentions[0].name, { context: 'document' });

// 4. User selects from suggestions
const selected = suggestions[0];

// 5. Resolve mention
const resolved = resolveMention(mentions[0], selected);

// 6. Replace in text
let processedText = text;
const replaced = replaceMentionWithMarkup(processedText, resolved);
// Result: "Hey <span class="mention" data-user-id="user-123">@john</span>, can you review?"

// 7. Save comment with mention
const comment = addCommentToTask(task, {
    text: replaced,
    mentions: [resolved]
});
```

### Workflow 4: User Configures Organization Folder
```javascript
// 1. User clicks "Select Folder" button
// showDirectoryPicker() is called by settings.js

// 2. User selects folder via File Picker API
// Event handler calls updateOrganizationFoldersConfig()

// 3. Create organization manifest
const manifest = createOrganizationManifest({
    organizationName: config.organizationName,
    description: 'Accessibility audit workspace'
});

// 4. Save manifest to folder
// saveToOrganizationFolder('.art-organization.json', manifest)

// 5. Update state
updateOrganizationFoldersConfig({
    folderPath: selectedPath,
    organizationId: manifest.organizationId,
    lastRefreshed: new Date().toISOString()
});

// 6. Emit event for UI refresh
document.dispatchEvent(new CustomEvent('art-organization-folders-updated', {
    detail: getOrganizationFoldersConfig()
}));

announce('Organization folder configured');
```

---

## Event Listeners

### Organization Folder Updates
```javascript
document.addEventListener('art-organization-folders-updated', (e) => {
    const config = e.detail;
    console.log(`Organization: ${config.organizationName}`);
    refreshSettingsView();
});
```

### Collaboration Metadata Updates
```javascript
document.addEventListener('art-collaboration-metadata-updated', (e) => {
    const metadata = e.detail;
    if (metadata.mergeInProgress) {
        showLoadingIndicator();
    } else {
        hideLoadingIndicator();
    }
});
```

---

## Keyboard Shortcuts

| Shortcut | Command | Function |
|----------|---------|----------|
| Ctrl+Shift+R | refreshFromSharedFile | Refresh from shared folder |
| (Custom) | checkForExternalChanges | Check for external updates |
| (Custom) | viewVersionHistory | View revision history |
| (Custom) | configureOrganizationFolder | Open organization folder settings |
| (Custom) | refreshOrganizationMetrics | Rescan organization folder |

Users can customize shortcuts in Settings > Keyboard Shortcuts.

---

## Error Handling

### Common Errors & Solutions

**Error: "Merge failed: Cannot read property 'fields' of undefined"**
- Cause: Ancestor document is malformed
- Solution: Ensure `normalizeDocument()` is called before merge

**Error: "Organization folder not configured"**
- Cause: User hasn't set up organization folder yet
- Solution: Prompt user to configure in Settings > Organization Folders

**Error: "Merge conflict resolution failed"**
- Cause: Invalid conflict resolution choice
- Solution: Validate resolution method is 'local', 'other', or 'merged'

**Error: "File discovery in progress"**
- Cause: User clicked refresh multiple times
- Solution: Debounce button clicks or show disabled state

---

## Performance Notes

### Merge Performance
- Small documents (< 100 fields): < 10ms
- Medium documents (100-1000 fields): 10-100ms
- Large documents (> 1000 fields): 100-500ms
- **Optimization**: Flatten objects only for comparison, don't store flattened

### File Discovery Performance
- Scanning 100 files: ~500ms
- Scanning 1000 files: ~5s (with caching reduces to 1s on repeat)
- **Optimization**: Implement pagination, background scanning, incremental updates

### Cache Effectiveness
- Default cache: 1 minute expiration
- Discovery cache: Reduces repeat scans by 80%
- Metrics cache: Reduces calculations by 90%

---

## Testing Utilities

### Manual Testing Commands

```javascript
// Test three-way merge
const result = performThreeWayMerge({
    ancestorDocument: { title: 'Original', status: 'pending' },
    localDocument: { title: 'My Update', status: 'pending' },
    sharedDocument: { title: 'Original', status: 'approved' }
});
console.log(result); // Should show auto-merge with status changed

// Test mention parsing
const mentions = parseMentions('Hey @john @jane and @bob');
console.log(mentions.length); // Should be 3

// Test organization folder validation
const manifest = createOrganizationManifest({ organizationName: 'Test' });
const validation = validateOrganizationManifest(manifest);
console.log(validation.valid); // Should be true

// Test task merge
const merged = mergeTaskCollections([], [{taskId: '1', name: 'Task 1'}], []);
console.log(merged.mergedTasks.length); // Should be 1
```

---

## Debugging Tips

### Enable Detailed Logging
```javascript
// Add to browser console:
window.DEBUG_EPIC50 = true;

// In frameworks, add:
if (window.DEBUG_EPIC50) console.log('Debug info:', data);
```

### Inspect Merge Conflicts
```javascript
// In browser console, after merge dialog opens:
const dialogState = window.mergeConflictDialog;
console.log(dialogState.result.conflicts);
```

### Check Collaboration Metadata
```javascript
// See current sync status:
console.log(getCollaborationMetadata());

// See if changes pending:
console.log(getRefreshWorkflowStatus());
```

### Validate File Structure
```javascript
// Verify document structure:
const validation = validateOrganizationManifest(manifest);
console.log(validation.errors); // See what's wrong
```

---

## Related Documentation

- **Architecture**: See ARCHITECTURE.md
- **Development Standards**: See ART-Development-Standards.md
- **Definition of Done**: See ART-Definition-of-Done.md
- **User Guide**: See USER-GUIDE.md in art-help/
- **Commands**: See COMMANDS.md
- **Help**: In-app Help > File-Based Collaboration

---

## Version & Support

- **Epic 50 Version**: 1.0.0
- **ART Version**: 1.5+
- **Node.js**: Not required (browser-based)
- **Browser Support**: Modern browsers with ES6 support

---

*Last Updated: 2026-09-01*
*Maintained by: ART Development Team*
