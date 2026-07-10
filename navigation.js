// navigation.js
const landmarks = ['nav', 'dashboard', 'main-content', 'lookup-tool'];

export function initNavigation() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;
            navigateLandmarks(direction);
        }
    });
}

function navigateLandmarks(direction) {
    const activeEl = document.activeElement;
    let currentIndex = landmarks.findIndex(id => activeEl.closest(`#${id}`));

    // Default to the first landmark if no landmark is currently focused
    if (currentIndex === -1) currentIndex = 0;

    let nextIndex = currentIndex + direction;

    // Handle circular navigation
    if (nextIndex >= landmarks.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = landmarks.length - 1;

    const targetId = landmarks[nextIndex];
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
        if (!targetElement.hasAttribute('tabindex')) {
            targetElement.setAttribute('tabindex', '-1');
        }
        targetElement.focus();
    }
}
