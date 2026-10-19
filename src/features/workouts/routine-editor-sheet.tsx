import type { Exercise, RoutineExerciseInput } from '@/lib/types';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';

import { ExercisePickerSheet } from './exercise-picker-sheet';

export type RoutineDraftItem = RoutineExerciseInput & { exercise_name: string };

export type RoutineDraft = {
  id: number | null; // null = new routine
  name: string;
  items: RoutineDraftItem[];
};

type Props = {
  draft: RoutineDraft | null; // null = hidden
  exercises: Exercise[];
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onSave: (draft: RoutineDraft) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  onClose: () => void;
};

function parseOptionalInt(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={() => onChange(Math.max(1, value - 1))}
        className="size-7 items-center justify-center rounded-full border border-ink-hairline"
      >
        <Text className="text-ink-text">−</Text>
      </Pressable>
      <Text className="w-5 text-center text-sm font-semibold text-ink-text">{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(20, value + 1))}
        className="size-7 items-center justify-center rounded-full border border-ink-hairline"
      >
        <Text className="text-ink-text">+</Text>
      </Pressable>
    </View>
  );
}

export function RoutineEditorSheet({ draft, exercises, canMoveEarlier, canMoveLater, onSave, onDelete, onMove, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // Parent remounts this sheet (via key) for each routine opened, so the
  // draft only seeds state once.
  const [name, setName] = useState(() => draft?.name ?? '');
  const [items, setItems] = useState<RoutineDraftItem[]>(() => draft?.items ?? []);
  const [showPicker, setShowPicker] = useState(false);

  const updateItem = (idx: number, patch: Partial<RoutineDraftItem>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const moveItem = (idx: number, dir: -1 | 1) =>
    setItems((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length)
        return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name your routine', 'e.g. Push Day, Legs, Upper A.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Add an exercise', 'A routine needs at least one exercise.');
      return;
    }
    onSave({ id: draft?.id ?? null, name: trimmed, items });
  };

  const confirmDelete = () => {
    if (draft?.id == null)
      return;
    const id = draft.id;
    Alert.alert(`Delete ${draft.name}?`, 'Past workouts stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
    ]);
  };

  return (
    <Modal visible={draft != null} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="max-h-[90%] rounded-t-3xl border-t border-ink-hairline bg-ink-card p-6"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-ink-hairline" />
          <Text className="mb-3 text-xl font-bold text-ink-text">{draft?.id == null ? 'New routine' : 'Edit routine'}</Text>

          <TextInput
            placeholder="Routine name (e.g. Push Day)"
            value={name}
            onChangeText={setName}
            className="mb-4 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
            placeholderTextColor="#71717A"
          />

          <ScrollView className="mb-3" keyboardShouldPersistTaps="handled">
            {items.length === 0 && (
              <Text className="py-4 text-center text-sm text-ink-faint">No exercises yet.</Text>
            )}
            {items.map((it, idx) => (
              <View key={it.exercise_id} className="border-b border-ink-hairline py-3">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="flex-1 text-base font-semibold text-ink-text" numberOfLines={1}>{it.exercise_name}</Text>
                  <View className="flex-row items-center gap-3">
                    <Pressable onPress={() => moveItem(idx, -1)} disabled={idx === 0} hitSlop={6}>
                      <Text className={idx === 0 ? 'text-ink-hairline' : 'text-ink-muted'}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => moveItem(idx, 1)} disabled={idx === items.length - 1} hitSlop={6}>
                      <Text className={idx === items.length - 1 ? 'text-ink-hairline' : 'text-ink-muted'}>↓</Text>
                    </Pressable>
                    <Pressable onPress={() => setItems(prev => prev.filter((_, i) => i !== idx))} hitSlop={6}>
                      <Text className="text-lg text-danger-400">×</Text>
                    </Pressable>
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-ink-faint uppercase">Sets</Text>
                    <Stepper value={it.target_sets} onChange={v => updateItem(idx, { target_sets: v })} />
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="mr-1 text-xs text-ink-faint uppercase">Reps</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="8"
                      value={it.rep_min != null ? String(it.rep_min) : ''}
                      onChangeText={v => updateItem(idx, { rep_min: parseOptionalInt(v) })}
                      className="h-8 w-10 rounded-md border border-ink-hairline bg-ink-base text-center text-sm text-ink-text"
                      placeholderTextColor="#52525B"
                    />
                    <Text className="text-ink-faint">–</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="12"
                      value={it.rep_max != null ? String(it.rep_max) : ''}
                      onChangeText={v => updateItem(idx, { rep_max: parseOptionalInt(v) })}
                      className="h-8 w-10 rounded-md border border-ink-hairline bg-ink-base text-center text-sm text-ink-text"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                </View>
              </View>
            ))}
            <Pressable onPress={() => setShowPicker(true)} className="py-3">
              <Text className="text-center text-sm font-semibold text-success-500">+ Add exercise</Text>
            </Pressable>
          </ScrollView>

          {draft?.id != null && (
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs text-ink-faint">Rotation order</Text>
              <View className="flex-row gap-2">
                <Button label="Earlier" variant="outline" size="sm" fullWidth={false} disabled={!canMoveEarlier} onPress={() => onMove(draft.id!, -1)} />
                <Button label="Later" variant="outline" size="sm" fullWidth={false} disabled={!canMoveLater} onPress={() => onMove(draft.id!, 1)} />
              </View>
            </View>
          )}

          <View className="flex-row gap-2">
            {draft?.id != null && (
              <Button label="Delete" variant="outline" size="sm" fullWidth={false} onPress={confirmDelete} className="border-danger-400" textClassName="text-danger-400" />
            )}
            <View className="flex-1" />
            <Button label="Cancel" variant="ghost" size="sm" fullWidth={false} onPress={onClose} />
            <Button label="Save" variant="primary" size="sm" fullWidth={false} onPress={save} />
          </View>
        </View>

        <ExercisePickerSheet
          visible={showPicker}
          title="Add to routine"
          exercises={exercises}
          onSelect={ex =>
            // Each exercise appears once per routine; use the sets stepper for more.
            setItems(prev => prev.some(it => it.exercise_id === ex.id)
              ? prev
              : [...prev, {
                  exercise_id: ex.id,
                  exercise_name: ex.name,
                  target_sets: ex.tracking_type === 'cardio' ? 1 : 3,
                  rep_min: null,
                  rep_max: null,
                }])}
          onClose={() => setShowPicker(false)}
        />
      </View>
    </Modal>
  );
}
