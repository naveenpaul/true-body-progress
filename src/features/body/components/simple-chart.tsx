import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type DataPoint = {
  value: number;
  label: string;
};

type Props = {
  data: DataPoint[];
  height?: number;
  color?: string;
};

export function SimpleChart({ data, height = 120, color = '#22C55E' }: Props) {
  if (data.length < 2)
    return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <View className="flex-row" style={{ height }}>
      {/* Y-axis labels */}
      <View className="w-10 justify-between pb-4">
        <Text className="text-[10px] text-charcoal-400">{max.toFixed(1)}</Text>
        <Text className="text-[10px] text-charcoal-400">{((max + min) / 2).toFixed(1)}</Text>
        <Text className="text-[10px] text-charcoal-400">{min.toFixed(1)}</Text>
      </View>

      {/* Bars */}
      <View className="flex-1 flex-row items-end pb-4">
        {data.map((point) => {
          const barHeight = ((point.value - min) / range) * (height - 30);
          return (
            <View key={`${point.label}-${point.value}`} className="flex-1 items-center">
              <View className="w-full flex-1 items-center justify-end">
                <View
                  style={{
                    height: Math.max(barHeight, 2),
                    backgroundColor: color,
                    width: '60%',
                    maxWidth: 20,
                    minWidth: 4,
                    borderRadius: 3,
                  }}
                />
              </View>
              {data.length <= 10 && (
                <Text className="mt-0.5 text-[8px] text-charcoal-400" numberOfLines={1}>
                  {point.label}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
