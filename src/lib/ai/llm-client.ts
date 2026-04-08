// LLM client for natural language coaching insights
// Uses Groq's OpenAI-compatible chat completions endpoint, or returns null
// when not configured. Groq is direct (no aggregator), so the free tier is
// per-account rather than a contended shared pool.

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// Default Groq model. Override at build time with EXPO_PUBLIC_GROQ_MODEL.
export const DEFAULT_LLM_MODEL = 'llama-3.3-70b-versatile';

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
  name: string;
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
    console.warn('[llm-client] getCoachInsight skipped: not configured (missing EXPO_PUBLIC_GROQ_KEY?)');
    return null;
  }

  const prompt = buildPrompt(snapshot);
  console.log(`[llm-client] calling ${config.model}, prompt length=${prompt.length}`);

  try {
    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
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
      console.error(`[llm-client] Groq ${response.status} ${response.statusText}: ${body}`);
      return null;
    }

    const data = await response.json();
    const message: string | undefined = data.choices?.[0]?.message?.content;
    if (!message) {
      console.error('[llm-client] Groq returned no message:', JSON.stringify(data).slice(0, 500));
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

const SYSTEM_PROMPT = `You are a concise, evidence-based fitness coach speaking DIRECTLY to the lifter you know personally. Always use "you" / "your" — never "the user", "they", or third person. Address them by their first name occasionally (sparingly, not in every line). Tone: a knowledgeable training partner, warm but direct. Respond in EXACTLY this format with no extra text:

PAST: <one sentence to them about what they've been doing the last 4 weeks ("You ran four sessions…")>
NOW: <one sentence to them about the current state — are you progressing, stalling, or regressing>
VERDICT: <one of: good | bad | steady>
NEXT:
- <specific actionable suggestion in second person ("Add a set to your…")>
- <specific actionable suggestion>
- <specific actionable suggestion>

Reference real numbers from the snapshot. No fluff. No hedging. No third-person voice. If data is missing, say so directly. Verdict guidance: "good" = clearly trending toward goal; "bad" = trending away; "steady" = no clear movement.`;

const FIRST_NAME_SPLIT_RE = /\s+/;

function buildPrompt(s: CoachSnapshot): string {
  const lines: string[] = [];
  const firstName = s.name.trim().split(FIRST_NAME_SPLIT_RE)[0] || 'there';
  lines.push(`Lifter: ${firstName}`);
  lines.push(`Goal: ${s.goal.replace('_', ' ')}`);
  lines.push(`Profile: ${s.age}y, ${s.heightCm}cm, target ${s.targetWeightKg}kg`);
  lines.push(`Address them as "${firstName}" (first name) and use "you" throughout.`);
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
