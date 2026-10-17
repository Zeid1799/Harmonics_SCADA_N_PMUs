import { useState, useCallback } from 'react';
import { PowerNetworkModel } from '../types/network';
import { cloneNetworkModel } from '../model/networkEditor';

const MAX_HISTORY_STEPS = 50;

export interface NetworkHistoryHook {
  currentModel: PowerNetworkModel;
  canUndo: boolean;
  canRedo: boolean;
  historyCount: number;
  pushModelChange: (nextModel: PowerNetworkModel) => void;
  undo: () => PowerNetworkModel | null;
  redo: () => PowerNetworkModel | null;
  resetHistory: (freshModel: PowerNetworkModel) => void;
}

/**
 * In-memory undo/redo history manager for the Power System Simulator working model.
 * Enforces session-only changes with no persistent browser storage.
 */
export function useNetworkHistory(initialModel: PowerNetworkModel): NetworkHistoryHook {
  const [past, setPast] = useState<PowerNetworkModel[]>([]);
  const [present, setPresent] = useState<PowerNetworkModel>(() =>
    cloneNetworkModel(initialModel)
  );
  const [future, setFuture] = useState<PowerNetworkModel[]>([]);

  const pushModelChange = useCallback((nextModel: PowerNetworkModel) => {
    setPast((prevPast) => {
      const clonedPresent = cloneNetworkModel(present);
      const updatedPast = [...prevPast, clonedPresent];
      if (updatedPast.length > MAX_HISTORY_STEPS) {
        return updatedPast.slice(updatedPast.length - MAX_HISTORY_STEPS);
      }
      return updatedPast;
    });
    setPresent(cloneNetworkModel(nextModel));
    setFuture([]);
  }, [present]);

  const undo = useCallback((): PowerNetworkModel | null => {
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setPast(newPast);
    setFuture((prevFuture) => [cloneNetworkModel(present), ...prevFuture]);
    setPresent(cloneNetworkModel(previous));
    return previous;
  }, [past, present]);

  const redo = useCallback((): PowerNetworkModel | null => {
    if (future.length === 0) return null;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast((prevPast) => [...prevPast, cloneNetworkModel(present)]);
    setPresent(cloneNetworkModel(next));
    setFuture(newFuture);
    return next;
  }, [future, present]);

  const resetHistory = useCallback((freshModel: PowerNetworkModel) => {
    setPast([]);
    setPresent(cloneNetworkModel(freshModel));
    setFuture([]);
  }, []);

  return {
    currentModel: present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historyCount: past.length,
    pushModelChange,
    undo,
    redo,
    resetHistory,
  };
}
