import * as React from 'react';
import { useCallback, useEffect } from 'react';

import { ActiveWorkoutView } from './active-workout-view';
import { HistoryView } from './history-view';
import { useWorkoutStore } from './use-workout-store';

export function WorkoutsScreen() {
  const isActive = useWorkoutStore.use.isActive();
  const loadExercises = useWorkoutStore.use.loadExercises();
  const loadRecentSessions = useWorkoutStore.use.loadRecentSessions();
  const loadRoutines = useWorkoutStore.use.loadRoutines();

  const loadData = useCallback(() => {
    loadExercises();
    loadRecentSessions();
    loadRoutines();
  }, [loadExercises, loadRecentSessions, loadRoutines]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isActive)
    return <ActiveWorkoutView onSaved={loadRecentSessions} />;

  return <HistoryView onRefresh={loadData} />;
}
