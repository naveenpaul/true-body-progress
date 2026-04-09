import type { TextStyle } from 'react-native';

import type { Food, NutritionEntry } from '@/lib/types';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useBodyStore } from '@/features/body/use-body-store';
import { useUserStore } from '@/features/profile/use-user-store';
import { today } from '@/lib/dates';
import { expoDb } from '@/lib/db';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import { calculateMacroTargets, calculateTargetCalories, calculateTDEE } from '@/lib/services/calculation-service';
import { FoodPicker } from './food-picker';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

export function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore.use.user();
  const latest = useBodyStore.use.latest();

  const [meals, setMeals] = useState<NutritionEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const pickerRef = useRef<React.ElementRef<typeof FoodPicker>>(null);

  const currentDate = today();
  const refresh = () => setRefreshKey(k => k + 1);

  const currentWeight = latest?.weight ?? user?.target_weight ?? 70;
  const tdee = user
    ? calculateTDEE(currentWeight, user.height_cm, user.age, user.gender, 'moderate')
    : 2000;
  const targetCals = user ? calculateTargetCalories(tdee, user.goal_type) : 2000;
  const macroTargets = user
    ? calculateMacroTargets(targetCals, currentWeight, user.goal_type)
    : { protein: 140, carbs: 200, fats: 60 };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dayMeals, dayTotals] = await Promise.all([
        nutritionRepo.getMealsForDate(expoDb, currentDate),
        nutritionRepo.getDailyTotals(expoDb, currentDate),
      ]);
      if (cancelled)
        return;
      setMeals(dayMeals);
      setTotals(dayTotals);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentDate, refreshKey]);

  const handlePick = async (food: Food, servings: number) => {
    await nutritionRepo.logMealFromFood(expoDb, currentDate, food, servings);
    refresh();
  };

  const handleDelete = async (id: number) => {
    await nutritionRepo.deleteMeal(expoDb, id);
    refresh();
  };

  return (
    <ScrollView
      className="flex-1 bg-ink-base"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      contentContainerClassName="px-5"
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#22C55E" />}
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
          <Pressable onPress={() => pickerRef.current?.present()}>
            <Text className="text-sm font-semibold text-success-500">+ Add meal</Text>
          </Pressable>
        </View>

        {meals.length === 0
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
                      {Math.round(meal.calories)}
                      {' kcal · '}
                      {Math.round(meal.protein)}
                      P ·
                      {' '}
                      {Math.round(meal.carbs)}
                      C ·
                      {' '}
                      {Math.round(meal.fats)}
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

      <FoodPicker ref={pickerRef} onPick={handlePick} />
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
