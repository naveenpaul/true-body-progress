import type { TextStyle } from 'react-native';

import type { ActiveSet } from './set-utils';
import type { UnitSystem } from '@/lib/types';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { displayToMetres, distanceUnit, kgToLbs, lbsToKg, metresToDisplay } from '@/lib/units';

import { formatSeconds, parseDuration, progressionIncrementKg, shouldIncreaseWeight } from './set-utils';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };
const HEADER_STYLE: TextStyle = { letterSpacing: 0.5 };

export type IndexedSet = ActiveSet & { globalIndex: number };

type Props = {
  exerciseId: number;
  exerciseName: string;
  sets: IndexedSet[];
  units: UnitSystem;
  onUpdateSet: (index: number, updates: Partial<ActiveSet>) => void;
  onAddSet: (exerciseId: number) => void;
  onRemoveSet: (index: number) => void;
  onRemoveExercise: (exerciseId: number) => void;
  onCopyFirstSet: (exerciseId: number) => void;
};

function parseNum(s: string): number {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

// Numeric input that keeps the raw text while focused, so typing "62." or
// "1:" isn't reformatted mid-keystroke.
function NumericCell({ value, onChange, keyboardType = 'numeric', width = 'w-16' }: {
  value: string;
  onChange: (text: string) => void;
  keyboardType?: 'numeric' | 'numbers-and-punctuation';
  width?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextInput
      keyboardType={keyboardType}
      value={draft ?? value}
      onChangeText={(v) => {
        setDraft(v);
        onChange(v);
      }}
      onBlur={() => setDraft(null)}
      className={`h-11 ${width} rounded-lg border border-ink-hairline bg-ink-card text-center text-base text-ink-text`}
      style={NUM_STYLE}
      placeholderTextColor="#71717A"
    />
  );
}

function HeaderCell({ label, className }: { label: string; className: string }) {
  return (
    <Text className={`${className} text-center text-[11px] font-bold text-ink-faint uppercase`} style={HEADER_STYLE}>
      {label}
    </Text>
  );
}

export function ActiveExerciseCard({
  exerciseId,
  exerciseName,
  sets,
  units,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onCopyFirstSet,
}: Props) {
  const tracking = sets[0]?.tracking_type ?? 'weight_reps';
  const wUnit = units === 'imperial' ? 'lbs' : 'kg';
  const toDisplayW = (kg: number) => (units === 'imperial' ? kgToLbs(kg) : kg);
  const fromDisplayW = (v: number) => (units === 'imperial' ? lbsToKg(v) : v);

  const first = sets[0];
  const targetLabel = first?.rep_min != null || first?.rep_max != null
    ? `${sets.length} × ${first.rep_min ?? ''}${first.rep_min != null && first.rep_max != null ? '–' : ''}${first.rep_max ?? ''} reps`
    : null;
  const increaseHint = shouldIncreaseWeight(sets);
  const lastWeight = sets.find(s => s.prev_weight != null)?.prev_weight ?? 0;

  const formatPrev = (s: IndexedSet): string => {
    switch (tracking) {
      case 'time':
        return s.prev_duration_sec != null ? formatSeconds(s.prev_duration_sec) : '—';
      case 'cardio': {
        const parts: string[] = [];
        if (s.prev_duration_sec)
          parts.push(`${Math.round(s.prev_duration_sec / 60)}m`);
        if (s.prev_distance_m)
          parts.push(`${metresToDisplay(s.prev_distance_m, units)}${distanceUnit(units)}`);
        return parts.length > 0 ? parts.join(' · ') : '—';
      }
      case 'bodyweight_reps':
        if (s.prev_reps == null)
          return '—';
        return s.prev_weight ? `+${toDisplayW(s.prev_weight)} × ${s.prev_reps}` : `${s.prev_reps} reps`;
      default:
        return s.prev_weight != null && s.prev_reps != null ? `${toDisplayW(s.prev_weight)} × ${s.prev_reps}` : '—';
    }
  };

  const confirmRemoveExercise = () => {
    Alert.alert(`Remove ${exerciseName}?`, 'Its sets in this workout will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemoveExercise(exerciseId) },
    ]);
  };

  return (
    <View className="mb-8">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-semibold text-ink-text" numberOfLines={1}>{exerciseName}</Text>
        <View className="flex-row items-center gap-2">
          {sets.length > 1 && tracking !== 'cardio' && (
            <Pressable
              onPress={() => onCopyFirstSet(exerciseId)}
              className="rounded-full border border-ink-hairline px-3 py-1"
            >
              <Text className="text-xs text-ink-muted">Fill from set 1</Text>
            </Pressable>
          )}
          <Pressable onPress={confirmRemoveExercise} hitSlop={8} className="px-1">
            <Text className="text-lg text-ink-faint">×</Text>
          </Pressable>
        </View>
      </View>

      {(targetLabel || increaseHint) && (
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          {targetLabel && <Text className="text-xs text-ink-faint">{`Target ${targetLabel}`}</Text>}
          {increaseHint && (
            <View className="rounded-full bg-success-500/15 px-2 py-0.5">
              <Text className="text-xs font-semibold text-success-500">
                {`Hit the top of your range last time — try +${toDisplayW(progressionIncrementKg(lastWeight))} ${wUnit}`}
              </Text>
            </View>
          )}
        </View>
      )}

      <View className="mb-1 flex-row items-center px-2">
        <HeaderCell label="Set" className="w-10" />
        <HeaderCell label="Previous" className="flex-1" />
        {tracking === 'weight_reps' && (
          <>
            <HeaderCell label={wUnit} className="w-20" />
            <HeaderCell label="reps" className="w-20" />
          </>
        )}
        {tracking === 'bodyweight_reps' && (
          <>
            <HeaderCell label={`+${wUnit}`} className="w-20" />
            <HeaderCell label="reps" className="w-20" />
          </>
        )}
        {tracking === 'time' && <HeaderCell label="time" className="w-28" />}
        {tracking === 'cardio' && (
          <>
            <HeaderCell label="min" className="w-20" />
            <HeaderCell label={distanceUnit(units)} className="w-20" />
          </>
        )}
      </View>

      {sets.map(set => (
        <Pressable
          key={set.globalIndex}
          onLongPress={() => onRemoveSet(set.globalIndex)}
          className="mb-1 flex-row items-center rounded-lg p-2"
        >
          <Text className="w-10 text-center text-base text-ink-text" style={NUM_STYLE}>{set.set_number}</Text>
          <Text className="flex-1 text-center text-sm text-ink-faint" style={NUM_STYLE}>{formatPrev(set)}</Text>

          {(tracking === 'weight_reps' || tracking === 'bodyweight_reps') && (
            <>
              <View className="w-20 items-center">
                <NumericCell
                  value={set.weight > 0 ? String(toDisplayW(set.weight)) : ''}
                  onChange={v => onUpdateSet(set.globalIndex, { weight: fromDisplayW(parseNum(v)) })}
                />
              </View>
              <View className="w-20 items-center">
                <NumericCell
                  value={set.reps > 0 ? String(set.reps) : ''}
                  onChange={v => onUpdateSet(set.globalIndex, { reps: parseNum(v) })}
                />
              </View>
            </>
          )}

          {tracking === 'time' && (
            <View className="w-28 items-center">
              <NumericCell
                width="w-24"
                keyboardType="numbers-and-punctuation"
                value={set.duration_sec ? formatSeconds(set.duration_sec) : ''}
                onChange={v => onUpdateSet(set.globalIndex, { duration_sec: parseDuration(v) })}
              />
            </View>
          )}

          {tracking === 'cardio' && (
            <>
              <View className="w-20 items-center">
                <NumericCell
                  value={set.duration_sec ? String(Math.round((set.duration_sec / 60) * 10) / 10) : ''}
                  onChange={v => onUpdateSet(set.globalIndex, { duration_sec: Math.round(parseNum(v) * 60) })}
                />
              </View>
              <View className="w-20 items-center">
                <NumericCell
                  value={set.distance_m ? String(metresToDisplay(set.distance_m, units)) : ''}
                  onChange={v => onUpdateSet(set.globalIndex, { distance_m: displayToMetres(parseNum(v), units) })}
                />
              </View>
            </>
          )}
        </Pressable>
      ))}

      <Pressable onPress={() => onAddSet(exerciseId)} className="mt-2 py-2">
        <Text className="text-center text-sm font-semibold text-success-500">
          {tracking === 'cardio' ? '+ Add interval' : '+ Add set'}
        </Text>
      </Pressable>
    </View>
  );
}
