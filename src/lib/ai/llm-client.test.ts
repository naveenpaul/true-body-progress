import {
  configureLLM,
  DEFAULT_LLM_MODEL,
  getCoachInsight,
  getLLMConfig,
  isLLMConfigured,
  resetLLMForTests,
} from './llm-client';

// Sanity tests so a half-broken LLM setup fails loudly in CI rather than
// silently turning the dashboard coach into the empty-state fallback.

const SNAPSHOT = {
  goal: 'fat_loss',
  age: 30,
  heightCm: 180,
  targetWeightKg: 75,
  currentWeightKg: 80,
  weightChange30dKg: -1,
  waistChange30dCm: -1,
  sessionsLast4w: 4,
  totalSetsLast4w: 40,
  totalVolumeKg: 5000,
  topExercises: 'Bench Press',
  daysLoggedLast7: 5,
  avgCalories: 2000,
  avgProteinG: 150,
  ruleFindings: [],
};

describe('llm-client', () => {
  beforeEach(() => {
    resetLLMForTests();
  });

  describe('default model id', () => {
    // Regression: the default used to be "qwen/qwen3.6-plus:free" — a model that
    // does not exist on OpenRouter, so even users who set their API key got 404s
    // and silently saw the fallback empty state.
    it('is a real-looking openrouter slug, not the historical broken default', () => {
      expect(DEFAULT_LLM_MODEL).not.toBe('qwen/qwen3.6-plus:free');
      expect(DEFAULT_LLM_MODEL).toMatch(/^[a-z0-9-]+\/[a-z0-9.\-:]+$/);
      expect(DEFAULT_LLM_MODEL).toMatch(/:free$/);
    });
  });

  describe('isLLMConfigured', () => {
    it('returns false before configureLLM is called', () => {
      expect(isLLMConfigured()).toBe(false);
    });

    it('returns false when configured with an empty key', () => {
      configureLLM('');
      expect(isLLMConfigured()).toBe(false);
    });

    it('returns true after configureLLM with a non-empty key', () => {
      configureLLM('sk-test');
      expect(isLLMConfigured()).toBe(true);
    });
  });

  describe('configureLLM', () => {
    it('falls back to DEFAULT_LLM_MODEL when no model is provided', () => {
      configureLLM('sk-test');
      expect(getLLMConfig()?.model).toBe(DEFAULT_LLM_MODEL);
    });

    it('falls back to DEFAULT_LLM_MODEL when an empty model string is provided', () => {
      configureLLM('sk-test', '');
      expect(getLLMConfig()?.model).toBe(DEFAULT_LLM_MODEL);
    });

    it('respects an explicit model override', () => {
      configureLLM('sk-test', 'google/gemini-2.0-flash-exp:free');
      expect(getLLMConfig()?.model).toBe('google/gemini-2.0-flash-exp:free');
    });
  });

  describe('getCoachInsight', () => {
    it('returns null without making a network call when not configured', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch' as any);
      const result = await getCoachInsight(SNAPSHOT);
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('returns null and logs when OpenRouter rejects the model id', async () => {
      configureLLM('sk-test', 'totally/made-up-model:free');
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch' as any)
        .mockResolvedValue(new Response('{"error":{"message":"unknown model"}}', { status: 404 }) as any);
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getCoachInsight(SNAPSHOT);
      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(errSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
      errSpy.mockRestore();
    });

    it('parses a well-formed PAST/NOW/VERDICT/NEXT response', async () => {
      configureLLM('sk-test');
      const body = {
        choices: [{
          message: {
            content: 'PAST: trained 4x last month\nNOW: weight trending down\nVERDICT: good\nNEXT:\n- keep deficit\n- add protein\n- sleep more',
          },
        }],
      };
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch' as any)
        .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }) as any);
      const result = await getCoachInsight(SNAPSHOT);
      expect(result).not.toBeNull();
      expect(result?.verdict).toBe('good');
      expect(result?.next).toEqual(['keep deficit', 'add protein', 'sleep more']);
      fetchSpy.mockRestore();
    });
  });
});
