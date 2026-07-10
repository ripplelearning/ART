// loader.js
import { initNavListener } from './navigation.js';
import { renderDashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavListener();
    renderDashboard();
    console.log("ART System Initialized.");
});
