import type { TextStyle } from 'react-native';
import type { CoachInsight } from '@/lib/ai/llm-client';

import type { Suggestion, WorkoutSetWithExercise } from '@/lib/types';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { SimpleChart } from '@/features/body/components/simple-chart';
import { useBodyStore } from '@/features/body/use-body-store';
import { useUserStore } from '@/features/profile/use-user-store';
import { useWorkoutStore } from '@/features/workouts/use-workout-store';
import { getCoachSuggestions } from '@/lib/ai/coach-service';
import { formatRelativeDate } from '@/lib/dates';
import { expoDb } from '@/lib/db';
import { calculateTargetCalories, calculateTDEE } from '@/lib/services/calculation-service';
import { formatLength, formatWeight, kgToLbs } from '@/lib/units';

// Tabular numerals for any number rendered in stats — keeps columns aligned.
const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

export function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useUserStore.use.user();
  const loadBody = useBodyStore(s => s.loadData);
  const latest = useBodyStore.use.latest();
  const weeklyChange = useBodyStore.use.weeklyChange();
  const weightTrend = useBodyStore.use.weightTrend();
  const loadRecentSessions = useWorkoutStore(s => s.loadRecentSessions);
  const recentSessions = useWorkoutStore.use.recentSessions();
  const getSessionSets = useWorkoutStore(s => s.getSessionSets);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [lastWorkoutSets, setLastWorkoutSets] = useState<WorkoutSetWithExercise[]>([]);

  const units = user?.preferred_units ?? 'metric';

  const loadAll = useCallback(() => {
    loadBody();
    loadRecentSessions();
    if (user) {
      setInsightLoading(true);
      getCoachSuggestions(expoDb, user)
        .then((result) => {
          setSuggestions(result.suggestions);
          setInsight(result.insight);
        })
        .finally(() => setInsightLoading(false));
    }
  }, [user, loadBody, loadRecentSessions]);

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
      <View className="flex-1 items-center justify-center bg-ink-base px-8">
        <Text className="mb-3 text-center text-3xl font-bold text-ink-text">
          Welcome to Gym
        </Text>
        <Text className="mb-8 text-center text-base text-ink-muted">
          Your personal fitness instrument. Set up your profile to get started.
        </Text>
        <Button
          label="Get Started"
          variant="primary"
          onPress={() => router.push('/(app)/settings' as any)}
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
    <ScrollView
      className="flex-1 bg-ink-base"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      contentContainerClassName="px-5"
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadAll} tintColor="#22C55E" />}
    >
      {/* Header */}
      <Text className="text-3xl font-bold text-ink-text">
        {greeting}
        ,
        {' '}
        {user.name}
      </Text>
      <Text className="mt-1 mb-8 text-sm text-ink-faint">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </Text>

      {/* Stats — flat hero row, no card */}
      {latest
        ? (
            <View className="mb-10 flex-row items-end justify-between">
              {latest.weight != null && (
                <Stat
                  value={formatWeight(latest.weight, units).split(' ')[0]}
                  unit={units === 'metric' ? 'kg' : 'lbs'}
                  delta={weeklyChange}
                />
              )}
              {latest.waist != null && (
                <Stat
                  value={formatLength(latest.waist, units).split(' ')[0]}
                  unit={units === 'metric' ? 'cm waist' : 'in waist'}
                />
              )}
              <Stat value={String(targetCals)} unit="kcal target" />
            </View>
          )
        : (
            <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-card p-6">
              <Text className="mb-4 text-center text-ink-muted">
                Log your first weigh-in to see your stats here.
              </Text>
              <Button
                label="Log Weight"
                variant="primary"
                onPress={() => router.push('/(app)/body' as any)}
              />
            </View>
          )}

      {/* Coach — hero card, elevated + hairline border, distinct from everything else */}
      <SectionLabel>Coach</SectionLabel>
      {insight
        ? (
            <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-elevated p-5">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-ink-text">Today's read</Text>
                <VerdictPill verdict={insight.verdict} />
              </View>
              {insight.past
                ? (
                    <CoachBlock label="What you've been doing" body={insight.past} />
                  )
                : null}
              {insight.present
                ? (
                    <CoachBlock label="How it's going" body={insight.present} />
                  )
                : null}
              {insight.next.length > 0 && (
                <View>
                  <Text className="mb-1 text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>
                    What to do next
                  </Text>
                  {insight.next.map(item => (
                    <Text key={item} className="mt-1 text-base text-ink-text">
                      •
                      {' '}
                      {item}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )
        : insightLoading
          ? (
              <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-elevated p-5">
                <Text className="text-sm text-ink-muted">Coach is analyzing your data…</Text>
              </View>
            )
          : topSuggestion
            ? (
                <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-elevated p-5">
                  <Text className="mb-1 text-base font-semibold text-ink-text">{topSuggestion.title}</Text>
                  <Text className="text-sm text-ink-muted">{topSuggestion.body}</Text>
                </View>
              )
            : (
                <View className="mb-10 rounded-2xl border border-ink-hairline bg-ink-elevated p-5">
                  <Text className="text-sm text-ink-muted">
                    Log a few workouts and weigh-ins. The coach will start reading your data once there's enough signal.
                  </Text>
                </View>
              )}

      {/* Weight progress — flat, with hairline top border */}
      {weightTrend.length >= 2 && (
        <View className="mb-10 border-t border-ink-hairline pt-5">
          <View className="mb-3 flex-row items-baseline justify-between">
            <SectionLabel>Weight progress</SectionLabel>
            <Text className="text-xs text-ink-faint" style={NUM_STYLE}>
              last
              {' '}
              {weightTrend.length}
              {' '}
              entries
            </Text>
          </View>
          <SimpleChart
            data={weightTrend.map(p => ({
              value: units === 'imperial' ? kgToLbs(p.weight) : p.weight,
              label: p.date.slice(5),
            }))}
            height={140}
          />
        </View>
      )}

      {/* Last workout — flat list, no card */}
      <View className="mb-10 border-t border-ink-hairline pt-5">
        <View className="mb-3 flex-row items-baseline justify-between">
          <SectionLabel>Last workout</SectionLabel>
          {lastSession && (
            <Text className="text-xs text-ink-faint">
              {formatRelativeDate(lastSession.date)}
            </Text>
          )}
        </View>
        {lastSession
          ? (
              <View>
                {lastWorkoutSets.slice(0, 3).map(set => (
                  <View key={set.id} className="flex-row items-center justify-between py-1.5">
                    <Text className="text-base text-ink-text">{set.exercise_name}</Text>
                    <Text className="text-base text-ink-muted" style={NUM_STYLE}>
                      {formatWeight(set.weight, units).split(' ')[0]}
                      {' × '}
                      {set.reps}
                    </Text>
                  </View>
                ))}
                {lastWorkoutSets.length > 3 && (
                  <Text className="mt-1 text-xs text-ink-faint">
                    +
                    {lastWorkoutSets.length - 3}
                    {' '}
                    more sets
                  </Text>
                )}
              </View>
            )
          : (
              <Text className="text-sm text-ink-muted">
                No workouts yet. Start your first session.
              </Text>
            )}
      </View>

      {/* Quick actions — real hierarchy: one primary, one tonal */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label="Log Workout"
            variant="primary"
            onPress={() => router.push('/(app)/workouts' as any)}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Log Weight"
            variant="tonal"
            onPress={() => router.push('/(app)/body' as any)}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ value, unit, delta }: { value: string; unit: string; delta?: number | null }) {
  return (
    <View>
      <Text className="text-4xl font-bold text-ink-text" style={NUM_STYLE}>{value}</Text>
      <Text className="mt-1 text-xs text-ink-faint">
        {unit}
        {delta != null && delta !== 0 && (
          <Text
            className={delta < 0 ? 'text-success-500' : 'text-danger-400'}
            style={NUM_STYLE}
          >
            {'  '}
            {delta > 0 ? '+' : ''}
            {delta}
          </Text>
        )}
      </Text>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="text-xs font-bold text-ink-faint uppercase"
      style={{ letterSpacing: 0.8 }}
    >
      {children}
    </Text>
  );
}

function CoachBlock({ label, body }: { label: string; body: string }) {
  return (
    <View className="mb-4">
      <Text
        className="mb-1 text-xs font-bold text-ink-faint uppercase"
        style={{ letterSpacing: 0.5 }}
      >
        {label}
      </Text>
      <Text className="text-base text-ink-text">{body}</Text>
    </View>
  );
}

function VerdictPill({ verdict }: { verdict: CoachInsight['verdict'] }) {
  const map = {
    good: { label: 'On track', container: 'bg-success-500/15 border-success-500/40', text: 'text-success-500' },
    bad: { label: 'Off track', container: 'bg-danger-500/15 border-danger-500/40', text: 'text-danger-400' },
    steady: { label: 'Steady', container: 'bg-ink-hairline border-ink-hairline', text: 'text-ink-muted' },
    unknown: { label: 'Need data', container: 'bg-ink-hairline border-ink-hairline', text: 'text-ink-faint' },
  };
  const { label, container, text } = map[verdict];
  return (
    <View className={`rounded-full border px-2.5 py-1 ${container}`}>
      <Text className={`text-xs font-bold ${text}`}>{label}</Text>
    </View>
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
