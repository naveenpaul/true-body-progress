// LLM client for natural language coaching insights
// Uses OpenRouter API (free tier models) or returns null when not configured

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

// Known-good free model on OpenRouter. Override at build time with
// EXPO_PUBLIC_OPENROUTER_MODEL if you want a different one.
export const DEFAULT_LLM_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

type LLMConfig = {
  apiKey: string;
  model: string;
};

let config: LLMConfig | null = null;

export function configureLLM(apiKey: string, model?: string): void {
  config = { apiKey, model: model && model.length > 0 ? model : DEFAULT_LLM_MODEL };
}

export function resetLLMForTests(): void {
  config = null;
}

export function getLLMConfig(): LLMConfig | null {
  return config;
}

export function isLLMConfigured(): boolean {
  return config !== null && config.apiKey.length > 0;
}

export type CoachSnapshot = {
  // Profile
  goal: string;
  age: number;
  heightCm: number;
  targetWeightKg: number;
  // Body
  currentWeightKg: number | null;
  weightChange30dKg: number | null;
  waistChange30dCm: number | null;
  // Training (last 4 weeks)
  sessionsLast4w: number;
  totalSetsLast4w: number;
  totalVolumeKg: number;
  topExercises: string | null;
  // Nutrition (last 7 days)
  daysLoggedLast7: number;
  avgCalories: number;
  avgProteinG: number;
  // Rule findings
  ruleFindings: Array<{ title: string; body: string }>;
};

export type CoachInsight = {
  past: string;
  present: string;
  verdict: 'good' | 'bad' | 'steady' | 'unknown';
  next: string[];
  raw: string;
};

export async function getCoachInsight(snapshot: CoachSnapshot): Promise<CoachInsight | null> {
  if (!config) {
    console.warn('[llm-client] getCoachInsight skipped: not configured (missing EXPO_PUBLIC_OPENROUTER_KEY?)');
    return null;
  }

  const prompt = buildPrompt(snapshot);
  console.log(`[llm-client] calling ${config.model}, prompt length=${prompt.length}`);

  try {
    const response = await fetch(OPENROUTER_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gym-app.local',
        'X-Title': 'Gym App',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '<unreadable>');
      console.error(`[llm-client] OpenRouter ${response.status} ${response.statusText}: ${body}`);
      return null;
    }

    const data = await response.json();
    const message: string | undefined = data.choices?.[0]?.message?.content;
    if (!message) {
      console.error('[llm-client] OpenRouter returned no message:', JSON.stringify(data).slice(0, 500));
      return null;
    }

    console.log(`[llm-client] success, response length=${message.length}`);
    return parseInsight(message.trim());
  }
  catch (err) {
    console.error('[llm-client] fetch failed:', err);
    return null;
  }
}

const SYSTEM_PROMPT = `You are a concise, evidence-based fitness coach. You read a user's training, body, and nutrition snapshot and respond in EXACTLY this format with no extra text:

PAST: <one sentence summarizing what they've been doing the last 4 weeks>
NOW: <one sentence on the current state — are they progressing, stalling, or regressing>
VERDICT: <one of: good | bad | steady>
NEXT:
- <specific actionable suggestion>
- <specific actionable suggestion>
- <specific actionable suggestion>

Reference real numbers from the snapshot. No fluff. No hedging. If data is missing, say so directly. Verdict guidance: "good" = clearly trending toward goal; "bad" = trending away; "steady" = no clear movement.`;

function buildPrompt(s: CoachSnapshot): string {
  const lines: string[] = [];
  lines.push(`Goal: ${s.goal.replace('_', ' ')}`);
  lines.push(`Profile: ${s.age}y, ${s.heightCm}cm, target ${s.targetWeightKg}kg`);
  lines.push('');
  lines.push('Body (last 30 days):');
  lines.push(`- Current weight: ${s.currentWeightKg != null ? `${s.currentWeightKg}kg` : 'unlogged'}`);
  lines.push(`- Weight change: ${s.weightChange30dKg != null ? `${s.weightChange30dKg > 0 ? '+' : ''}${s.weightChange30dKg.toFixed(1)}kg` : 'no data'}`);
  lines.push(`- Waist change: ${s.waistChange30dCm != null ? `${s.waistChange30dCm > 0 ? '+' : ''}${s.waistChange30dCm.toFixed(1)}cm` : 'no data'}`);
  lines.push('');
  lines.push('Training (last 4 weeks):');
  lines.push(`- Sessions: ${s.sessionsLast4w}`);
  lines.push(`- Total sets: ${s.totalSetsLast4w}`);
  lines.push(`- Total volume: ${Math.round(s.totalVolumeKg)}kg`);
  if (s.topExercises)
    lines.push(`- Top exercises: ${s.topExercises}`);
  lines.push('');
  lines.push('Nutrition (last 7 days):');
  lines.push(`- Days logged: ${s.daysLoggedLast7}/7`);
  if (s.daysLoggedLast7 > 0) {
    lines.push(`- Avg calories: ${Math.round(s.avgCalories)} kcal`);
    lines.push(`- Avg protein: ${Math.round(s.avgProteinG)} g`);
  }
  if (s.ruleFindings.length > 0) {
    lines.push('');
    lines.push('Rule engine findings:');
    for (const f of s.ruleFindings)
      lines.push(`- ${f.title}: ${f.body}`);
  }
  return lines.join('\n');
}

const PAST_RE = /PAST:\s*(.+?)(?=\n[A-Z]+:|\n*$)/s;
const NOW_RE = /NOW:\s*(.+?)(?=\n[A-Z]+:|\n*$)/s;
const VERDICT_RE = /VERDICT:\s*(\w+)/i;
const NEXT_RE = /NEXT:\s*(.+)$/s;
const BULLET_RE = /^[-*•]\s*/;

function parseInsight(text: string): CoachInsight {
  const past = matchSection(text, PAST_RE) ?? '';
  const present = matchSection(text, NOW_RE) ?? '';
  const verdictRaw = matchSection(text, VERDICT_RE)?.toLowerCase() ?? 'unknown';
  const verdict: CoachInsight['verdict']
    = verdictRaw === 'good' || verdictRaw === 'bad' || verdictRaw === 'steady'
      ? verdictRaw
      : 'unknown';

  const nextBlock = matchSection(text, NEXT_RE) ?? '';
  const next = nextBlock
    .split('\n')
    .map(l => l.replace(BULLET_RE, '').trim())
    .filter(l => l.length > 0);

  return { past, present, verdict, next, raw: text };
}

function matchSection(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}
