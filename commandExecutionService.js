import { commandRegistry } from './commandRegistry.js';

export const COMMAND_EXECUTION_STATUSES = Object.freeze({
    SUCCESS: 'success',
    FAILURE: 'failure',
    CANCELLED: 'cancelled'
});

export class CommandExecutionError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'CommandExecutionError';
        this.code = code;
        this.details = details;
    }
}

function normalizeText(value) {
    return String(value || '').trim();
}

function cloneCommand(command) {
    if (!command) return null;
    return {
        id: command.id,
        displayName: command.displayName,
        description: command.description,
        category: command.category,
        keyboardShortcut: command.keyboardShortcut,
        helpTopic: command.helpTopic,
        menuLocation: command.menuLocation,
        menuItemRole: command.menuItemRole,
        commandPaletteVisible: command.commandPaletteVisible,
        contextMenuVisible: command.contextMenuVisible,
        notes: command.notes
    };
}

function createExecutionResult(overrides = {}) {
    const startedAt = overrides.startedAt || new Date().toISOString();
    const finishedAt = overrides.finishedAt || startedAt;
    const durationMs = typeof overrides.durationMs === 'number'
        ? overrides.durationMs
        : Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());

    return Object.freeze({
        ok: overrides.ok !== false,
        status: overrides.status || (overrides.ok === false ? COMMAND_EXECUTION_STATUSES.FAILURE : COMMAND_EXECUTION_STATUSES.SUCCESS),
        commandId: normalizeText(overrides.commandId),
        command: cloneCommand(overrides.command),
        message: normalizeText(overrides.message),
        reason: normalizeText(overrides.reason),
        value: Object.prototype.hasOwnProperty.call(overrides, 'value') ? overrides.value : null,
        error: overrides.error || null,
        startedAt,
        finishedAt,
        durationMs,
        context: overrides.context || null
    });
}

function isPromise(value) {
    return Boolean(value) && typeof value.then === 'function';
}

function isResultLike(value) {
    return Boolean(value)
        && typeof value === 'object'
        && (Object.prototype.hasOwnProperty.call(value, 'ok')
            || Object.prototype.hasOwnProperty.call(value, 'status')
            || Object.prototype.hasOwnProperty.call(value, 'reason'));
}

function isCancelledValue(value) {
    if (value === false) return true;
    if (value && typeof value === 'object') {
        return value.status === COMMAND_EXECUTION_STATUSES.CANCELLED || value.cancelled === true;
    }
    return false;
}

function normalizeConditionResult(value) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
        return value.ok !== false;
    }
    return Boolean(value);
}

function evaluateCondition(condition, context, command) {
    if (typeof condition === 'function') {
        return normalizeConditionResult(condition(context, command));
    }
    if (condition === undefined) return true;
    return Boolean(condition);
}

function normalizePreconditionOutcome(outcome, command, startedAt, context) {
    if (outcome && typeof outcome === 'object' && Object.prototype.hasOwnProperty.call(outcome, 'ok') && outcome.ok !== false) {
        return createExecutionResult({
            ok: true,
            status: COMMAND_EXECUTION_STATUSES.SUCCESS,
            commandId: command.id,
            command,
            context,
            startedAt,
            finishedAt: new Date().toISOString(),
            message: normalizeText(outcome.message),
            value: outcome.value
        });
    }

    return createExecutionResult({
        ok: false,
        status: outcome?.status === COMMAND_EXECUTION_STATUSES.CANCELLED || outcome?.cancelled === true
            ? COMMAND_EXECUTION_STATUSES.CANCELLED
            : COMMAND_EXECUTION_STATUSES.FAILURE,
        commandId: command.id,
        command,
        context,
        startedAt,
        finishedAt: new Date().toISOString(),
        reason: normalizeText(outcome?.reason || outcome?.code || 'precondition-failed'),
        message: normalizeText(outcome?.message || 'Command precondition failed.'),
        value: Object.prototype.hasOwnProperty.call(outcome || {}, 'value') ? outcome.value : null,
        error: outcome?.error || null
    });
}

