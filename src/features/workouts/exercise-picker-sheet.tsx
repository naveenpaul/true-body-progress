import type { Exercise } from '@/lib/types';
import * as React from 'react';
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';

type BaseProps = {
  visible: boolean;
  title: string;
  exercises: Exercise[];
  onClose: () => void;
};

// Single: tap an exercise to pick it and close (e.g. history filter).
// Multi: tap to tick several, then "Add N" adds them all in tap order.
type Props = BaseProps & (
  | { multiSelect?: false; onSelect: (exercise: Exercise) => void }
  | { multiSelect: true; onSelectMany: (exercises: Exercise[]) => void; alreadyAddedIds?: number[] }
);

export function ExercisePickerSheet(props: Props) {
  const { visible, title, exercises, onClose } = props;
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const alreadyAdded = new Set(props.multiSelect ? props.alreadyAddedIds ?? [] : []);

  const close = () => {
    setSearchQuery('');
    setMuscleFilter(null);
    setSelectedIds([]);
    onClose();
  };

  const toggle = (id: number) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const confirmMany = () => {
    if (!props.multiSelect)
      return;
    const byId = new Map(exercises.map(e => [e.id, e]));
    props.onSelectMany(selectedIds.map(id => byId.get(id)).filter((e): e is Exercise => e != null));
    close();
  };

  const query = searchQuery.toLowerCase();
  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(query)
    && (!muscleFilter || e.primary_muscle_group === muscleFilter),
  );
  const muscleGroups = [...new Set(exercises.map(e => e.primary_muscle_group))].sort();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="max-h-[85%] rounded-t-3xl border-t border-ink-hairline bg-ink-card p-6"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-ink-hairline" />
          <Text className="mb-4 text-xl font-bold text-ink-text">{title}</Text>
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
            data={filtered}
            keyExtractor={e => String(e.id)}
            className="max-h-96"
            keyboardShouldPersistTaps="handled"
            extraData={selectedIds}
            ItemSeparatorComponent={() => <View className="h-px bg-ink-hairline" />}
            renderItem={({ item }) => {
              const added = alreadyAdded.has(item.id);
              const order = selectedIds.indexOf(item.id);
              const selected = order >= 0;
              return (
                <Pressable
                  disabled={added}
                  onPress={() => {
                    if (props.multiSelect) {
                      toggle(item.id);
                      return;
                    }
                    props.onSelect(item);
                    close();
                  }}
                  className={`flex-row items-center py-3 ${added ? 'opacity-40' : ''}`}
                >
                  <View className="flex-1">
                    <Text className={`text-base ${selected ? 'font-semibold text-success-500' : 'text-ink-text'}`}>{item.name}</Text>
                    <Text className="mt-0.5 text-xs text-ink-faint">
                      {item.primary_muscle_group}
                      {' · '}
                      {item.equipment_type.replace('_', ' ')}
                      {added ? ' · added' : ''}
                    </Text>
                  </View>
                  {props.multiSelect && !added && (
                    <View className={`size-7 items-center justify-center rounded-full border ${selected ? 'border-success-500 bg-success-500' : 'border-ink-hairline'}`}>
                      {selected && <Text className="text-xs font-bold text-black">{order + 1}</Text>}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />

          {props.multiSelect
            ? (
                <View className="mt-3 flex-row gap-2">
                  <Button label="Cancel" variant="ghost" fullWidth={false} onPress={close} textClassName="text-ink-muted no-underline" />
                  <View className="flex-1">
                    <Button
                      label={selectedIds.length > 0 ? `Add ${selectedIds.length} exercise${selectedIds.length === 1 ? '' : 's'}` : 'Tap exercises to select'}
                      variant="primary"
                      disabled={selectedIds.length === 0}
                      onPress={confirmMany}
                    />
                  </View>
                </View>
              )
            : (
                <Button
                  label="Close"
                  variant="ghost"
                  onPress={close}
                  className="mt-3"
                  textClassName="text-ink-muted no-underline"
                />
              )}
        </View>
      </View>
    </Modal>
  );
}
