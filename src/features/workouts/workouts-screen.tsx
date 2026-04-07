import type { WorkoutSetWithExercise } from '@/lib/types';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';
import { formatDuration, formatRelativeDate } from '@/lib/dates';
import { formatWeight, kgToLbs, lbsToKg } from '@/lib/units';

import { useWorkoutStore } from './use-workout-store';

export function WorkoutsScreen() {
  const user = useUserStore.use.user();
  const units = user?.preferred_units ?? 'metric';
  const isActive = useWorkoutStore.use.isActive();
  const activeSets = useWorkoutStore.use.activeSets();
  const startTime = useWorkoutStore.use.startTime();
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
  const completeSet = useWorkoutStore.use.completeSet();
  const getSessionSets = useWorkoutStore.use.getSessionSets();

  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionSets, setSessionSets] = useState<WorkoutSetWithExercise[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Draft mirror for the currently-focused numeric input. Only one input is focused
  // at a time, so a single key/value is enough — no stale-key problems when sets
  // are added/removed and indices shift. Cleared on blur.
  const [inputDraft, setInputDraft] = useState<{ key: string; value: string } | null>(null);
  const draftFor = (key: string, fallback: string) =>
    inputDraft?.key === key ? inputDraft.value : fallback;
  const setDraft = (key: string, value: string) => setInputDraft({ key, value });
  const clearDraft = () => setInputDraft(null);
  const parseDraftNum = (s: string): number => {
    const n = Number.parseFloat(s.replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
  };

  useEffect(() => {
    if (!isActive || !startTime)
      return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive, startTime]);

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
      setSessionSets([]);
      return;
    }
    let cancelled = false;
    setSessionSets([]);
    getSessionSets(expandedSession).then((sets) => {
      if (!cancelled)
        setSessionSets(sets);
    });
    return () => {
      cancelled = true;
    };
  }, [expandedSession, getSessionSets]);

  const elapsedSec = startTime ? Math.floor((nowTick - startTime) / 1000) : 0;

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
    const completedCount = activeSets.filter(s => s.completed).length;
    if (completedCount === 0)
      return;
    await saveWorkout();
    await loadRecentSessions();
  };

  if (isActive) {
    return (
      <View className="flex-1 bg-charcoal-950">
        {/* Active Header */}
        <View className="flex-row items-center justify-between bg-charcoal-900 px-4 pt-14 pb-4">
          <View>
            <Text className="text-xl font-bold text-white">Active Workout</Text>
            <Text className="text-sm text-charcoal-400">{formatDuration(elapsedSec)}</Text>
          </View>
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="outline" size="sm" onPress={cancelWorkout} className="border-danger-500" textClassName="text-danger-500" />
            <Button label="Save" size="sm" onPress={handleSave} className="bg-success-500" textClassName="text-black font-bold" />
          </View>
        </View>

        <ScrollView contentContainerClassName="p-4 pb-20">
          {exerciseGroups.map(group => (
            <View key={group.exerciseId} className="mb-6">
              <Text className="mb-2 text-base font-bold text-white">{group.exerciseName}</Text>

              {/* Header */}
              <View className="mb-1 flex-row items-center px-2">
                <Text className="flex-[0.5] text-center text-xs font-bold text-charcoal-400">Set</Text>
                <Text className="flex-1 text-center text-xs font-bold text-charcoal-400">Previous</Text>
                <Text className="flex-1 text-center text-xs font-bold text-charcoal-400">{units === 'imperial' ? 'lbs × reps' : 'kg × reps'}</Text>
                <Text className="flex-[0.5] text-center text-xs font-bold text-charcoal-400">RPE</Text>
                <View className="w-10" />
              </View>

              {group.sets.map((set) => {
                const { globalIndex } = set;
                return (
                  <View
                    key={globalIndex}
                    className={`mb-0.5 flex-row items-center rounded-lg p-2 ${set.completed ? 'bg-success-500/20' : ''}`}
                  >
                    <Text className="flex-[0.5] text-center text-sm text-white">{set.set_number}</Text>
                    <Text className="flex-1 text-center text-sm text-charcoal-400">
                      {set.prev_weight != null && set.prev_reps != null
                        ? `${units === 'imperial' ? kgToLbs(set.prev_weight) : set.prev_weight}×${set.prev_reps}`
                        : '-'}
                    </Text>
                    <View className="flex-1 flex-row items-center justify-center">
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
                        className="h-9 w-10 rounded-md bg-charcoal-900 text-center text-sm text-white"
                        placeholderTextColor="#7D7D7D"
                      />
                      <Text className="mx-1 text-charcoal-400">×</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={draftFor(`${globalIndex}-reps`, set.reps > 0 ? String(set.reps) : '')}
                        onChangeText={(v) => {
                          setDraft(`${globalIndex}-reps`, v);
                          updateSet(globalIndex, { reps: parseDraftNum(v) });
                        }}
                        onBlur={clearDraft}
                        className="h-9 w-10 rounded-md bg-charcoal-900 text-center text-sm text-white"
                        placeholderTextColor="#7D7D7D"
                      />
                    </View>
                    <TextInput
                      keyboardType="numeric"
                      value={draftFor(`${globalIndex}-rpe`, set.rpe ? String(set.rpe) : '')}
                      onChangeText={(v) => {
                        setDraft(`${globalIndex}-rpe`, v);
                        const n = parseDraftNum(v);
                        updateSet(globalIndex, { rpe: n > 0 ? n : null });
                      }}
                      onBlur={clearDraft}
                      placeholder="-"
                      className="h-9 w-10 flex-[0.5] rounded-md bg-charcoal-900 text-center text-sm text-white"
                      placeholderTextColor="#7D7D7D"
                    />
                    <Pressable
                      onPress={() => completeSet(globalIndex)}
                      className="ml-1 size-8 items-center justify-center"
                    >
                      <Text className={set.completed ? 'text-lg text-success-500' : 'text-lg text-charcoal-500'}>
                        {set.completed ? '✓' : '○'}
                      </Text>
                    </Pressable>
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
      <ScrollView contentContainerClassName="p-4 pb-20 pt-14">
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
                    <Text className="text-xs text-charcoal-400">{formatDuration(session.duration)}</Text>
                  </View>
                  {expandedSession === session.id && sessionSets.map((set, i) => (
                    <Text key={i} className="mt-1 text-sm text-charcoal-200">
                      {set.exercise_name}
                      :
                      {formatWeight(set.weight, units).split(' ')[0]}
                      ×
                      {set.reps}
                      {set.rpe ? ` @${set.rpe}` : ''}
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
