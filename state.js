// state.js

// Initializing the application state from local storage or defaults
export let appState = JSON.parse(localStorage.getItem('art-state')) || {
    reportTitle: "",
    orgClient: "",
    projectName: "",
    scopeUrl: "",
    auditDateStart: "",
    auditDateEnd: "",
    auditors: "",
    standard: "WCAG 2.2",
    testingInstructions: "",
    fields: [],
    editingIndex: -1
};

/**
 * Persists current state to local browser storage.
 */
export function saveState() {
    localStorage.setItem('art-state', JSON.stringify(appState));
}

/**
 * Updates an announcer element (for screen readers).
 */
export function announce(msg) {
    const announcer = document.getElementById('announcer');
    if (announcer) announcer.textContent = msg;
}

/**
 * Updates a specific metadata field and persists the change.
 */
export function updateHeader(key, val) {
    appState[key] = val;
    saveState();
}

// --- Field Management Logic ---

/**
 * Adds a new field or updates an existing one based on editingIndex.
 */
export function addOrUpdateField() {
    const labelInput = document.getElementById('field-label-input');
    const typeInput = document.getElementById('field-type-input');
    
    if (!labelInput || !labelInput.value) return;

    if (appState.editingIndex === -1) {
        // Add new field
        appState.fields.push({ label: labelInput.value, type: typeInput.value });
        announce(`Added field ${labelInput.value}`);
    } else {
        // Update existing field
        appState.fields[appState.editingIndex] = { label: labelInput.value, type: typeInput.value };
        appState.editingIndex = -1; // Reset mode
        announce("Field updated");
    }
    
    saveState();
}

/**
 * Sets the builder into edit mode for a specific field.
 */
export function setEditMode(index) {
    appState.editingIndex = index;
    const field = appState.fields[index];
    
    // UI synchronization
    const labelInput = document.getElementById('field-label-input');
    const typeInput = document.getElementById('field-type-input');
    const btnAdd = document.getElementById('btn-add-field');
    
    if (labelInput) labelInput.value = field.label;
    if (typeInput) typeInput.value = field.type;
    if (btnAdd) btnAdd.textContent = 'Apply Changes';
    
    announce(`Editing ${field.label}`);
}

/**
 * Removes a field from the state.
 */
export function deleteField(index) {
    const removed = appState.fields.splice(index, 1);
    saveState();
    announce(`Deleted ${removed[0].label}`);
}

/**
 * Moves a field up or down in the array.
 */
export function moveField(index, direction) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= appState.fields.length) return;
    
    const field = appState.fields.splice(index, 1)[0];
    appState.fields.splice(newIdx, 0, field);
    saveState();
    announce("Field moved");
}
