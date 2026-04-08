import type { TextStyle } from 'react-native';

import type { WorkoutSetWithExercise } from '@/lib/types';
import * as React from 'react';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';
import { formatRelativeDate } from '@/lib/dates';
import { formatWeight, kgToLbs, lbsToKg } from '@/lib/units';

import { useWorkoutStore } from './use-workout-store';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

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
  const insets = useSafeAreaInsets();
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
      <View className="flex-1 bg-ink-base">
        {/* Active Header */}
        <View
          className="flex-row items-center justify-between border-b border-ink-hairline bg-ink-card px-5 pb-4"
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className="text-2xl font-bold text-ink-text">Active workout</Text>
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="outline" size="sm" onPress={cancelWorkout} fullWidth={false} className="border-danger-400" textClassName="text-danger-400" />
            <Button label="Save" variant="primary" size="sm" fullWidth={false} onPress={handleSave} />
          </View>
        </View>

        <ScrollView contentContainerClassName="p-5 pb-24">
          {exerciseGroups.map(group => (
            <View key={group.exerciseId} className="mb-8">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-ink-text">{group.exerciseName}</Text>
                {group.sets.length > 1 && (
                  <Pressable
                    onPress={() => copyFirstSetToAll(group.exerciseId)}
                    className="rounded-full border border-ink-hairline px-3 py-1"
                  >
                    <Text className="text-xs text-ink-muted">Fill from set 1</Text>
                  </Pressable>
                )}
              </View>

              {/* Header */}
              <View className="mb-1 flex-row items-center px-2">
                <Text className="w-10 text-center text-[11px] font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>Set</Text>
                <Text className="flex-1 text-center text-[11px] font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>Previous</Text>
                <Text className="w-20 text-center text-[11px] font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>{units === 'imperial' ? 'lbs' : 'kg'}</Text>
                <Text className="w-20 text-center text-[11px] font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>reps</Text>
              </View>

              {group.sets.map((set) => {
                const { globalIndex } = set;
                return (
                  <View
                    key={globalIndex}
                    className="mb-1 flex-row items-center rounded-lg p-2"
                  >
                    <Text className="w-10 text-center text-base text-ink-text" style={NUM_STYLE}>{set.set_number}</Text>
                    <Text className="flex-1 text-center text-sm text-ink-faint" style={NUM_STYLE}>
                      {set.prev_weight != null && set.prev_reps != null
                        ? `${units === 'imperial' ? kgToLbs(set.prev_weight) : set.prev_weight} × ${set.prev_reps}`
                        : '—'}
                    </Text>
                    <View className="w-20 items-center">
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
                        className="h-11 w-16 rounded-lg border border-ink-hairline bg-ink-card text-center text-base text-ink-text"
                        style={NUM_STYLE}
                        placeholderTextColor="#71717A"
                      />
                    </View>
                    <View className="w-20 items-center">
                      <TextInput
                        keyboardType="numeric"
                        value={draftFor(`${globalIndex}-reps`, set.reps > 0 ? String(set.reps) : '')}
                        onChangeText={(v) => {
                          setDraft(`${globalIndex}-reps`, v);
                          updateSet(globalIndex, { reps: parseDraftNum(v) });
                        }}
                        onBlur={clearDraft}
                        className="h-11 w-16 rounded-lg border border-ink-hairline bg-ink-card text-center text-base text-ink-text"
                        style={NUM_STYLE}
                        placeholderTextColor="#71717A"
                      />
                    </View>
                  </View>
                );
              })}

              <Pressable onPress={() => addSet(group.exerciseId)} className="mt-2 py-2">
                <Text className="text-center text-sm font-semibold text-success-500">+ Add set</Text>
              </Pressable>
            </View>
          ))}

          <Button
            label="Add exercise"
            variant="tonal"
            onPress={() => setShowPicker(true)}
            className="mt-2"
          />
        </ScrollView>

        {/* Rest timer floating bar */}
        {restEndsAt
          ? (
              <View
                className="absolute inset-x-5 flex-row items-center justify-between rounded-2xl bg-success-500 px-5 py-4 shadow-lg"
                style={{ bottom: insets.bottom + 12 }}
              >
                <Text className="text-lg font-bold text-black" style={NUM_STYLE}>
                  Rest
                  {'  '}
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
              <View
                className="absolute inset-x-5 flex-row items-center justify-between rounded-2xl border border-ink-hairline bg-ink-card px-4 py-3"
                style={{ bottom: insets.bottom + 12 }}
              >
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => setRestDuration(restDuration - 15)}
                    className="size-8 items-center justify-center rounded-full border border-ink-hairline"
                  >
                    <Text className="text-base text-ink-text">−</Text>
                  </Pressable>
                  <Text className="w-12 text-center text-base font-semibold text-ink-text" style={NUM_STYLE}>
                    {Math.floor(restDuration / 60)}
                    :
                    {String(restDuration % 60).padStart(2, '0')}
                  </Text>
                  <Pressable
                    onPress={() => setRestDuration(restDuration + 15)}
                    className="size-8 items-center justify-center rounded-full border border-ink-hairline"
                  >
                    <Text className="text-base text-ink-text">+</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={startRest}
                  className="rounded-lg bg-success-500 px-4 py-2"
                >
                  <Text className="text-sm font-bold text-black">Start rest</Text>
                </Pressable>
              </View>
            )}

        {/* Exercise Picker Modal */}
        <Modal visible={showPicker} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/60">
            <View
              className="max-h-[80%] rounded-t-3xl border-t border-ink-hairline bg-ink-card p-6"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="mb-4 h-1 w-10 self-center rounded-full bg-ink-hairline" />
              <Text className="mb-4 text-xl font-bold text-ink-text">Add exercise</Text>
              <TextInput
                placeholder="Search exercises…"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="mb-4 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
                placeholderTextColor="#71717A"
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 max-h-10">
                {muscleGroups.map(mg => (
                  <Pressable
                    key={mg}
                    onPress={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
                    className={`mr-2 rounded-full border px-3 py-1.5 ${muscleFilter === mg ? 'border-success-500 bg-success-500' : 'border-ink-hairline bg-transparent'}`}
                  >
                    <Text className={muscleFilter === mg ? 'text-sm font-semibold text-black' : 'text-sm text-ink-muted'}>{mg}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <FlatList
                data={filteredExercises}
                keyExtractor={e => String(e.id)}
                className="max-h-72"
                ItemSeparatorComponent={() => <View className="h-px bg-ink-hairline" />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      addExercise(item.id);
                      setShowPicker(false);
                      setSearchQuery('');
                      setMuscleFilter(null);
                    }}
                    className="py-3"
                  >
                    <Text className="text-base text-ink-text">{item.name}</Text>
                    <Text className="mt-0.5 text-xs text-ink-faint">
                      {item.primary_muscle_group}
                      {' · '}
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
                className="mt-3"
                textClassName="text-ink-muted no-underline"
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // History view
  return (
    <View className="flex-1 bg-ink-base">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 }}
        contentContainerClassName="px-5"
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor="#22C55E" />}
      >
        <Text className="mb-1 text-3xl font-bold text-ink-text">Workouts</Text>
        <Text className="mb-8 text-sm text-ink-faint">History</Text>

        {recentSessions.length === 0
          ? (
              <View className="rounded-2xl border border-ink-hairline bg-ink-card p-8">
                <Text className="mb-2 text-center text-base text-ink-text">
                  No workouts yet.
                </Text>
                <Text className="text-center text-sm text-ink-muted">
                  Start your first session — your history will live here.
                </Text>
              </View>
            )
          : (
              <View>
                {recentSessions.map((session, idx) => (
                  <Pressable
                    key={session.id}
                    onPress={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                    className={`py-4 ${idx > 0 ? 'border-t border-ink-hairline' : ''}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-base font-semibold text-ink-text">{formatRelativeDate(session.date)}</Text>
                      {session.set_count != null && session.set_count > 0 && (
                        <Text className="text-xs text-ink-faint" style={NUM_STYLE}>
                          {session.set_count}
                          {' '}
                          {session.set_count === 1 ? 'set' : 'sets'}
                        </Text>
                      )}
                    </View>
                    {session.exercise_names && (
                      <Text className="mt-1 text-sm text-ink-muted" numberOfLines={2}>
                        {session.exercise_names}
                      </Text>
                    )}
                    {expandedSession === session.id && sessionSets.length > 0 && (
                      <View className="mt-3 rounded-xl border border-ink-hairline bg-ink-card p-3">
                        {sessionSets.map(set => (
                          <View key={set.id} className="flex-row items-center justify-between py-1">
                            <Text className="text-sm text-ink-text">{set.exercise_name}</Text>
                            <Text className="text-sm text-ink-muted" style={NUM_STYLE}>
                              {formatWeight(set.weight, units).split(' ')[0]}
                              {' × '}
                              {set.reps}
                              {set.rest_time_sec ? `  · ${set.rest_time_sec}s` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

        {recentSessions.length > 0 && recentSessions.length >= sessionsLimit && (
          <Pressable
            onPress={loadMoreSessions}
            className="mt-6 items-center py-3"
          >
            <Text className="text-sm font-semibold text-success-500">Load older sessions</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={startWorkout}
        className="absolute right-5 size-16 items-center justify-center rounded-full bg-success-500 shadow-lg"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Text className="text-3xl font-bold text-black">+</Text>
      </Pressable>
    </View>
  );
}
