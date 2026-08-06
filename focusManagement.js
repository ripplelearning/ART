function isFocusableTarget(target) {
    return Boolean(target) && typeof target.focus === 'function';
}

export function resolveFocusTarget(...candidates) {
    for (const candidate of candidates) {
        if (isFocusableTarget(candidate)) return candidate;
    }
    return null;
}

export function focusElement(target, options = {}) {
    const candidate = resolveFocusTarget(target);
    if (!candidate) return false;

    const preventScroll = options.preventScroll !== false;
    candidate.focus({ preventScroll });
    return document.activeElement === candidate;
}

export function restoreFocus(target, options = {}) {
    const candidate = resolveFocusTarget(target);
    if (!candidate) return;

    const retries = Math.max(0, Number(options.retries ?? 1));
    const delayMs = Math.max(0, Number(options.delayMs ?? 0));
    const preventScroll = options.preventScroll !== false;

    const attempt = (remaining) => {
        candidate.focus({ preventScroll });
        if (document.activeElement === candidate || remaining <= 0) return;
        window.setTimeout(() => attempt(remaining - 1), 0);
    };

    window.setTimeout(() => {
        attempt(retries);
    }, delayMs);
}
