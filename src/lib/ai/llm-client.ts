// LLM client for natural language coaching suggestions
// Uses OpenRouter API (free tier models) or falls back to rule engine text

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

type LLMConfig = {
  apiKey: string;
  model?: string;
};

let config: LLMConfig | null = null;

export function configureLLM(apiKey: string, model?: string): void {
  config = { apiKey, model: model ?? 'mistralai/mistral-7b-instruct:free' };
}

export function isLLMConfigured(): boolean {
  return config !== null && config.apiKey.length > 0;
}

type CoachingInput = {
  goalType: string;
  weightTrend: string;
  waistTrend: string;
  strengthTrend: string;
  ruleSuggestions: Array<{ title: string; body: string }>;
};

export async function getCoachingSuggestion(input: CoachingInput): Promise<string | null> {
  if (!config) return null;

  const prompt = buildPrompt(input);

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
          {
            role: 'system',
            content: 'You are a concise fitness coach. Give specific, actionable advice in 2-3 sentences. No fluff. Reference the user\'s actual numbers when available.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;
    return message?.trim() ?? null;
  }
  catch {
    return null;
  }
}

function buildPrompt(input: CoachingInput): string {
  const lines = [
    `User goal: ${input.goalType.replace('_', ' ')}`,
    '',
    'Recent data:',
    `- Weight: ${input.weightTrend}`,
    `- Waist: ${input.waistTrend}`,
    `- Strength: ${input.strengthTrend}`,
  ];

  if (input.ruleSuggestions.length > 0) {
    lines.push('', 'Current rule engine findings:');
    for (const s of input.ruleSuggestions) {
      lines.push(`- ${s.title}: ${s.body}`);
    }
  }

  lines.push('', 'Give one personalized coaching suggestion covering training, diet, or recovery. Be specific to their data.');

  return lines.join('\n');
}
