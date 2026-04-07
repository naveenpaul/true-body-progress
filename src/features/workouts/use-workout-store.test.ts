import { useWorkoutStore } from './use-workout-store';

// These tests exercise pure local-state actions on the workout store
// (addSet, updateSet, completeSet, removeSet) which do not touch SQLite.
// They lock in three regressions found during the 2026-04-07 fix pass.

describe('useWorkoutStore — local state actions', () => {
  beforeEach(() => {
    // Reset to a clean state between tests.
    useWorkoutStore.setState({
      activeSets: [],
      isActive: false,
      startTime: null,
    });
  });

  // REGRESSION: addSet previously called `state.activeSets.lastIndexOf(undefined)`
  // when the exercise had no existing sets, returning -1, then `splice(0, 0, newSet)`
  // inserted the new set at the HEAD of activeSets. This broke the ordering of every
  // other exercise's sets and made grouping nondeterministic.
  describe('addSet — empty exercise case', () => {
    it('appends to the end when the exercise has no existing sets', () => {
      // Seed two sets for exercise 1
      useWorkoutStore.setState({
        activeSets: [
          { exercise_id: 1, exercise_name: 'Bench', set_number: 1, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
          { exercise_id: 1, exercise_name: 'Bench', set_number: 2, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
        ],
      });

      // Add a set for exercise 2 (which has no existing sets)
      useWorkoutStore.getState().addSet(2);

      const sets = useWorkoutStore.getState().activeSets;
      expect(sets).toHaveLength(3);

      // Crucial: the new set must NOT be inserted at index 0.
      // Bench sets stay at the head; the new ex-2 set is at the tail.
      expect(sets[0].exercise_id).toBe(1);
      expect(sets[1].exercise_id).toBe(1);
      expect(sets[2].exercise_id).toBe(2);
    });

    it('appends after existing sets when the exercise already has some', () => {
      useWorkoutStore.setState({
        activeSets: [
          { exercise_id: 1, exercise_name: 'Bench', set_number: 1, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
          { exercise_id: 2, exercise_name: 'Squat', set_number: 1, reps: 5, weight: 100, rpe: null, completed: false, prev_reps: null, prev_weight: null },
          { exercise_id: 1, exercise_name: 'Bench', set_number: 2, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
        ],
      });

      // Adding a Bench set should land directly after the last Bench set (index 2),
      // not at the end of the array.
      useWorkoutStore.getState().addSet(1);

      const sets = useWorkoutStore.getState().activeSets;
      expect(sets).toHaveLength(4);
      expect(sets[3].exercise_id).toBe(1);
      expect(sets[3].set_number).toBe(3);
    });
  });

  // REGRESSION: updateSet is called from the screen with a globalIndex computed
  // at render time. The previous bug was at the SCREEN layer (recomputing index
  // via stale `indexOf(set)`), but the store contract is what makes the screen
  // fix sound: updateSet must apply changes to the exact index passed in,
  // never mutate any other entry, even when called rapidly.
  describe('updateSet — index stability', () => {
    it('updates only the targeted index', () => {
      useWorkoutStore.setState({
        activeSets: [
          { exercise_id: 1, exercise_name: 'A', set_number: 1, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
          { exercise_id: 1, exercise_name: 'A', set_number: 2, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
          { exercise_id: 1, exercise_name: 'A', set_number: 3, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
        ],
      });

      useWorkoutStore.getState().updateSet(1, { weight: 75 });

      const sets = useWorkoutStore.getState().activeSets;
      expect(sets[0].weight).toBe(60);
      expect(sets[1].weight).toBe(75);
      expect(sets[2].weight).toBe(60);
    });

    it('survives rapid sequential updates without losing keystrokes', () => {
      useWorkoutStore.setState({
        activeSets: [
          { exercise_id: 1, exercise_name: 'A', set_number: 1, reps: 0, weight: 0, rpe: null, completed: false, prev_reps: null, prev_weight: null },
        ],
      });

      // Simulate fast typing: "1" → "10" → "100"
      const { updateSet } = useWorkoutStore.getState();
      updateSet(0, { weight: 1 });
      updateSet(0, { weight: 10 });
      updateSet(0, { weight: 100 });

      expect(useWorkoutStore.getState().activeSets[0].weight).toBe(100);
    });
  });

  // REGRESSION: completeSet allowed users to tap ✓ on a row with reps=0.
  // saveWorkout filters reps<=0 out, so the user saw a checkmark, then lost
  // the set silently on save.
  describe('completeSet — empty set guard', () => {
    it('refuses to complete a set with reps=0', () => {
      useWorkoutStore.setState({
        activeSets: [
          { exercise_id: 1, exercise_name: 'A', set_number: 1, reps: 0, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
        ],
      });

      useWorkoutStore.getState().completeSet(0);

      expect(useWorkoutStore.getState().activeSets[0].completed).toBe(false);
    });

    it('completes a set with reps>0', () => {
      useWorkoutStore.setState({
        activeSets: [
          { exercise_id: 1, exercise_name: 'A', set_number: 1, reps: 5, weight: 60, rpe: null, completed: false, prev_reps: null, prev_weight: null },
        ],
      });

      useWorkoutStore.getState().completeSet(0);

      expect(useWorkoutStore.getState().activeSets[0].completed).toBe(true);
    });
  });
});
