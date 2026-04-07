import type { WorkoutSetWithExercise } from '@/lib/types';

import * as React from 'react';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';
import { formatRelativeDate } from '@/lib/dates';
import { formatWeight, kgToLbs, lbsToKg } from '@/lib/units';

import { useWorkoutStore } from './use-workout-store';

function sessionSetsReducer(
  _: WorkoutSetWithExercise[],
  action:
    | { type: 'clear' }
    | { type: 'replace'; sets: WorkoutSetWithExercise[] },
): WorkoutSetWithExercise[] {
  switch (action.type) {
    case 'clear':
      return [];
    case 'replace':
      return action.sets;
  }
}

// eslint-disable-next-line max-lines-per-function
export function WorkoutsScreen() {
  const user = useUserStore.use.user();
  const units = user?.preferred_units ?? 'metric';
  const isActive = useWorkoutStore.use.isActive();
  const activeSets = useWorkoutStore.use.activeSets();
  const exercises = useWorkoutStore.use.exercises();
  const recentSessions = useWorkoutStore.use.recentSessions();
  const sessionsLimit = useWorkoutStore.use.sessionsLimit();
  const loadExercises = useWorkoutStore.use.loadExercises();
  const loadRecentSessions = useWorkoutStore.use.loadRecentSessions();
  const loadMoreSessions = useWorkoutStore.use.loadMoreSessions();
  const startWorkout = useWorkoutStore.use.startWorkout();
  const cancelWorkout = useWorkoutStore.use.cancelWorkout();
  const saveWorkout = useWorkoutStore.use.saveWorkout();
  const addExercise = useWorkoutStore.use.addExercise();
  const addSet = useWorkoutStore.use.addSet();
  const updateSet = useWorkoutStore.use.updateSet();
  const getSessionSets = useWorkoutStore.use.getSessionSets();
  const copyFirstSetToAll = useWorkoutStore.use.copyFirstSetToAll();
  const restDuration = useWorkoutStore.use.restDuration();
  const restEndsAt = useWorkoutStore.use.restEndsAt();
  const startRest = useWorkoutStore.use.startRest();
  const cancelRest = useWorkoutStore.use.cancelRest();
  const setRestDuration = useWorkoutStore.use.setRestDuration();

  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionSets, dispatchSessionSets] = useReducer(sessionSetsReducer, []);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Draft mirror for the currently-focused numeric input. Only one input is focused
  // at a time, so a single key/value is enough — no stale-key problems when sets
  // are added/removed and indices shift. Cleared on blur.
  const [inputDraft, setInputDraft] = useState<{ key: string; value: string } | null>(null);
  const draftFor = (key: string, fallback: string) =>
    inputDraft?.key === key ? inputDraft.value : fallback;
  const setDraft = (key: string, value: string) => setInputDraft({ key, value });
  const clearDraft = () => setInputDraft(null);
  const clearSessionSets = useCallback(
    () => dispatchSessionSets({ type: 'clear' }),
    [],
  );
  const replaceSessionSets = useCallback(
    (sets: WorkoutSetWithExercise[]) => dispatchSessionSets({ type: 'replace', sets }),
    [],
  );
  const parseDraftNum = (s: string): number => {
    const n = Number.parseFloat(s.replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
  };

  // Tick once a second only while a rest countdown is running.
  useEffect(() => {
    if (!restEndsAt)
      return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // Auto-clear the rest timer when it elapses so the floating bar disappears.
  useEffect(() => {
    if (!restEndsAt)
      return;
    const remaining = restEndsAt - Date.now();
    if (remaining <= 0) {
      cancelRest();
      return;
    }
    const id = setTimeout(cancelRest, remaining);
    return () => clearTimeout(id);
  }, [restEndsAt, cancelRest]);

  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - nowTick) / 1000)) : 0;

  const loadData = useCallback(() => {
    loadExercises();
    loadRecentSessions();
  }, [loadExercises, loadRecentSessions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!expandedSession) {
      // Clear stale data when collapsing so the next expand never flashes the previous session.
      clearSessionSets();
      return;
    }
    let cancelled = false;
    clearSessionSets();
    getSessionSets(expandedSession).then((sets) => {
      if (!cancelled)
        replaceSessionSets(sets);
    });
    return () => {
      cancelled = true;
    };
  }, [clearSessionSets, expandedSession, getSessionSets, replaceSessionSets]);

  const filteredExercises = exercises.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = !muscleFilter || e.primary_muscle_group === muscleFilter;
    return matchesSearch && matchesMuscle;
  });

  const muscleGroups = [...new Set(exercises.map(e => e.primary_muscle_group))].sort();

  // Group active sets by exercise, preserving each set's global index in activeSets
  type IndexedSet = typeof activeSets[number] & { globalIndex: number };
  const exerciseGroups = activeSets.reduce<Array<{ exerciseId: number; exerciseName: string; sets: IndexedSet[] }>>((groups, set, globalIndex) => {
    const indexed: IndexedSet = { ...set, globalIndex };
    const existing = groups.find(g => g.exerciseId === set.exercise_id);
    if (existing) {
      existing.sets.push(indexed);
    }
    else {
      groups.push({ exerciseId: set.exercise_id, exerciseName: set.exercise_name, sets: [indexed] });
    }
    return groups;
  }, []);

  const handleSave = async () => {
    const validCount = activeSets.filter(s => s.reps > 0).length;
    if (validCount === 0)
      return;
    await saveWorkout();
    await loadRecentSessions();
  };

  if (isActive) {
    return (
      <View className="flex-1 bg-charcoal-950">
        {/* Active Header */}
        <View className="flex-row items-center justify-between bg-charcoal-900 px-4 pt-14 pb-4">
          <Text className="text-xl font-bold text-white">Active Workout</Text>
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="outline" size="sm" onPress={cancelWorkout} className="border-danger-500" textClassName="text-danger-500" />
            <Button label="Save" size="sm" onPress={handleSave} className="bg-success-500" textClassName="text-black font-bold" />
          </View>
        </View>

        <ScrollView contentContainerClassName="p-4 pb-20">
          {exerciseGroups.map(group => (
            <View key={group.exerciseId} className="mb-6">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-base font-bold text-white">{group.exerciseName}</Text>
                {group.sets.length > 1 && (
                  <Pressable
                    onPress={() => copyFirstSetToAll(group.exerciseId)}
                    className="rounded-md bg-charcoal-800 px-3 py-1"
                  >
                    <Text className="text-xs text-charcoal-200">Fill from set 1</Text>
                  </Pressable>
                )}
              </View>

              {/* Header */}
              <View className="mb-1 flex-row items-center px-2">
                <Text className="w-10 text-center text-xs font-bold text-charcoal-400">Set</Text>
                <Text className="flex-1 text-center text-xs font-bold text-charcoal-400">Previous</Text>
                <Text className="w-20 text-center text-xs font-bold text-charcoal-400">{units === 'imperial' ? 'lbs' : 'kg'}</Text>
                <Text className="w-20 text-center text-xs font-bold text-charcoal-400">reps</Text>
              </View>

              {group.sets.map((set) => {
                const { globalIndex } = set;
                return (
                  <View
                    key={globalIndex}
                    className="mb-0.5 flex-row items-center rounded-lg p-2"
                  >
                    <Text className="w-8 text-center text-sm text-white">{set.set_number}</Text>
                    <Text className="flex-1 text-center text-sm text-charcoal-400">
                      {set.prev_weight != null && set.prev_reps != null
                        ? `${units === 'imperial' ? kgToLbs(set.prev_weight) : set.prev_weight}×${set.prev_reps}`
                        : '-'}
                    </Text>
                    <View className="w-16 items-center">
                      <TextInput
                        keyboardType="numeric"
                        value={draftFor(
                          `${globalIndex}-weight`,
                          set.weight > 0 ? String(units === 'imperial' ? kgToLbs(set.weight) : set.weight) : '',
                        )}
                        onChangeText={(v) => {
                          setDraft(`${globalIndex}-weight`, v);
                          const n = parseDraftNum(v);
                          updateSet(globalIndex, { weight: units === 'imperial' ? lbsToKg(n) : n });
                        }}
                        onBlur={clearDraft}
                        className="h-10 w-14 rounded-md bg-charcoal-900 text-center text-base text-white"
                        placeholderTextColor="#7D7D7D"
                      />
                    </View>
                    <View className="w-16 items-center">
                      <TextInput
                        keyboardType="numeric"
                        value={draftFor(`${globalIndex}-reps`, set.reps > 0 ? String(set.reps) : '')}
                        onChangeText={(v) => {
                          setDraft(`${globalIndex}-reps`, v);
                          updateSet(globalIndex, { reps: parseDraftNum(v) });
                        }}
                        onBlur={clearDraft}
                        className="h-10 w-14 rounded-md bg-charcoal-900 text-center text-base text-white"
                        placeholderTextColor="#7D7D7D"
                      />
                    </View>
                  </View>
                );
              })}

              <Pressable onPress={() => addSet(group.exerciseId)} className="mt-1 py-1">
                <Text className="text-center text-sm text-success-500">+ Add Set</Text>
              </Pressable>
            </View>
          ))}

          <Button
            label="Add Exercise"
            variant="outline"
            onPress={() => setShowPicker(true)}
            className="mt-2 border-success-500"
            textClassName="text-success-500"
          />
        </ScrollView>

        {/* Rest timer floating bar */}
        {restEndsAt
          ? (
              <View className="absolute inset-x-4 bottom-4 flex-row items-center justify-between rounded-xl bg-success-500 px-4 py-3 shadow-lg">
                <Text className="text-base font-bold text-black">
                  Rest:
                  {' '}
                  {Math.floor(restRemaining / 60)}
                  :
                  {String(restRemaining % 60).padStart(2, '0')}
                </Text>
                <Pressable onPress={cancelRest}>
                  <Text className="text-sm font-semibold text-black">Skip</Text>
                </Pressable>
              </View>
            )
          : (
              <View className="absolute inset-x-4 bottom-4 flex-row items-center justify-between rounded-xl bg-charcoal-900 px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => setRestDuration(restDuration - 15)}
                    className="size-7 items-center justify-center rounded-full bg-charcoal-800"
                  >
                    <Text className="text-base text-white">−</Text>
                  </Pressable>
                  <Text className="w-12 text-center text-sm font-semibold text-white">
                    {Math.floor(restDuration / 60)}
                    :
                    {String(restDuration % 60).padStart(2, '0')}
                  </Text>
                  <Pressable
                    onPress={() => setRestDuration(restDuration + 15)}
                    className="size-7 items-center justify-center rounded-full bg-charcoal-800"
                  >
                    <Text className="text-base text-white">+</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={startRest}
                  className="rounded-lg bg-success-500 px-4 py-2"
                >
                  <Text className="text-sm font-bold text-black">Rest between sets</Text>
                </Pressable>
              </View>
            )}

        {/* Exercise Picker Modal */}
        <Modal visible={showPicker} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/50">
            <View className="max-h-[80%] rounded-t-2xl bg-charcoal-900 p-6">
              <Text className="mb-4 text-base font-semibold text-white">Add Exercise</Text>
              <TextInput
                placeholder="Search exercises..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="mb-3 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
                placeholderTextColor="#7D7D7D"
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 max-h-10">
                {muscleGroups.map(mg => (
                  <Pressable
                    key={mg}
                    onPress={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
                    className={`mr-2 rounded-full px-3 py-1 ${muscleFilter === mg ? 'bg-success-500' : 'bg-charcoal-800'}`}
                  >
                    <Text className={muscleFilter === mg ? 'text-sm text-black' : 'text-sm text-charcoal-300'}>{mg}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <FlatList
                data={filteredExercises}
                keyExtractor={e => String(e.id)}
                className="max-h-72"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      addExercise(item.id);
                      setShowPicker(false);
                      setSearchQuery('');
                      setMuscleFilter(null);
                    }}
                    className="mb-1 rounded-lg bg-charcoal-950 p-3"
                  >
                    <Text className="text-base text-white">{item.name}</Text>
                    <Text className="text-xs text-charcoal-400">
                      {item.primary_muscle_group}
                      {' '}
                      ·
                      {' '}
                      {item.equipment_type}
                    </Text>
                  </Pressable>
                )}
              />

              <Button
                label="Close"
                variant="ghost"
                onPress={() => {
                  setShowPicker(false);
                  setSearchQuery('');
                  setMuscleFilter(null);
                }}
                className="mt-2"
                textClassName="text-charcoal-400"
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // History view
  return (
    <View className="flex-1 bg-charcoal-950">
      <ScrollView
        contentContainerClassName="p-4 pb-20 pt-14"
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor="#22C55E" />}
      >
        <Text className="mb-4 text-2xl font-bold text-white">Workouts</Text>

        {recentSessions.length === 0
          ? (
              <View className="items-center rounded-xl bg-charcoal-900 p-8">
                <Text className="mb-2 text-center text-base text-charcoal-400">
                  No workouts yet. Start your first session!
                </Text>
                <Text className="text-center text-sm text-charcoal-500">
                  Track your exercises, sets, and progress over time.
                </Text>
              </View>
            )
          : (
              recentSessions.map(session => (
                <Pressable
                  key={session.id}
                  onPress={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                  className="mb-2 rounded-xl bg-charcoal-900 p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-medium text-white">{formatRelativeDate(session.date)}</Text>
                    {session.set_count != null && session.set_count > 0 && (
                      <Text className="text-xs text-charcoal-400">
                        {session.set_count}
                        {' '}
                        {session.set_count === 1 ? 'set' : 'sets'}
                      </Text>
                    )}
                  </View>
                  {session.exercise_names && (
                    <Text className="mt-1 text-sm text-charcoal-300" numberOfLines={2}>
                      {session.exercise_names}
                    </Text>
                  )}
                  {expandedSession === session.id && sessionSets.map(set => (
                    <Text key={set.id} className="mt-1 text-sm text-charcoal-200">
                      {set.exercise_name}
                      :
                      {formatWeight(set.weight, units).split(' ')[0]}
                      ×
                      {set.reps}
                      {set.rest_time_sec ? ` · ${set.rest_time_sec}s rest` : ''}
                    </Text>
                  ))}
                </Pressable>
              ))
            )}

        {/* Load more — show whenever we've filled the current page, since we don't
            know the true total without an extra query. Worst case the next click
            returns the same list, which is harmless. */}
        {recentSessions.length > 0 && recentSessions.length >= sessionsLimit && (
          <Pressable
            onPress={loadMoreSessions}
            className="mt-2 items-center rounded-xl bg-charcoal-900 py-3"
          >
            <Text className="text-sm text-success-500">Load older sessions</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={startWorkout}
        className="absolute right-4 bottom-6 size-14 items-center justify-center rounded-full bg-success-500 shadow-lg"
      >
        <Text className="text-2xl font-bold text-black">+</Text>
      </Pressable>
    </View>
  );
}
