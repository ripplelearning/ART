// navigation.js
import { renderWelcome } from './welcome.js';
import { renderBuilder } from './reportBuilder.js';

/**
 * Attaches click listeners to all tab buttons to switch views.
 */
export function setupTabs() {
    const tabs = document.querySelectorAll('[role="tab"]');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Update aria-selected states
            tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
            tab.setAttribute('aria-selected', 'true');
            
            // 2. Clear and render the appropriate view
            const container = document.getElementById('main-inner');
            container.innerHTML = ''; 
            
            if (tab.id === 'tab-welcome') {
                renderWelcome();
            } else if (tab.id === 'tab-builder') {
                renderBuilder();
            }
            // Future tabs (Editor, View/Export) can be added here
        });
    });
}

/**
 * Handles global Ctrl+F6 navigation between major landmarks.
 */
export function initNavListener() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            
            // List of landmarks to cycle through
            const landmarks = [
                document.querySelector('nav'),
                document.getElementById('dashboard'),
                document.getElementById('main-content'),
                document.getElementById('lookup-tool')
            ].filter(l => l && l.offsetParent !== null); // Only include visible ones

            // Find current landmark
            let activeIdx = landmarks.findIndex(l => l.contains(document.activeElement));
            
            // Calculate next index
            let nextIdx = (activeIdx === -1 || activeIdx >= landmarks.length - 1) ? 0 : activeIdx + 1;
            
            // Find focusable element or default to the landmark itself
            const target = landmarks[nextIdx].querySelector('button, input, select, textarea, [tabindex]') || landmarks[nextIdx];
            target.focus();
        }
    });
}