function normalizeHandlerResult(outcome, command, startedAt, context) {
    const finishedAt = new Date().toISOString();

    if (isResultLike(outcome)) {
        const status = normalizeText(outcome.status) || (outcome.ok === false ? COMMAND_EXECUTION_STATUSES.FAILURE : COMMAND_EXECUTION_STATUSES.SUCCESS);
        const ok = outcome.ok !== false && status !== COMMAND_EXECUTION_STATUSES.FAILURE;
        return createExecutionResult({
            ok,
            status,
            commandId: command.id,
            command,
            context,
            startedAt,
            finishedAt,
            message: normalizeText(outcome.message),
            reason: normalizeText(outcome.reason),
            value: Object.prototype.hasOwnProperty.call(outcome, 'value') ? outcome.value : null,
            error: outcome.error || null
        });
    }

    if (isCancelledValue(outcome)) {
        return createExecutionResult({
            ok: false,
            status: COMMAND_EXECUTION_STATUSES.CANCELLED,
            commandId: command.id,
            command,
            context,
            startedAt,
            finishedAt,
            reason: 'cancelled',
            message: 'Command execution was cancelled.',
            value: null
        });
    }

    return createExecutionResult({
        ok: true,
        status: COMMAND_EXECUTION_STATUSES.SUCCESS,
        commandId: command.id,
        command,
        context,
        startedAt,
        finishedAt,
        value: outcome
    });
}

function normalizeErrorResult(error, command, startedAt, context) {
    const finishedAt = new Date().toISOString();
    const message = normalizeText(error?.message || 'Command execution failed.');
    return createExecutionResult({
        ok: false,
        status: COMMAND_EXECUTION_STATUSES.FAILURE,
        commandId: command?.id || '',
        command: command || null,
        context,
        startedAt,
        finishedAt,
        reason: normalizeText(error?.code || error?.name || 'execution-error'),
        message,
        error: error || null
    });
}

function normalizeCommandUnavailableResult(commandId, reason, message, context) {
    const finishedAt = new Date().toISOString();
    return createExecutionResult({
        ok: false,
        status: reason === 'cancelled' ? COMMAND_EXECUTION_STATUSES.CANCELLED : COMMAND_EXECUTION_STATUSES.FAILURE,
        commandId,
        command: null,
        context,
        startedAt: finishedAt,
        finishedAt,
        reason,
        message
    });
}

