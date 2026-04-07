import * as React from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useUserStore } from '@/features/profile/use-user-store';
import { formatRelativeDate, today } from '@/lib/dates';
import { formatLength, formatWeight, parseLengthInput, parseWeightInput } from '@/lib/units';

import { SimpleChart } from './components/simple-chart';
import { useBodyStore } from './use-body-store';

export function BodyScreen() {
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
    <ScrollView className="flex-1 bg-charcoal-950" contentContainerClassName="p-4 pb-10 pt-14">
      <Text className="mb-4 text-2xl font-bold text-white">Body Metrics</Text>

      {/* Weight Trend Chart */}
      {chartData.length >= 2
        ? (
            <View className="mb-6">
              <Text className="mb-2 text-sm font-semibold text-white">Weight Trend</Text>
              <SimpleChart data={chartData} height={150} color="#22C55E" />
              <View className="mt-3 flex-row gap-2">
                {TREND_OPTIONS.map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setTrendDays(d)}
                    className={`flex-1 items-center rounded-lg py-2 ${trendDays === d ? 'bg-success-500' : 'bg-charcoal-800'}`}
                  >
                    <Text className={trendDays === d ? 'text-sm font-bold text-black' : 'text-sm text-charcoal-300'}>
                      {d}
                      d
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        : (
            <View className="mb-6 items-center rounded-xl bg-charcoal-900 p-6">
              <Text className="text-center text-charcoal-400">
                Log at least 2 weigh-ins to see your trend chart
              </Text>
            </View>
          )}

      {/* Waist Trend */}
      {waistChartData.length >= 2 && (
        <View className="mb-6">
          <Text className="mb-2 text-sm font-semibold text-white">Waist Trend</Text>
          <SimpleChart data={waistChartData} height={120} color="#FBBF24" />
        </View>
      )}

      {/* Log Entry Form */}
      <View className="mb-6 rounded-xl bg-charcoal-900 p-4">
        <Text className="mb-4 text-base font-semibold text-white">Log Today</Text>
        <TextInput
          placeholder={`Weight (${units === 'metric' ? 'kg' : 'lbs'})`}
          keyboardType="numeric"
          value={weightInput}
          onChangeText={setWeightInput}
          className="mb-3 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
          placeholderTextColor="#7D7D7D"
        />
        <TextInput
          placeholder={`Waist (${units === 'metric' ? 'cm' : 'in'})`}
          keyboardType="numeric"
          value={waistInput}
          onChangeText={setWaistInput}
          className="mb-3 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
          placeholderTextColor="#7D7D7D"
        />
        <TextInput
          placeholder="Body fat % (optional)"
          keyboardType="numeric"
          value={bodyFatInput}
          onChangeText={setBodyFatInput}
          className="mb-3 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
          placeholderTextColor="#7D7D7D"
        />
        <TextInput
          placeholder="Notes (optional)"
          value={notesInput}
          onChangeText={setNotesInput}
          className="mb-3 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
          placeholderTextColor="#7D7D7D"
        />
        {saveError && (
          <Text className="mb-2 text-sm text-danger-500">{saveError}</Text>
        )}
        <Button
          label={saving ? 'Saving...' : 'Save Entry'}
          onPress={handleSave}
          disabled={!hasInput || saving}
          className="bg-success-500"
          textClassName="text-black font-bold"
        />
      </View>

      {/* History */}
      {recentMetrics.length > 0 && (
        <View className="mb-6">
          <Text className="mb-2 text-sm font-semibold text-white">Recent</Text>
          {recentMetrics.map(metric => (
            <View key={metric.id} className="flex-row justify-between border-b border-charcoal-800 py-3">
              <Text className="flex-1 text-sm text-charcoal-400">{formatRelativeDate(metric.date)}</Text>
              {metric.weight != null && <Text className="text-sm text-white">{formatWeight(metric.weight, units)}</Text>}
              {metric.waist != null && <Text className="ml-4 text-sm text-charcoal-400">{formatLength(metric.waist, units)}</Text>}
              {metric.body_fat != null && (
                <Text className="ml-4 text-sm text-charcoal-400">
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
