// Coach service: combines rule engine + LLM for suggestions

import type { SQLiteDatabase } from 'expo-sqlite';

import type { GoalType, Suggestion } from '@/lib/types';

import * as bodyMetricsRepo from '@/lib/db/body-metrics-repo';
import { getAllSuggestions } from '@/lib/rules';

import { getCoachingSuggestion, isLLMConfigured } from './llm-client';

function describeTrend(values: number[]): string {
  if (values.length < 2) return 'insufficient data';
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  if (Math.abs(change) < 0.3) return 'stable';
  return change > 0 ? 'increasing' : 'decreasing';
}

export async function getCoachSuggestions(
  db: SQLiteDatabase,
  goalType: GoalType,
): Promise<{ suggestions: Suggestion[]; llmInsight: string | null }> {
  const suggestions = await getAllSuggestions(db);

  if (!isLLMConfigured()) {
    return { suggestions, llmInsight: null };
  }

  const [weightTrend, waistTrend] = await Promise.all([
    bodyMetricsRepo.getWeightTrend(db, 30),
    bodyMetricsRepo.getWaistTrend(db, 30),
  ]);

  const weightDirection = describeTrend(weightTrend.map(w => w.weight));
  const waistDirection = describeTrend(waistTrend.map(w => w.waist));

  const strengthSuggestions = suggestions.filter(s => s.type === 'strength');
  const strengthDirection = strengthSuggestions.length > 0
    ? strengthSuggestions.map(s => s.title).join(', ')
    : 'on track';

  const llmInsight = await getCoachingSuggestion({
    goalType,
    weightTrend: weightDirection,
    waistTrend: waistDirection,
    strengthTrend: strengthDirection,
    ruleSuggestions: suggestions.map(s => ({ title: s.title, body: s.body })),
  });

  return { suggestions, llmInsight };
}
