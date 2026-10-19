import type { Routine } from '@/lib/types';
import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';

type Props = {
  visible: boolean;
  routines: Routine[];
  nextRoutineId: number | null;
  onStart: (routineId?: number) => void;
  onEdit: (routine: Routine) => void;
  onCreate: () => void;
  onClose: () => void;
  onDismiss?: () => void;
};

export function RoutineStartSheet({ visible, routines, nextRoutineId, onStart, onEdit, onCreate, onClose, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  // Suggested routine first, the rest in rotation order.
  const ordered = [
    ...routines.filter(r => r.id === nextRoutineId),
    ...routines.filter(r => r.id !== nextRoutineId),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} onDismiss={onDismiss}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/60">
        <Pressable
          onPress={e => e.stopPropagation()}
          className="max-h-[80%] rounded-t-3xl border-t border-ink-hairline bg-ink-card p-6"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-ink-hairline" />
          <Text className="mb-4 text-xl font-bold text-ink-text">Start workout</Text>

          <ScrollView className="max-h-96">
            {ordered.length === 0 && (
              <Text className="mb-4 text-sm text-ink-muted">
                Save a routine (e.g. Push Day) to load all its exercises — with last time's weights — in one tap.
              </Text>
            )}
            {ordered.map((r) => {
              const isNext = r.id === nextRoutineId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onStart(r.id)}
                  onLongPress={() => onEdit(r)}
                  className={`mb-2 rounded-2xl border p-4 ${isNext ? 'border-success-500 bg-success-500/10' : 'border-ink-hairline'}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-ink-text">{r.name}</Text>
                    <View className="flex-row items-center gap-3">
                      {isNext && <Text className="text-xs font-bold text-success-500 uppercase">Up next</Text>}
                      <Pressable onPress={() => onEdit(r)} hitSlop={8}>
                        <Text className="text-xs font-semibold text-ink-muted">Edit</Text>
                      </Pressable>
                    </View>
                  </View>
                  {!!r.exercise_names && (
                    <Text className="mt-1 text-sm text-ink-muted" numberOfLines={2}>{r.exercise_names}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="mt-2 flex-row gap-2">
            <View className="flex-1">
              <Button label="Empty workout" variant="outline" onPress={() => onStart()} />
            </View>
            <View className="flex-1">
              <Button label="+ New routine" variant="tonal" onPress={onCreate} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
