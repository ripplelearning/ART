// navigation.js
export function switchView(view) {
    const dashboard = document.getElementById('dashboard-landmark');
    const builder = document.getElementById('builder-landmark');

    if (view === 'builder') {
        dashboard.classList.add('hidden');
        builder.classList.remove('hidden');
    } else {
        dashboard.classList.remove('hidden');
        builder.classList.add('hidden');
    }
}

export function initNavListener() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const landmarks = [
                document.querySelector('nav'),
                document.getElementById('dashboard-landmark'),
                document.getElementById('builder-landmark')
            ].filter(l => l && !l.classList.contains('hidden'));

            let activeIdx = landmarks.findIndex(l => l.contains(document.activeElement));
            let nextIdx = (activeIdx === -1 || activeIdx >= landmarks.length - 1) ? 0 : activeIdx + 1;
            const target = landmarks[nextIdx].querySelector('button, input, select, textarea, [tabindex]') || landmarks[nextIdx];
            target.focus();
        }
    });
}
