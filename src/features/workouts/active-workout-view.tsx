import type { IndexedSet } from './active-exercise-card';
import * as React from 'react';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';

import { ActiveExerciseCard } from './active-exercise-card';
import { ExercisePickerSheet } from './exercise-picker-sheet';
import { RestTimerBar } from './rest-timer-bar';
import { isSetFilled } from './set-utils';
import { useWorkoutStore } from './use-workout-store';

export function ActiveWorkoutView({ onSaved }: { onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const units = useUserStore.use.user()?.preferred_units ?? 'metric';
  const activeSets = useWorkoutStore.use.activeSets();
  const activeRoutineName = useWorkoutStore.use.activeRoutineName();
  const exercises = useWorkoutStore.use.exercises();
  const cancelWorkout = useWorkoutStore.use.cancelWorkout();
  const saveWorkout = useWorkoutStore.use.saveWorkout();
  const activeRoutineChanged = useWorkoutStore.use.activeRoutineChanged();
  const addExercise = useWorkoutStore.use.addExercise();
  const addSet = useWorkoutStore.use.addSet();
  const updateSet = useWorkoutStore.use.updateSet();
  const removeSet = useWorkoutStore.use.removeSet();
  const removeExercise = useWorkoutStore.use.removeExercise();
  const copyFirstSetToAll = useWorkoutStore.use.copyFirstSetToAll();
  const [showPicker, setShowPicker] = useState(false);

  // Group active sets by exercise, preserving each set's global index in activeSets.
  const groups = activeSets.reduce<Array<{ exerciseId: number; exerciseName: string; sets: IndexedSet[] }>>((acc, set, globalIndex) => {
    const indexed: IndexedSet = { ...set, globalIndex };
    const existing = acc.find(g => g.exerciseId === set.exercise_id);
    if (existing)
      existing.sets.push(indexed);
    else
      acc.push({ exerciseId: set.exercise_id, exerciseName: set.exercise_name, sets: [indexed] });
    return acc;
  }, []);

  const filledCount = activeSets.filter(isSetFilled).length;

  const doSave = async (updateRoutine: boolean) => {
    await saveWorkout({ updateRoutine });
    onSaved();
  };

  const handleSave = () => {
    if (filledCount === 0) {
      Alert.alert('Nothing to save', 'Enter reps, time or distance for at least one set.');
      return;
    }
    if (activeRoutineChanged() && activeRoutineName) {
      Alert.alert(
        `Update ${activeRoutineName}?`,
        'You added, removed or reordered exercises. Save that to the routine for next time?',
        [
          { text: 'Just this workout', onPress: () => void doSave(false) },
          { text: 'Update routine', onPress: () => void doSave(true) },
        ],
      );
      return;
    }
    void doSave(false);
  };

  const handleCancel = () => {
    if (filledCount === 0) {
      cancelWorkout();
      return;
    }
    Alert.alert('Discard workout?', 'Sets you entered will be lost.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: cancelWorkout },
    ]);
  };

  return (
    <View className="flex-1 bg-ink-base">
      <View
        className="flex-row items-center justify-between border-b border-ink-hairline bg-ink-card px-5 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink-text" numberOfLines={1}>{activeRoutineName ?? 'Active workout'}</Text>
          {activeRoutineName && <Text className="text-xs text-ink-faint">Routine · weights from last time</Text>}
        </View>
        <View className="flex-row gap-2">
          <Button label="Cancel" variant="outline" size="sm" onPress={handleCancel} fullWidth={false} className="border-danger-400" textClassName="text-danger-400" />
          <Button label="Save" variant="primary" size="sm" fullWidth={false} onPress={handleSave} />
        </View>
      </View>

      <ScrollView contentContainerClassName="p-5 pb-32" keyboardShouldPersistTaps="handled">
        {groups.map(group => (
          <ActiveExerciseCard
            key={group.exerciseId}
            exerciseId={group.exerciseId}
            exerciseName={group.exerciseName}
            sets={group.sets}
            units={units}
            onUpdateSet={updateSet}
            onAddSet={addSet}
            onRemoveSet={removeSet}
            onRemoveExercise={removeExercise}
            onCopyFirstSet={copyFirstSetToAll}
          />
        ))}

        {groups.length > 0 && (
          <Text className="mb-3 text-center text-xs text-ink-faint">Long-press a set to remove it</Text>
        )}

        <Button
          label="Add exercise"
          variant="tonal"
          onPress={() => setShowPicker(true)}
          className="mt-2"
        />
      </ScrollView>

      <RestTimerBar bottomInset={insets.bottom} />

      <ExercisePickerSheet
        visible={showPicker}
        multiSelect
        title="Add exercises"
        exercises={exercises}
        alreadyAddedIds={[...new Set(activeSets.map(st => st.exercise_id))]}
        onSelectMany={async (picked) => {
          // Sequential so they appear in the order they were ticked.
          for (const ex of picked)
            await addExercise(ex.id);
        }}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}
