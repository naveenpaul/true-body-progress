import type { TextStyle } from 'react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';
import { formatRelativeDate, today } from '@/lib/dates';
import { formatLength, formatWeight, parseLengthInput, parseWeightInput } from '@/lib/units';

import { SimpleChart } from './components/simple-chart';
import { useBodyStore } from './use-body-store';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

export function BodyScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore.use.user();
  const units = user?.preferred_units ?? 'metric';
  const weightTrend = useBodyStore.use.weightTrend();
  const waistTrend = useBodyStore.use.waistTrend();
  const recentMetrics = useBodyStore.use.recentMetrics();
  const trendDays = useBodyStore.use.trendDays();
  const loadData = useBodyStore.use.loadData();
  const logMetric = useBodyStore.use.logMetric();
  const setTrendDays = useBodyStore.use.setTrendDays();

  const [weightInput, setWeightInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Locale-aware: accept "1,5" as "1.5" before parsing.
  const parseNum = (s: string): number => Number.parseFloat(s.replace(',', '.'));

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasInput = !!(weightInput || waistInput || bodyFatInput || notesInput);

  const handleSave = async () => {
    if (!hasInput)
      return;

    // Validate any provided numeric inputs before persisting.
    const weightRaw = weightInput ? parseNum(weightInput) : null;
    const waistRaw = waistInput ? parseNum(waistInput) : null;
    const bodyFatRaw = bodyFatInput ? parseNum(bodyFatInput) : null;

    if (weightRaw !== null && (Number.isNaN(weightRaw) || weightRaw <= 0)) {
      setSaveError('Weight must be a positive number');
      return;
    }
    if (waistRaw !== null && (Number.isNaN(waistRaw) || waistRaw <= 0)) {
      setSaveError('Waist must be a positive number');
      return;
    }
    if (bodyFatRaw !== null && (Number.isNaN(bodyFatRaw) || bodyFatRaw < 0 || bodyFatRaw > 100)) {
      setSaveError('Body fat must be between 0 and 100');
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      const weight = weightRaw !== null ? parseWeightInput(weightRaw, units) : undefined;
      const waist = waistRaw !== null ? parseLengthInput(waistRaw, units) : undefined;
      const bodyFat = bodyFatRaw !== null ? bodyFatRaw : undefined;

      await logMetric(today(), weight, waist, bodyFat, notesInput || undefined);
      setWeightInput('');
      setWaistInput('');
      setBodyFatInput('');
      setNotesInput('');
    }
    catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save entry');
    }
    finally {
      setSaving(false);
    }
  };

  const chartData = weightTrend.map(d => ({
    value: d.weight,
    label: d.date.slice(5),
  }));

  const waistChartData = waistTrend.map(d => ({
    value: d.waist,
    label: d.date.slice(5),
  }));

  const TREND_OPTIONS = [7, 30, 90] as const;

  return (
    <ScrollView
      className="flex-1 bg-ink-base"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      contentContainerClassName="px-5"
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor="#22C55E" />}
    >
      <Text className="mb-1 text-3xl font-bold text-ink-text">Body</Text>
      <Text className="mb-8 text-sm text-ink-faint">Weight, waist, and body fat over time</Text>

      {/* Weight Trend Chart */}
      {chartData.length >= 2
        ? (
            <View className="mb-10">
              <View className="mb-3 flex-row items-baseline justify-between">
                <Text className="text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>Weight trend</Text>
              </View>
              <SimpleChart data={chartData} height={150} color="#22C55E" />
              <View className="mt-4 flex-row gap-2">
                {TREND_OPTIONS.map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setTrendDays(d)}
                    className={`flex-1 items-center rounded-full border py-2 ${trendDays === d ? 'border-success-500 bg-success-500' : 'border-ink-hairline bg-transparent'}`}
                  >
                    <Text className={trendDays === d ? 'text-sm font-bold text-black' : 'text-sm text-ink-muted'} style={NUM_STYLE}>
                      {d}
                      d
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        : (
            <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-card p-6">
              <Text className="text-center text-sm text-ink-muted">
                Log at least 2 weigh-ins to see your trend.
              </Text>
            </View>
          )}

      {/* Waist Trend */}
      {waistChartData.length >= 2 && (
        <View className="mb-10">
          <Text className="mb-3 text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>Waist trend</Text>
          <SimpleChart data={waistChartData} height={120} color="#FBBF24" />
        </View>
      )}

      {/* Log Entry Form */}
      <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-card p-5">
        <Text className="mb-4 text-lg font-semibold text-ink-text">Log today</Text>
        <TextInput
          placeholder={`Weight (${units === 'metric' ? 'kg' : 'lbs'})`}
          keyboardType="numeric"
          value={weightInput}
          onChangeText={setWeightInput}
          className="mb-3 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
          style={NUM_STYLE}
          placeholderTextColor="#71717A"
        />
        <TextInput
          placeholder={`Waist (${units === 'metric' ? 'cm' : 'in'})`}
          keyboardType="numeric"
          value={waistInput}
          onChangeText={setWaistInput}
          className="mb-3 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
          style={NUM_STYLE}
          placeholderTextColor="#71717A"
        />
        <TextInput
          placeholder="Body fat % (optional)"
          keyboardType="numeric"
          value={bodyFatInput}
          onChangeText={setBodyFatInput}
          className="mb-3 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
          style={NUM_STYLE}
          placeholderTextColor="#71717A"
        />
        <TextInput
          placeholder="Notes (optional)"
          value={notesInput}
          onChangeText={setNotesInput}
          className="mb-4 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
          placeholderTextColor="#71717A"
        />
        {saveError && (
          <Text className="mb-3 text-sm text-danger-400">{saveError}</Text>
        )}
        <Button
          label={saving ? 'Saving…' : 'Save entry'}
          variant="primary"
          onPress={handleSave}
          disabled={!hasInput || saving}
        />
      </View>

      {/* History */}
      {recentMetrics.length > 0 && (
        <View>
          <Text className="mb-3 text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>Recent</Text>
          {recentMetrics.map((metric, idx) => (
            <View key={metric.id} className={`flex-row items-center justify-between py-3 ${idx > 0 ? 'border-t border-ink-hairline' : ''}`}>
              <Text className="flex-1 text-sm text-ink-faint">{formatRelativeDate(metric.date)}</Text>
              {metric.weight != null && <Text className="text-base text-ink-text" style={NUM_STYLE}>{formatWeight(metric.weight, units)}</Text>}
              {metric.waist != null && <Text className="ml-4 text-sm text-ink-muted" style={NUM_STYLE}>{formatLength(metric.waist, units)}</Text>}
              {metric.body_fat != null && (
                <Text className="ml-4 text-sm text-ink-muted" style={NUM_STYLE}>
                  {metric.body_fat}
                  %
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
