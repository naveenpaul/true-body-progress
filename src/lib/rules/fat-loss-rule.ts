import type { Suggestion } from '@/lib/types';

type FatLossInput = {
  weightTrend: Array<{ date: string; weight: number }>;
  waistTrend: Array<{ date: string; waist: number }>;
};

export function evaluateFatLoss(input: FatLossInput): Suggestion | null {
  const { weightTrend, waistTrend } = input;

  if (weightTrend.length < 14 || waistTrend.length < 14)
    return null;

  const recentWeight = weightTrend.slice(-7);
  const olderWeight = weightTrend.slice(-14, -7);
  const recentWaist = waistTrend.slice(-7);
  const olderWaist = waistTrend.slice(-14, -7);

  const avgRecentWeight = average(recentWeight.map(w => w.weight));
  const avgOlderWeight = average(olderWeight.map(w => w.weight));
  const avgRecentWaist = average(recentWaist.map(w => w.waist));
  const avgOlderWaist = average(olderWaist.map(w => w.waist));

  const weightChange = avgRecentWeight - avgOlderWeight;
  const waistChange = avgRecentWaist - avgOlderWaist;

  const weightStable = Math.abs(weightChange) < 0.3;
  const waistStable = Math.abs(waistChange) < 0.5;
  const weightDown = weightChange < -0.3;
  const waistDown = waistChange < -0.5;
  const weightUp = weightChange > 0.3;

  if (weightDown && waistDown) {
    return {
      id: 'fat-loss-progress',
      type: 'fat_loss',
      title: 'Great progress',
      body: `Weight down ${Math.abs(weightChange).toFixed(1)}kg and waist down ${Math.abs(waistChange).toFixed(1)}cm this week. Keep it up.`,
      priority: 4,
    };
  }

  if (weightUp && waistDown) {
    return {
      id: 'fat-loss-recomp',
      type: 'fat_loss',
      title: 'Body recomposition detected',
      body: `Weight up but waist shrinking. You're likely gaining muscle and losing fat. This is exactly what you want.`,
      priority: 3,
    };
  }

  if (weightStable && waistStable) {
    return {
      id: 'fat-loss-plateau',
      type: 'fat_loss',
      title: 'Progress has stalled',
      body: `Weight and waist stable for 2 weeks. Consider reducing daily calories by 200 or adding one more training session per week.`,
      priority: 2,
    };
  }

  return null;
}

function average(nums: number[]): number {
  if (nums.length === 0)
    return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