export function createCommandExecutionService(options = {}) {
    const registry = options.registry || commandRegistry;
    const hooks = {
        beforeExecute: typeof options.beforeExecute === 'function' ? options.beforeExecute : null,
        afterExecute: typeof options.afterExecute === 'function' ? options.afterExecute : null,
        onError: typeof options.onError === 'function' ? options.onError : null
    };
    const activeCommandIds = new Set();
    const allowReentrancy = options.allowReentrancy === true;

    function getCommand(commandId) {
        return registry.getCommand(commandId);
    }

    function getCommandExecutionState(commandId, context = {}) {
        const command = getCommand(commandId);
        if (!command) {
            return {
                exists: false,
                visible: false,
                enabled: false,
                canExecute: false,
                command: null,
                reason: 'command-not-found'
            };
        }

        const visible = evaluateCondition(command.visible, context, command);
        const enabled = evaluateCondition(command.enabled, context, command);
        const checked = evaluateCondition(command.checked, context, command);

        return {
            exists: true,
            visible,
            enabled,
            checked,
            canExecute: visible && enabled,
            command: cloneCommand(command),
            reason: visible ? (enabled ? '' : 'disabled') : 'hidden'
        };
    }

    async function executeCommand(commandId, context = {}) {
        const startedAt = new Date().toISOString();
        const command = getCommand(commandId);

        if (!command) {
            const result = normalizeCommandUnavailableResult(
                normalizeText(commandId),
                'command-not-found',
                'The requested command is not registered.',
                context
            );
            if (hooks.onError) hooks.onError(result);
            return result;
        }

        if (activeCommandIds.has(command.id) && allowReentrancy !== true) {
            const result = createExecutionResult({
                ok: false,
                status: COMMAND_EXECUTION_STATUSES.FAILURE,
                commandId: command.id,
                command,
                context,
                startedAt,
                finishedAt: new Date().toISOString(),
                reason: 'recursive-execution-blocked',
                message: 'Recursive command execution was blocked.'
            });
            if (hooks.onError) hooks.onError(result);
            return result;
        }

        if (!evaluateCondition(command.visible, context, command)) {
            const result = createExecutionResult({
                ok: false,
                status: COMMAND_EXECUTION_STATUSES.FAILURE,
                commandId: command.id,
                command,
                context,
                startedAt,
                finishedAt: new Date().toISOString(),
                reason: 'hidden',
                message: 'The requested command is not currently visible.'
            });
            if (hooks.onError) hooks.onError(result);
            return result;
        }

        if (!evaluateCondition(command.enabled, context, command)) {
            const result = createExecutionResult({
                ok: false,
                status: COMMAND_EXECUTION_STATUSES.FAILURE,
                commandId: command.id,
                command,
                context,
                startedAt,
                finishedAt: new Date().toISOString(),
                reason: 'disabled',
                message: 'The requested command is currently disabled.'
            });
            if (hooks.onError) hooks.onError(result);
            return result;
        }

        const preconditions = Array.isArray(command.preconditions)
            ? command.preconditions
            : command.preconditions
                ? [command.preconditions]
                : [];

        for (const precondition of preconditions) {
            try {
                const outcome = typeof precondition === 'function' ? precondition(context, command) : precondition;
                const resolved = isPromise(outcome) ? await outcome : outcome;
                if (resolved && typeof resolved === 'object' && Object.prototype.hasOwnProperty.call(resolved, 'ok') && resolved.ok !== false) {
                    continue;
                }
                if (!resolved || resolved.ok === false || resolved.cancelled === true || resolved.status === COMMAND_EXECUTION_STATUSES.CANCELLED) {
                    const result = normalizePreconditionOutcome(resolved, command, startedAt, context);
                    if (hooks.onError) hooks.onError(result);
                    return result;
                }
            } catch (error) {
                const result = normalizeErrorResult(error, command, startedAt, context);
                if (hooks.onError) hooks.onError(result);
                return result;
            }
        }

        if (hooks.beforeExecute) {
            try {
                const beforeOutcome = hooks.beforeExecute({ command, commandId: command.id, context, registry, service: api });
                const resolvedBefore = isPromise(beforeOutcome) ? await beforeOutcome : beforeOutcome;
                if (isResultLike(resolvedBefore)) {
                    const normalized = normalizeHandlerResult(resolvedBefore, command, startedAt, context);
                    if (hooks.afterExecute) {
                        const afterOutcome = hooks.afterExecute(normalized, { command, commandId: command.id, context, registry, service: api });
                        if (isPromise(afterOutcome)) await afterOutcome;
                    }
                    if (!normalized.ok && hooks.onError) hooks.onError(normalized);
                    return normalized;
                }
            } catch (error) {
                const result = normalizeErrorResult(error, command, startedAt, context);
                if (hooks.onError) hooks.onError(result);
                return result;
            }
        }

        if (typeof command.handler !== 'function') {
            const result = createExecutionResult({
                ok: false,
                status: COMMAND_EXECUTION_STATUSES.FAILURE,
                commandId: command.id,
                command,
                context,
                startedAt,
                finishedAt: new Date().toISOString(),
                reason: 'missing-handler',
                message: 'The requested command has no execution handler.'
            });
            if (hooks.onError) hooks.onError(result);
            return result;
        }

        activeCommandIds.add(command.id);
        try {
            const executionContext = Object.freeze({
                ...context,
                command: cloneCommand(command),
                commandId: command.id,
                registry,
                service: api
            });
            const outcome = command.handler(executionContext);
            const resolvedOutcome = isPromise(outcome) ? await outcome : outcome;
            const result = normalizeHandlerResult(resolvedOutcome, command, startedAt, context);

            if (hooks.afterExecute) {
                try {
                    const afterOutcome = hooks.afterExecute(result, { command, commandId: command.id, context, registry, service: api });
                    const resolvedAfter = isPromise(afterOutcome) ? await afterOutcome : afterOutcome;
                    if (isResultLike(resolvedAfter)) {
                        return normalizeHandlerResult(resolvedAfter, command, startedAt, context);
                    }
                } catch (error) {
                    const afterErrorResult = normalizeErrorResult(error, command, startedAt, context);
                    if (hooks.onError) hooks.onError(afterErrorResult);
                    return afterErrorResult;
                }
            }

            if (!result.ok && hooks.onError) hooks.onError(result);
            return result;
        } catch (error) {
            const result = normalizeErrorResult(error, command, startedAt, context);
            if (hooks.onError) hooks.onError(result);
            return result;
        } finally {
            activeCommandIds.delete(command.id);
        }
    }

    async function executeCommandById(commandId, context = {}) {
        return executeCommand(commandId, context);
    }

    function isCommandActive(commandId) {
        return activeCommandIds.has(normalizeText(commandId));
    }

    function resetExecutionState() {
        activeCommandIds.clear();
    }

    const api = Object.freeze({
        getCommand,
        getCommandExecutionState,
        executeCommand,
        executeCommandById,
        isCommandActive,
        resetExecutionState,
        get activeCommandIds() {
            return [...activeCommandIds];
        }
    });

    return api;
}

export const commandExecutionService = createCommandExecutionService();
export {
    cloneCommand,
    createExecutionResult,
    isResultLike,
    normalizeHandlerResult,
    normalizeErrorResult
};