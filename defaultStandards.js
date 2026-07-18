const defaultStandards = await fetch(new URL('./wcag_data.js', import.meta.url), { cache: 'no-cache' })
    .then(async (response) => {
        if (!response.ok) {
            throw new Error(`Unable to load default standards: HTTP ${response.status}`);
        }
        const source = await response.text();
        const normalized = source.trim().replace(/;\s*$/, '');
        return Function(`"use strict"; return (${normalized});`)();
    });

export default defaultStandards;