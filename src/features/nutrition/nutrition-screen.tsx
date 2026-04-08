import type { TextStyle } from 'react-native';

import type { NutritionEntry } from '@/lib/types';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useBodyStore } from '@/features/body/use-body-store';
import { useUserStore } from '@/features/profile/use-user-store';
import { today } from '@/lib/dates';
import { expoDb } from '@/lib/db';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import { calculateMacroTargets, calculateTargetCalories, calculateTDEE } from '@/lib/services/calculation-service';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

export function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore.use.user();
  const latest = useBodyStore.use.latest();

  const [meals, setMeals] = useState<NutritionEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [showForm, setShowForm] = useState(false);
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const parseNum = (s: string): number => Number.parseFloat(s.replace(',', '.'));

  const currentDate = today();

  const currentWeight = latest?.weight ?? user?.target_weight ?? 70;
  const tdee = user
    ? calculateTDEE(currentWeight, user.height_cm, user.age, user.gender, 'moderate')
    : 2000;
  const targetCals = user ? calculateTargetCalories(tdee, user.goal_type) : 2000;
  const macroTargets = user
    ? calculateMacroTargets(targetCals, currentWeight, user.goal_type)
    : { protein: 140, carbs: 200, fats: 60 };

  const loadData = useCallback(async () => {
    const [dayMeals, dayTotals] = await Promise.all([
      nutritionRepo.getMealsForDate(expoDb, currentDate),
      nutritionRepo.getDailyTotals(expoDb, currentDate),
    ]);
    setMeals(dayMeals);
    setTotals(dayTotals);
  }, [currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!mealName.trim()) {
      setSaveError('Meal name is required');
      return;
    }
    const cal = parseNum(calories);
    if (Number.isNaN(cal) || cal < 0) {
      setSaveError('Calories must be a non-negative number');
      return;
    }
    // Macros are optional but if provided, must be valid non-negative numbers.
    const macroFields: Array<[string, string]> = [
      ['Protein', protein],
      ['Carbs', carbs],
      ['Fats', fats],
    ];
    const parsedMacros: Record<string, number> = {};
    for (const [name, raw] of macroFields) {
      if (!raw) {
        parsedMacros[name] = 0;
        continue;
      }
      const v = parseNum(raw);
      if (Number.isNaN(v) || v < 0) {
        setSaveError(`${name} must be a non-negative number`);
        return;
      }
      parsedMacros[name] = v;
    }

    setSaveError(null);
    setSaving(true);
    try {
      await nutritionRepo.logMeal(
        expoDb,
        currentDate,
        mealName.trim(),
        cal,
        parsedMacros.Protein,
        parsedMacros.Carbs,
        parsedMacros.Fats,
      );
      setMealName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFats('');
      setShowForm(false);
      await loadData();
    }
    catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save meal');
    }
    finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await nutritionRepo.deleteMeal(expoDb, id);
    await loadData();
  };

  return (
    <ScrollView
      className="flex-1 bg-ink-base"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      contentContainerClassName="px-5"
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor="#22C55E" />}
    >
      <Text className="mb-1 text-3xl font-bold text-ink-text">Nutrition</Text>
      <Text className="mb-8 text-sm text-ink-faint">Today</Text>

      {/* Daily Summary - Macro Bars */}
      <View className="mb-10">
        <MacroBar label="Calories" current={Math.round(totals.calories)} target={targetCals} color="#22C55E" unit="kcal" />
        <MacroBar label="Protein" current={Math.round(totals.protein)} target={macroTargets.protein} color="#F87171" unit="g" />
        <MacroBar label="Carbs" current={Math.round(totals.carbs)} target={macroTargets.carbs} color="#60A5FA" unit="g" />
        <MacroBar label="Fats" current={Math.round(totals.fats)} target={macroTargets.fats} color="#FBBF24" unit="g" />
      </View>

      {/* Meals Section */}
      <View>
        <View className="mb-3 flex-row items-baseline justify-between">
          <Text className="text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>Today's meals</Text>
          <Pressable onPress={() => setShowForm(!showForm)}>
            <Text className="text-sm font-semibold text-success-500">{showForm ? 'Cancel' : '+ Add meal'}</Text>
          </Pressable>
        </View>

        {showForm && (
          <View className="mb-5 rounded-2xl border border-ink-hairline bg-ink-card p-5">
            <TextInput
              placeholder="Meal name (e.g. Chicken breast 200g)"
              value={mealName}
              onChangeText={setMealName}
              className="mb-3 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
              placeholderTextColor="#71717A"
            />
            <View className="mb-3 flex-row gap-3">
              <TextInput
                placeholder="Cal"
                keyboardType="numeric"
                value={calories}
                onChangeText={setCalories}
                className="flex-1 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
                style={NUM_STYLE}
                placeholderTextColor="#71717A"
              />
              <TextInput
                placeholder="Protein"
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
                className="flex-1 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
                style={NUM_STYLE}
                placeholderTextColor="#71717A"
              />
            </View>
            <View className="mb-4 flex-row gap-3">
              <TextInput
                placeholder="Carbs"
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
                className="flex-1 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
                style={NUM_STYLE}
                placeholderTextColor="#71717A"
              />
              <TextInput
                placeholder="Fats"
                keyboardType="numeric"
                value={fats}
                onChangeText={setFats}
                className="flex-1 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
                style={NUM_STYLE}
                placeholderTextColor="#71717A"
              />
            </View>
            {saveError && (
              <Text className="mb-3 text-sm text-danger-400">{saveError}</Text>
            )}
            <Button
              label={saving ? 'Saving…' : 'Save meal'}
              variant="primary"
              onPress={handleSave}
              disabled={!mealName || !calories || saving}
            />
          </View>
        )}

        {meals.length === 0 && !showForm
          ? (
              <View className="rounded-2xl border border-ink-hairline bg-ink-card p-6">
                <Text className="text-center text-sm text-ink-muted">
                  No meals logged today. Tap "+ Add meal" to start.
                </Text>
              </View>
            )
          : (
              meals.map((meal, idx) => (
                <View key={meal.id} className={`flex-row items-center py-3 ${idx > 0 ? 'border-t border-ink-hairline' : ''}`}>
                  <View className="flex-1">
                    <Text className="text-base text-ink-text">{meal.meal_name}</Text>
                    <Text className="mt-0.5 text-xs text-ink-faint" style={NUM_STYLE}>
                      {meal.calories}
                      {' kcal · '}
                      {meal.protein}
                      P ·
                      {' '}
                      {meal.carbs}
                      C ·
                      {' '}
                      {meal.fats}
                      F
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(meal.id)} className="p-2">
                    <Text className="text-ink-faint">✕</Text>
                  </Pressable>
                </View>
              ))
            )}
      </View>
    </ScrollView>
  );
}

function MacroBar({ label, current, target, color, unit }: {
  label: string;
  current: number;
  target: number;
  color: string;
  unit: string;
}) {
  const progress = Math.min(current / target, 1);
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>{label}</Text>
        <Text className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
          <Text className="font-bold text-ink-text">{current}</Text>
          <Text className="text-ink-faint">
            {' / '}
            {target}
            {' '}
            {unit}
          </Text>
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-ink-hairline">
        <View
          style={{ width: `${progress * 100}%`, backgroundColor: color }}
          className="h-full rounded-full"
        />
      </View>
    </View>
  );
}
