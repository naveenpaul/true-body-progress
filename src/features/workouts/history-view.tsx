import type { TextStyle } from 'react-native';

import type { RoutineDraft } from './routine-editor-sheet';
import type { HistoryRangeKey } from '@/lib/dates';
import type { Routine, UnitSystem, WorkoutSetWithExercise } from '@/lib/types';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';
import { formatRelativeDate, formatShortDate } from '@/lib/dates';
import { pickNextRoutine } from '@/lib/db/routine-repo';
import { displayToMetres, distanceUnit, kgToLbs, lbsToKg, metresToDisplay } from '@/lib/units';

import { ExercisePickerSheet } from './exercise-picker-sheet';
import { RoutineEditorSheet } from './routine-editor-sheet';
import { RoutineStartSheet } from './routine-start-sheet';
import { formatSeconds, parseDuration } from './set-utils';
import { useWorkoutStore } from './use-workout-store';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

const HISTORY_RANGES: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: '3 months' },
];

// Today/Yesterday stay relative; anything older shows the real date so browsing
// past weeks and months is unambiguous.
function historyDateLabel(date: string): string {
  const rel = formatRelativeDate(date);
  return rel === 'Today' || rel === 'Yesterday' ? rel : formatShortDate(date);
}

function formatHistorySet(set: WorkoutSetWithExercise, units: UnitSystem): string {
  const w = units === 'imperial' ? kgToLbs(set.weight) : set.weight;
  // Sets logged before tracking types existed have no duration/distance —
  // fall back to weight × reps for them.
  if (set.tracking_type === 'time' && set.duration_sec != null)
    return formatSeconds(set.duration_sec);
  if (set.tracking_type === 'cardio' && (set.duration_sec != null || set.distance_m != null)) {
    const parts: string[] = [];
    if (set.duration_sec)
      parts.push(`${Math.round(set.duration_sec / 60)} min`);
    if (set.distance_m)
      parts.push(`${metresToDisplay(set.distance_m, units)} ${distanceUnit(units)}`);
    return parts.join(' · ');
  }
  if (set.tracking_type === 'bodyweight_reps')
    return `${set.weight > 0 ? `BW+${w}` : 'BW'} × ${set.reps}`;
  return `${w} × ${set.reps}`;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-3 py-1.5 ${active ? 'border-success-500 bg-success-500' : 'border-ink-hairline bg-transparent'}`}
    >
      <Text className={active ? 'text-sm font-semibold text-black' : 'text-sm text-ink-muted'}>{label}</Text>
    </Pressable>
  );
}

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
export function HistoryView({ onRefresh }: { onRefresh: () => void }) {
  const insets = useSafeAreaInsets();
  const units = useUserStore.use.user()?.preferred_units ?? 'metric';
  const exercises = useWorkoutStore.use.exercises();
  const recentSessions = useWorkoutStore.use.recentSessions();
  const sessionsLimit = useWorkoutStore.use.sessionsLimit();
  const loadMoreSessions = useWorkoutStore.use.loadMoreSessions();
  const historyRange = useWorkoutStore.use.historyRange();
  const historyExerciseId = useWorkoutStore.use.historyExerciseId();
  const historyRoutineId = useWorkoutStore.use.historyRoutineId();
  const setHistoryRange = useWorkoutStore.use.setHistoryRange();
  const setHistoryExercise = useWorkoutStore.use.setHistoryExercise();
  const setHistoryRoutine = useWorkoutStore.use.setHistoryRoutine();
  const routines = useWorkoutStore.use.routines();
  const lastRoutineId = useWorkoutStore.use.lastRoutineId();
  const createRoutine = useWorkoutStore.use.createRoutine();
  const updateRoutine = useWorkoutStore.use.updateRoutine();
  const deleteRoutine = useWorkoutStore.use.deleteRoutine();
  const moveRoutine = useWorkoutStore.use.moveRoutine();
  const getRoutineExercises = useWorkoutStore.use.getRoutineExercises();
  const startWorkout = useWorkoutStore.use.startWorkout();
  const getSessionSets = useWorkoutStore.use.getSessionSets();
  const updateHistorySet = useWorkoutStore.use.updateHistorySet();
  const deleteHistorySet = useWorkoutStore.use.deleteHistorySet();
  const deleteSession = useWorkoutStore.use.deleteSession();

  const [showStartSheet, setShowStartSheet] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [routineDraftState, setRoutineDraftState] = useState<RoutineDraft | null>(null);
  const routineDraft = routineDraftState;
  // Bumped on every open so the editor remounts with fresh local state.
  const [editorKey, setEditorKey] = useState(0);
  const setRoutineDraft = (draft: RoutineDraft | null) => {
    if (draft)
      setEditorKey(k => k + 1);
    setRoutineDraftState(draft);
  };
  // iOS can't present a modal while another is still animating out, so the
  // editor opened from the start sheet waits for its onDismiss.
  const [pendingDraft, setPendingDraft] = useState<RoutineDraft | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dateSets, dispatchSessionSets] = useReducer(sessionSetsReducer, []);
  const [editingSet, setEditingSet] = useState<WorkoutSetWithExercise | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editDistance, setEditDistance] = useState('');

  const clearSessionSets = useCallback(() => dispatchSessionSets({ type: 'clear' }), []);
  const replaceSessionSets = useCallback(
    (sets: WorkoutSetWithExercise[]) => dispatchSessionSets({ type: 'replace', sets }),
    [],
  );

  const nextRoutine = pickNextRoutine(routines, lastRoutineId);
  const historyExerciseName = exercises.find(e => e.id === historyExerciseId)?.name;
  const isHistoryFiltered = historyRange !== 'all' || historyExerciseId != null || historyRoutineId != null;
  const wUnit = units === 'imperial' ? 'lbs' : 'kg';

  // Group sessions by calendar date so the history reads as one entry per day.
  // Memoize so the effect below doesn't refire on every render and infinite-loop.
  const sessionsByDate = useMemo(() => {
    return recentSessions.reduce<Record<string, typeof recentSessions>>((acc, s) => {
      (acc[s.date] ??= []).push(s);
      return acc;
    }, {});
  }, [recentSessions]);
  const groupedDates = useMemo(
    () => Object.keys(sessionsByDate).sort((a, b) => (a < b ? 1 : -1)),
    [sessionsByDate],
  );

  useEffect(() => {
    if (!expandedDate) {
      clearSessionSets();
      return;
    }
    const sessionsForDate = sessionsByDate[expandedDate] ?? [];
    let cancelled = false;
    clearSessionSets();
    Promise.all(sessionsForDate.map(s => getSessionSets(s.id))).then((all) => {
      if (cancelled)
        return;
      replaceSessionSets(all.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [clearSessionSets, expandedDate, getSessionSets, replaceSessionSets, sessionsByDate]);

  // ── Routines ────────────────────────────────────────────────────────────

  const openEditorFromStartSheet = (draft: RoutineDraft) => {
    setShowStartSheet(false);
    if (Platform.OS === 'ios')
      setPendingDraft(draft);
    else
      setRoutineDraft(draft);
  };

  const loadRoutineDraft = async (r: Routine): Promise<RoutineDraft> => {
    const items = await getRoutineExercises(r.id);
    return {
      id: r.id,
      name: r.name,
      items: items.map(it => ({
        exercise_id: it.exercise_id,
        exercise_name: it.exercise_name,
        target_sets: it.target_sets,
        rep_min: it.rep_min,
        rep_max: it.rep_max,
      })),
    };
  };

  const saveRoutineDraft = async (draft: RoutineDraft) => {
    const items = draft.items.map((it) => {
      // Accept "12–8" by swapping into a sensible range.
      const swap = it.rep_min != null && it.rep_max != null && it.rep_min > it.rep_max;
      return {
        exercise_id: it.exercise_id,
        target_sets: it.target_sets,
        rep_min: swap ? it.rep_max : it.rep_min,
        rep_max: swap ? it.rep_min : it.rep_max,
      };
    });
    if (draft.id == null)
      await createRoutine(draft.name, items);
    else
      await updateRoutine(draft.id, draft.name, items);
    setRoutineDraft(null);
  };

  const saveDayAsRoutine = (date: string) => {
    const items: RoutineDraft['items'] = [];
    for (const s of dateSets) {
      const existing = items.find(i => i.exercise_id === s.exercise_id);
      if (existing)
        existing.target_sets += 1;
      else
        items.push({ exercise_id: s.exercise_id, exercise_name: s.exercise_name, target_sets: 1, rep_min: null, rep_max: null });
    }
    const suggestedName = sessionsByDate[date]?.find(s => s.routine_name)?.routine_name ?? '';
    setRoutineDraft({ id: null, name: suggestedName, items });
  };

  const editorIndex = routines.findIndex(r => r.id === routineDraft?.id);

  // ── History edits ───────────────────────────────────────────────────────

  const openEditSet = (s: WorkoutSetWithExercise) => {
    setEditingSet(s);
    setEditWeight(String(units === 'imperial' ? kgToLbs(s.weight) : s.weight));
    setEditReps(String(s.reps));
    setEditDuration(s.duration_sec != null
      ? (s.tracking_type === 'cardio' ? String(Math.round(s.duration_sec / 60)) : formatSeconds(s.duration_sec))
      : '');
    setEditDistance(s.distance_m != null ? String(metresToDisplay(s.distance_m, units)) : '');
  };

  const saveEditSet = async () => {
    if (!editingSet)
      return;
    const num = (v: string) => Number.parseFloat(v.replace(',', '.')) || 0;
    const t = editingSet.tracking_type;
    const isLegacy = editingSet.duration_sec == null && editingSet.distance_m == null;
    if ((t === 'time' || t === 'cardio') && !isLegacy) {
      await updateHistorySet(editingSet.id, {
        reps: editingSet.reps,
        weight: editingSet.weight,
        duration_sec: t === 'cardio' ? Math.round(num(editDuration) * 60) : parseDuration(editDuration),
        distance_m: t === 'cardio' ? displayToMetres(num(editDistance), units) : null,
      });
    }
    else {
      const w = num(editWeight);
      await updateHistorySet(editingSet.id, {
        reps: Math.max(1, Math.floor(num(editReps))),
        weight: units === 'imperial' ? lbsToKg(w) : w,
      });
    }
    setEditingSet(null);
  };

  const confirmDeleteSet = () => {
    if (!editingSet)
      return;
    const id = editingSet.id;
    Alert.alert('Delete set?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHistorySet(id);
          setEditingSet(null);
        },
      },
    ]);
  };

  const confirmDeleteDate = (date: string) => {
    const sessionsForDate = sessionsByDate[date] ?? [];
    Alert.alert(
      'Delete entire day?',
      'All workouts for this date will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const s of sessionsForDate)
              await deleteSession(s.id);
            if (expandedDate === date)
              setExpandedDate(null);
          },
        },
      ],
    );
  };

  const editingIsTimed = editingSet != null
    && (editingSet.tracking_type === 'time' || editingSet.tracking_type === 'cardio')
    && (editingSet.duration_sec != null || editingSet.distance_m != null);

  return (
    <View className="flex-1 bg-ink-base">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 }}
        contentContainerClassName="px-5"
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#22C55E" />}
      >
        <Text className="mb-6 text-3xl font-bold text-ink-text">Workouts</Text>

        {/* Routines */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-ink-faint uppercase">Routines</Text>
          <Pressable onPress={() => setRoutineDraft({ id: null, name: '', items: [] })} hitSlop={8}>
            <Text className="text-sm font-semibold text-success-500">+ New</Text>
          </Pressable>
        </View>
        {routines.length === 0
          ? (
              <Text className="mb-6 text-sm text-ink-muted">
                Group exercises into a routine (Push, Pull, Legs…) and start it in one tap — or open a past day below and tap "Save as routine".
              </Text>
            )
          : (
              <View className="mb-6">
                {routines.map(r => (
                  <Pressable
                    key={r.id}
                    onPress={async () => setRoutineDraft(await loadRoutineDraft(r))}
                    className="mb-2 flex-row items-center rounded-2xl border border-ink-hairline bg-ink-card p-4"
                  >
                    <View className="mr-3 flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-semibold text-ink-text">{r.name}</Text>
                        {r.id === nextRoutine?.id && <Text className="text-[10px] font-bold text-success-500 uppercase">Up next</Text>}
                      </View>
                      {!!r.exercise_names && <Text className="mt-0.5 text-xs text-ink-muted" numberOfLines={1}>{r.exercise_names}</Text>}
                    </View>
                    <Pressable onPress={() => void startWorkout(r.id)} className="rounded-lg bg-success-500 px-3 py-2">
                      <Text className="text-sm font-bold text-black">Start</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}

        {/* History filters */}
        <Text className="mb-2 text-sm font-semibold text-ink-faint uppercase">History</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mb-2" contentContainerClassName="px-5">
          {HISTORY_RANGES.map(r => (
            <Chip
              key={r.key}
              label={r.label}
              active={historyRange === r.key}
              onPress={() => {
                setExpandedDate(null);
                void setHistoryRange(r.key);
              }}
            />
          ))}
        </ScrollView>
        {routines.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mb-2" contentContainerClassName="px-5">
            <Chip
              label="Any routine"
              active={historyRoutineId == null}
              onPress={() => {
                setExpandedDate(null);
                void setHistoryRoutine(null);
              }}
            />
            {routines.map(r => (
              <Chip
                key={r.id}
                label={r.name}
                active={historyRoutineId === r.id}
                onPress={() => {
                  setExpandedDate(null);
                  void setHistoryRoutine(r.id);
                }}
              />
            ))}
          </ScrollView>
        )}
        <View className="mb-6 flex-row items-center gap-2">
          <Pressable
            onPress={() => setShowFilterPicker(true)}
            className={`flex-1 rounded-xl border px-3 py-2 ${historyExerciseId != null ? 'border-success-500' : 'border-ink-hairline'}`}
          >
            <Text className={historyExerciseId != null ? 'text-sm font-semibold text-success-500' : 'text-sm text-ink-muted'} numberOfLines={1}>
              {historyExerciseName ?? 'All exercises'}
            </Text>
          </Pressable>
          {historyExerciseId != null && (
            <Pressable
              onPress={() => {
                setExpandedDate(null);
                void setHistoryExercise(null);
              }}
              className="rounded-xl border border-ink-hairline px-3 py-2"
            >
              <Text className="text-sm text-ink-muted">Clear</Text>
            </Pressable>
          )}
        </View>

        {recentSessions.length === 0
          ? (
              <View className="rounded-2xl border border-ink-hairline bg-ink-card p-8">
                <Text className="mb-2 text-center text-base text-ink-text">
                  {isHistoryFiltered ? 'No workouts match this filter.' : 'No workouts yet.'}
                </Text>
                <Text className="text-center text-sm text-ink-muted">
                  {isHistoryFiltered ? 'Try a wider date range or a different filter.' : 'Start your first session — your history will live here.'}
                </Text>
              </View>
            )
          : (
              <View>
                {groupedDates.map((date, idx) => {
                  const sessionsForDate = sessionsByDate[date];
                  const totalVolume = sessionsForDate.reduce((sum, s) => sum + (s.total_volume ?? 0), 0);
                  const totalSets = sessionsForDate.reduce((sum, s) => sum + (s.set_count ?? 0), 0);
                  const totalReps = sessionsForDate.reduce((sum, s) => sum + (s.total_reps ?? 0), 0);
                  // Average load per rep across all sets that day, rounded.
                  const avgKg = totalReps > 0 ? totalVolume / totalReps : 0;
                  const avgDisplay = units === 'imperial' ? Math.round(kgToLbs(avgKg)) : Math.round(avgKg);
                  const summary = totalSets > 0 ? (avgKg > 0 ? `${totalSets}×${avgDisplay}${wUnit}` : `${totalSets} sets`) : '';
                  const routineNames = [...new Set(sessionsForDate.map(s => s.routine_name).filter(Boolean))].join(' + ');
                  const exerciseNames = [
                    ...new Set(
                      sessionsForDate
                        .flatMap(s => (s.exercise_names ?? '').split(', '))
                        .filter(Boolean),
                    ),
                  ].join(', ');
                  const isExpanded = expandedDate === date;
                  // Group sets by exercise so the expanded view reads like the active workout view.
                  const setsByExercise = dateSets.reduce<Array<{ name: string; sets: WorkoutSetWithExercise[] }>>((groups, set) => {
                    const existing = groups.find(g => g.name === set.exercise_name);
                    if (existing)
                      existing.sets.push(set);
                    else
                      groups.push({ name: set.exercise_name, sets: [set] });
                    return groups;
                  }, []);
                  return (
                    <View key={date} className={idx > 0 ? 'border-t border-ink-hairline' : ''}>
                      <Pressable
                        onPress={() => setExpandedDate(isExpanded ? null : date)}
                        onLongPress={() => confirmDeleteDate(date)}
                        className="py-4"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 flex-row items-center gap-2">
                            <Text className="text-base font-semibold text-ink-text">{historyDateLabel(date)}</Text>
                            {!!routineNames && (
                              <View className="rounded-full border border-ink-hairline px-2 py-0.5">
                                <Text className="text-[11px] text-ink-muted">{routineNames}</Text>
                              </View>
                            )}
                          </View>
                          {summary !== '' && (
                            <Text className="text-xs text-ink-faint" style={NUM_STYLE}>{summary}</Text>
                          )}
                        </View>
                        {!!exerciseNames && (
                          <Text className="mt-1 text-sm text-ink-muted" numberOfLines={2}>
                            {exerciseNames}
                          </Text>
                        )}
                      </Pressable>
                      {isExpanded && (
                        <View className="mb-4 rounded-xl border border-ink-hairline bg-ink-card p-3">
                          {setsByExercise.length === 0
                            ? <Text className="py-2 text-center text-sm text-ink-faint">Loading…</Text>
                            : setsByExercise.map(group => (
                                <View key={group.name} className="mb-2">
                                  <Text className="mb-1 text-sm font-semibold text-ink-text">{group.name}</Text>
                                  {group.sets.map(set => (
                                    <View key={set.id} className="flex-row items-center justify-between py-1.5">
                                      <Text className="text-sm text-ink-muted" style={NUM_STYLE}>
                                        {`Set ${set.set_number}`}
                                      </Text>
                                      <View className="flex-row items-center gap-3">
                                        <Text className="text-sm text-ink-text" style={NUM_STYLE}>
                                          {formatHistorySet(set, units)}
                                        </Text>
                                        <Pressable
                                          onPress={() => openEditSet(set)}
                                          className="rounded-md border border-ink-hairline px-2 py-1"
                                        >
                                          <Text className="text-xs font-semibold text-success-500">Edit</Text>
                                        </Pressable>
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              ))}
                          <View className="mt-2 flex-row border-t border-ink-hairline">
                            {setsByExercise.length > 0 && (
                              <Pressable onPress={() => saveDayAsRoutine(date)} className="flex-1 items-center py-2">
                                <Text className="text-sm font-semibold text-success-500">Save as routine</Text>
                              </Pressable>
                            )}
                            <Pressable onPress={() => confirmDeleteDate(date)} className="flex-1 items-center py-2">
                              <Text className="text-sm font-semibold text-danger-400">Delete day</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
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

      {/* Edit set modal */}
      <Modal visible={editingSet != null} animationType="fade" transparent onRequestClose={() => setEditingSet(null)}>
        <Pressable
          onPress={() => setEditingSet(null)}
          className="flex-1 items-center justify-center bg-black/60 px-8"
        >
          <Pressable onPress={e => e.stopPropagation()} className="w-full rounded-2xl border border-ink-hairline bg-ink-card p-5">
            <Text className="mb-1 text-lg font-bold text-ink-text">{editingSet?.exercise_name}</Text>
            <Text className="mb-4 text-xs text-ink-faint">{`Set ${editingSet?.set_number ?? ''}`}</Text>
            <View className="mb-3 flex-row gap-3">
              {editingIsTimed
                ? (
                    <>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-ink-faint uppercase">
                          {editingSet?.tracking_type === 'cardio' ? 'min' : 'time (m:ss)'}
                        </Text>
                        <TextInput
                          keyboardType="numbers-and-punctuation"
                          value={editDuration}
                          onChangeText={setEditDuration}
                          className="h-11 rounded-lg border border-ink-hairline bg-ink-base px-3 text-base text-ink-text"
                          style={NUM_STYLE}
                        />
                      </View>
                      {editingSet?.tracking_type === 'cardio' && (
                        <View className="flex-1">
                          <Text className="mb-1 text-xs text-ink-faint uppercase">{distanceUnit(units)}</Text>
                          <TextInput
                            keyboardType="numeric"
                            value={editDistance}
                            onChangeText={setEditDistance}
                            className="h-11 rounded-lg border border-ink-hairline bg-ink-base px-3 text-base text-ink-text"
                            style={NUM_STYLE}
                          />
                        </View>
                      )}
                    </>
                  )
                : (
                    <>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-ink-faint uppercase">
                          {editingSet?.tracking_type === 'bodyweight_reps' ? `+${wUnit}` : wUnit}
                        </Text>
                        <TextInput
                          keyboardType="numeric"
                          value={editWeight}
                          onChangeText={setEditWeight}
                          className="h-11 rounded-lg border border-ink-hairline bg-ink-base px-3 text-base text-ink-text"
                          style={NUM_STYLE}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-ink-faint uppercase">reps</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={editReps}
                          onChangeText={setEditReps}
                          className="h-11 rounded-lg border border-ink-hairline bg-ink-base px-3 text-base text-ink-text"
                          style={NUM_STYLE}
                        />
                      </View>
                    </>
                  )}
            </View>
            <View className="flex-row gap-2">
              <Button label="Delete" variant="outline" size="sm" fullWidth={false} onPress={confirmDeleteSet} className="border-danger-400" textClassName="text-danger-400" />
              <View className="flex-1" />
              <Button label="Cancel" variant="ghost" size="sm" fullWidth={false} onPress={() => setEditingSet(null)} />
              <Button label="Save" variant="primary" size="sm" fullWidth={false} onPress={saveEditSet} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ExercisePickerSheet
        visible={showFilterPicker}
        title="Filter by exercise"
        exercises={exercises}
        onSelect={(ex) => {
          setExpandedDate(null);
          void setHistoryExercise(ex.id);
        }}
        onClose={() => setShowFilterPicker(false)}
      />

      <RoutineStartSheet
        visible={showStartSheet}
        routines={routines}
        nextRoutineId={nextRoutine?.id ?? null}
        onStart={(id) => {
          setShowStartSheet(false);
          void startWorkout(id);
        }}
        onEdit={async r => openEditorFromStartSheet(await loadRoutineDraft(r))}
        onCreate={() => openEditorFromStartSheet({ id: null, name: '', items: [] })}
        onClose={() => setShowStartSheet(false)}
        onDismiss={() => {
          if (pendingDraft) {
            setRoutineDraft(pendingDraft);
            setPendingDraft(null);
          }
        }}
      />

      <RoutineEditorSheet
        key={editorKey}
        draft={routineDraft}
        exercises={exercises}
        canMoveEarlier={editorIndex > 0}
        canMoveLater={editorIndex >= 0 && editorIndex < routines.length - 1}
        onSave={draft => void saveRoutineDraft(draft)}
        onDelete={async (id) => {
          await deleteRoutine(id);
          setRoutineDraft(null);
        }}
        onMove={(id, dir) => void moveRoutine(id, dir)}
        onClose={() => setRoutineDraft(null)}
      />

      {/* FAB */}
      <Pressable
        onPress={() => setShowStartSheet(true)}
        className="absolute right-5 size-16 items-center justify-center rounded-full bg-success-500 shadow-lg"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Text className="text-3xl font-bold text-black">+</Text>
      </Pressable>
    </View>
  );
}
