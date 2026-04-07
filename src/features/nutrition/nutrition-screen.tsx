/* eslint-disable better-tailwindcss/no-unknown-classes */
import type { NutritionEntry } from '@/lib/types';

import { useSQLiteContext } from 'expo-sqlite';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useBodyStore } from '@/features/body/use-body-store';
import { useUserStore } from '@/features/profile/use-user-store';
import { today } from '@/lib/dates';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import { calculateMacroTargets, calculateTargetCalories, calculateTDEE } from '@/lib/services/calculation-service';

export function NutritionScreen() {
  const db = useSQLiteContext();
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
      nutritionRepo.getMealsForDate(db, currentDate),
      nutritionRepo.getDailyTotals(db, currentDate),
    ]);
    setMeals(dayMeals);
    setTotals(dayTotals);
  }, [db, currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    const cal = parseFloat(calories);
    const prot = parseFloat(protein);
    const carb = parseFloat(carbs);
    const fat = parseFloat(fats);
    if (!mealName || isNaN(cal)) return;

    setSaving(true);
    await nutritionRepo.logMeal(
      db,
      currentDate,
      mealName,
      cal,
      isNaN(prot) ? 0 : prot,
      isNaN(carb) ? 0 : carb,
      isNaN(fat) ? 0 : fat,
    );
    setMealName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setShowForm(false);
    setSaving(false);
    await loadData();
  };

  const handleDelete = async (id: number) => {
    await nutritionRepo.deleteMeal(db, id);
    await loadData();
  };

  return (
    <ScrollView className="flex-1 bg-charcoal-950" contentContainerClassName="p-4 pb-10 pt-14">
      <Text className="mb-4 text-2xl font-bold text-white">Nutrition</Text>

      {/* Daily Summary - Macro Bars */}
      <View className="mb-6">
        <MacroBar label="Calories" current={Math.round(totals.calories)} target={targetCals} color="#22C55E" unit="kcal" />
        <MacroBar label="Protein" current={Math.round(totals.protein)} target={macroTargets.protein} color="#FF6B6B" unit="g" />
        <MacroBar label="Carbs" current={Math.round(totals.carbs)} target={macroTargets.carbs} color="#4ECDC4" unit="g" />
        <MacroBar label="Fats" current={Math.round(totals.fats)} target={macroTargets.fats} color="#FFE66D" unit="g" />
      </View>

      {/* Meals Section */}
      <View className="mb-6">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-white">Today's Meals</Text>
          <Pressable onPress={() => setShowForm(!showForm)}>
            <Text className="text-sm text-success-500">{showForm ? 'Cancel' : '+ Add Meal'}</Text>
          </Pressable>
        </View>

        {showForm && (
          <View className="mb-4 rounded-xl bg-charcoal-900 p-4">
            <TextInput
              placeholder="Meal name (e.g. Chicken breast 200g)"
              value={mealName}
              onChangeText={setMealName}
              className="mb-3 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
              placeholderTextColor="#7D7D7D"
            />
            <View className="mb-3 flex-row gap-3">
              <TextInput
                placeholder="Cal"
                keyboardType="numeric"
                value={calories}
                onChangeText={setCalories}
                className="flex-1 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
                placeholderTextColor="#7D7D7D"
              />
              <TextInput
                placeholder="Protein"
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
                className="flex-1 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
                placeholderTextColor="#7D7D7D"
              />
            </View>
            <View className="mb-3 flex-row gap-3">
              <TextInput
                placeholder="Carbs"
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
                className="flex-1 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
                placeholderTextColor="#7D7D7D"
              />
              <TextInput
                placeholder="Fats"
                keyboardType="numeric"
                value={fats}
                onChangeText={setFats}
                className="flex-1 rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
                placeholderTextColor="#7D7D7D"
              />
            </View>
            <Button
              label={saving ? 'Saving...' : 'Save Meal'}
              onPress={handleSave}
              disabled={!mealName || !calories || saving}
              className="bg-success-500"
              textClassName="text-black font-bold"
            />
          </View>
        )}

        {meals.length === 0 && !showForm ? (
          <View className="items-center rounded-xl bg-charcoal-900 p-6">
            <Text className="text-center text-charcoal-400">
              No meals logged today. Tap + Add Meal to start tracking.
            </Text>
          </View>
        ) : (
          meals.map(meal => (
            <View key={meal.id} className="mb-1 flex-row items-center rounded-lg bg-charcoal-900 p-3">
              <View className="flex-1">
                <Text className="text-base text-white">{meal.meal_name}</Text>
                <Text className="text-xs text-charcoal-400">
                  {meal.calories} kcal · {meal.protein}g P · {meal.carbs}g C · {meal.fats}g F
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(meal.id)} className="p-2">
                <Text className="text-charcoal-500">✕</Text>
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
    <View className="mb-4">
      <View className="mb-1 flex-row justify-between">
        <Text className="text-xs text-charcoal-400">{label}</Text>
        <Text className="text-xs">
          <Text className="font-bold text-white">{current}</Text>
          <Text className="text-charcoal-400"> / {target} {unit}</Text>
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-charcoal-800">
        <View
          style={{ width: `${progress * 100}%`, backgroundColor: color }}
          className="h-full rounded-full"
        />
      </View>
    </View>
  );
}
