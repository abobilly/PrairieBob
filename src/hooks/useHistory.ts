/**
 * useHistory - Undo/Redo hook for SpudTile
 * 
 * Provides a history stack for any state, enabling Ctrl+Z/Ctrl+Y functionality.
 * Inspired by Tiled's undo system.
 */

import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

interface UseHistoryReturn<T> {
    state: T;
    setState: (newState: T | ((prev: T) => T), recordHistory?: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    clearHistory: () => void;
    historyLength: number;
}

const MAX_HISTORY_LENGTH = 100;

export function useHistory<T>(initialState: T): UseHistoryReturn<T> {
    const [history, setHistory] = useState<HistoryState<T>>({
        past: [],
        present: initialState,
        future: [],
    });

    // Track whether we're in an undo/redo operation
    const isUndoRedoRef = useRef(false);

    const setState = useCallback((newState: T | ((prev: T) => T), recordHistory = true) => {
        setHistory((prev) => {
            const resolvedState = typeof newState === 'function'
                ? (newState as (prev: T) => T)(prev.present)
                : newState;

            // Don't record if we're undoing/redoing or explicitly told not to
            if (isUndoRedoRef.current || !recordHistory) {
                return {
                    ...prev,
                    present: resolvedState,
                };
            }

            // Add current state to past, clear future
            const newPast = [...prev.past, prev.present];

            // Limit history length
            if (newPast.length > MAX_HISTORY_LENGTH) {
                newPast.shift();
            }

            return {
                past: newPast,
                present: resolvedState,
                future: [],
            };
        });
    }, []);

    const undo = useCallback(() => {
        setHistory((prev) => {
            if (prev.past.length === 0) return prev;

            isUndoRedoRef.current = true;

            const newPast = [...prev.past];
            const newPresent = newPast.pop()!;
            const newFuture = [prev.present, ...prev.future];

            // Allow next setState to record history again
            setTimeout(() => { isUndoRedoRef.current = false; }, 0);

            return {
                past: newPast,
                present: newPresent,
                future: newFuture,
            };
        });
    }, []);

    const redo = useCallback(() => {
        setHistory((prev) => {
            if (prev.future.length === 0) return prev;

            isUndoRedoRef.current = true;

            const newFuture = [...prev.future];
            const newPresent = newFuture.shift()!;
            const newPast = [...prev.past, prev.present];

            // Allow next setState to record history again
            setTimeout(() => { isUndoRedoRef.current = false; }, 0);

            return {
                past: newPast,
                present: newPresent,
                future: newFuture,
            };
        });
    }, []);

    const clearHistory = useCallback(() => {
        setHistory((prev) => ({
            past: [],
            present: prev.present,
            future: [],
        }));
    }, []);

    return {
        state: history.present,
        setState,
        undo,
        redo,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        clearHistory,
        historyLength: history.past.length + history.future.length,
    };
}

/**
 * Batch multiple edits into a single history entry.
 * Use this for drag operations, flood fill, etc.
 */
export function useBatchHistory<T>(
    setState: (newState: T | ((prev: T) => T), recordHistory?: boolean) => void
) {
    const batchRef = useRef<T | null>(null);
    const isBatchingRef = useRef(false);

    const startBatch = useCallback((currentState: T) => {
        batchRef.current = currentState;
        isBatchingRef.current = true;
    }, []);

    const updateBatch = useCallback((newState: T | ((prev: T) => T)) => {
        if (isBatchingRef.current) {
            // Don't record intermediate states
            setState(newState, false);
        } else {
            setState(newState, true);
        }
    }, [setState]);

    const endBatch = useCallback(() => {
        if (isBatchingRef.current && batchRef.current !== null) {
            // The final state is already set, we just need to ensure
            // the NEXT edit records history properly
            isBatchingRef.current = false;
            batchRef.current = null;
        }
    }, []);

    return { startBatch, updateBatch, endBatch, isBatching: isBatchingRef.current };
}
