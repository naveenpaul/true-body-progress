import type { Suggestion, WorkoutSetWithExercise } from '@/lib/types';

import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useBodyStore } from '@/features/body/use-body-store';
import { useUserStore } from '@/features/profile/use-user-store';
import { useWorkoutStore } from '@/features/workouts/use-workout-store';
import { getCoachSuggestions } from '@/lib/ai/coach-service';
import { formatDuration, formatRelativeDate } from '@/lib/dates';
import { calculateTargetCalories, calculateTDEE } from '@/lib/services/calculation-service';
import { formatLength, formatWeight } from '@/lib/units';

export function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const user = useUserStore.use.user();
  const loadBody = useBodyStore(s => s.loadData);
  const latest = useBodyStore.use.latest();
  const weeklyChange = useBodyStore.use.weeklyChange();
  const loadRecentSessions = useWorkoutStore(s => s.loadRecentSessions);
  const recentSessions = useWorkoutStore.use.recentSessions();
  const getSessionSets = useWorkoutStore(s => s.getSessionSets);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [llmInsight, setLlmInsight] = useState<string | null>(null);
  const [lastWorkoutSets, setLastWorkoutSets] = useState<WorkoutSetWithExercise[]>([]);

  const units = user?.preferred_units ?? 'metric';

  const loadAll = useCallback(() => {
    loadBody();
    loadRecentSessions();
    if (user) {
      getCoachSuggestions(db, user.goal_type).then((result) => {
        setSuggestions(result.suggestions);
        setLlmInsight(result.llmInsight);
      });
    }
  }, [db, user, loadBody, loadRecentSessions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (recentSessions.length > 0) {
      getSessionSets(recentSessions[0].id).then(setLastWorkoutSets);
    }
  }, [recentSessions, getSessionSets]);

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950 px-8">
        <Text className="mb-4 text-center text-3xl font-bold text-white">
          Welcome to Gym
        </Text>
        <Text className="mb-8 text-center text-base text-charcoal-400">
          Your personal fitness intelligence system. Let's set up your profile to get started.
        </Text>
        <Button
          label="Get Started"
          onPress={() => router.push('/(app)/settings' as any)}
          className="bg-success-500"
          textClassName="text-black font-bold"
        />
      </View>
    );
  }

  const tdee = calculateTDEE(
    latest?.weight ?? user.target_weight,
    user.height_cm,
    user.age,
    user.gender,
    'moderate',
  );
  const targetCals = calculateTargetCalories(tdee, user.goal_type);
  const greeting = getGreeting();
  const lastSession = recentSessions[0];
  const topSuggestion = suggestions[0];

  return (
    <ScrollView className="flex-1 bg-charcoal-950" contentContainerClassName="p-4 pb-8 pt-14">
      {/* Greeting */}
      <Text className="text-xl font-bold text-white">
        {greeting}
        ,
        {user.name}
      </Text>
      <Text className="mb-6 text-sm text-charcoal-400">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </Text>

      {/* Stats Row */}
      {latest
        ? (
            <View className="mb-4 flex-row items-center justify-around py-4">
              {latest.weight != null && (
                <View className="items-center">
                  <Text className="text-3xl font-bold text-white">
                    {formatWeight(latest.weight, units).split(' ')[0]}
                  </Text>
                  <Text className="text-sm text-charcoal-400">
                    {units === 'metric' ? 'kg' : 'lbs'}
                    {weeklyChange !== null && (
                      <Text className={weeklyChange <= 0 ? 'text-success-500' : 'text-danger-500'}>
                        {' '}
                        {weeklyChange > 0 ? '+' : ''}
                        {weeklyChange}
                      </Text>
                    )}
                  </Text>
                </View>
              )}
              {latest.weight != null && latest.waist != null && <View className="h-10 w-px bg-charcoal-700" />}
              {latest.waist != null && (
                <View className="items-center">
                  <Text className="text-3xl font-bold text-white">
                    {formatLength(latest.waist, units).split(' ')[0]}
                  </Text>
                  <Text className="text-sm text-charcoal-400">
                    {units === 'metric' ? 'cm' : 'in'}
                    {' '}
                    waist
                  </Text>
                </View>
              )}
              <View className="h-10 w-px bg-charcoal-700" />
              <View className="items-center">
                <Text className="text-3xl font-bold text-white">{targetCals}</Text>
                <Text className="text-sm text-charcoal-400">kcal target</Text>
              </View>
            </View>
          )
        : (
            <View className="mb-4 items-center rounded-xl bg-charcoal-900 p-6">
              <Text className="mb-4 text-center text-charcoal-400">
                Log your first weigh-in to see your stats here
              </Text>
              <Button
                label="Log Weight"
                variant="outline"
                onPress={() => router.push('/(app)/body' as any)}
                className="border-success-500"
                textClassName="text-success-500"
              />
            </View>
          )}

      {/* Suggestion Banner */}
      {(llmInsight || topSuggestion) && (
        <View className="mb-4 rounded-xl bg-success-500/20 p-4">
          <Text className="mb-1 text-sm font-bold text-success-500">
            {llmInsight ? 'Coach' : topSuggestion!.title}
          </Text>
          <Text className="text-sm text-white">
            {llmInsight ?? topSuggestion!.body}
          </Text>
        </View>
      )}

      {/* Last Workout */}
      {lastSession
        ? (
            <View className="mb-4 rounded-xl bg-charcoal-900 p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-white">Last Workout</Text>
                <Text className="text-xs text-charcoal-400">
                  {formatRelativeDate(lastSession.date)}
                  {' '}
                  ·
                  {formatDuration(lastSession.duration)}
                </Text>
              </View>
              {lastWorkoutSets.slice(0, 3).map((set, i) => (
                <Text key={i} className="mb-1 text-sm text-charcoal-200">
                  {set.exercise_name}
                  {' '}
                  {formatWeight(set.weight, units).split(' ')[0]}
                  ×
                  {set.reps}
                </Text>
              ))}
              {lastWorkoutSets.length > 3 && (
                <Text className="text-xs text-charcoal-400">
                  +
                  {lastWorkoutSets.length - 3}
                  {' '}
                  more sets
                </Text>
              )}
            </View>
          )
        : (
            <View className="mb-4 items-center rounded-xl bg-charcoal-900 p-6">
              <Text className="text-center text-charcoal-400">
                No workouts yet. Start your first session!
              </Text>
            </View>
          )}

      {/* Quick Actions */}
      <View className="mt-2 flex-row gap-4">
        <Button
          label="Log Workout"
          variant="outline"
          onPress={() => router.push('/(app)/workouts' as any)}
          className="flex-1 border-success-500"
          textClassName="text-success-500"
        />
        <Button
          label="Log Weight"
          variant="outline"
          onPress={() => router.push('/(app)/body' as any)}
          className="flex-1 border-success-500"
          textClassName="text-success-500"
        />
      </View>
    </ScrollView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12)
    return 'Good morning';
  if (hour < 17)
    return 'Good afternoon';
  return 'Good evening';
}
