import type { Exercise } from '@/lib/types';
import * as React from 'react';
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';

type Props = {
  visible: boolean;
  title: string;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
};

export function ExercisePickerSheet({ visible, title, exercises, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

  const close = () => {
    setSearchQuery('');
    setMuscleFilter(null);
    onClose();
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
          className="max-h-[80%] rounded-t-3xl border-t border-ink-hairline bg-ink-card p-6"
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
            className="max-h-72"
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View className="h-px bg-ink-hairline" />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  close();
                }}
                className="py-3"
              >
                <Text className="text-base text-ink-text">{item.name}</Text>
                <Text className="mt-0.5 text-xs text-ink-faint">
                  {item.primary_muscle_group}
                  {' · '}
                  {item.equipment_type.replace('_', ' ')}
                </Text>
              </Pressable>
            )}
          />

          <Button
            label="Close"
            variant="ghost"
            onPress={close}
            className="mt-3"
            textClassName="text-ink-muted no-underline"
          />
        </View>
      </View>
    </Modal>
  );
}
