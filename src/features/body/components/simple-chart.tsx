import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

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

const Y_AXIS_WIDTH = 36;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 18;
const PADDING_RIGHT = 8;

export function SimpleChart({ data, height = 140, color = '#22C55E' }: Props) {
  const [chartWidth, setChartWidth] = React.useState(0);

  // We need at least two points to draw a line. With one point we'd just have a
  // dot floating in space, which tells the user nothing useful.
  if (data.length < 2)
    return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Add 5% padding to the range so the line never hugs the top/bottom edges.
  // For a flat line (range === 0) we synthesize a small range so it renders
  // mid-chart instead of collapsing into a single y coordinate.
  const rawRange = max - min;
  const range = rawRange === 0 ? Math.max(Math.abs(max) * 0.05, 1) : rawRange * 1.1;
  const yMin = rawRange === 0 ? max - range / 2 : min - rawRange * 0.05;
  const yMax = rawRange === 0 ? max + range / 2 : max + rawRange * 0.05;

  const innerWidth = Math.max(0, chartWidth - PADDING_RIGHT);
  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const xFor = (i: number) =>
    data.length === 1 ? innerWidth / 2 : (i / (data.length - 1)) * innerWidth;
  const yFor = (v: number) =>
    PADDING_TOP + (1 - (v - yMin) / (yMax - yMin)) * innerHeight;

  // Build the line path and the area-fill path (line + closing baseline).
  const linePath = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`)
    .join(' ');
  const baselineY = PADDING_TOP + innerHeight;
  const areaPath = `${linePath} L ${xFor(data.length - 1)} ${baselineY} L ${xFor(0)} ${baselineY} Z`;

  const midValue = (yMin + yMax) / 2;
  const formatY = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

  // Show first/last x-axis labels always; show middle when there's room.
  const showMiddleLabel = data.length >= 5 && data.length <= 20;
  const middleIndex = Math.floor((data.length - 1) / 2);

  return (
    <View className="flex-row" style={{ height }}>
      {/* Y-axis labels */}
      <View
        className="justify-between"
        style={{ width: Y_AXIS_WIDTH, paddingTop: PADDING_TOP - 6, paddingBottom: PADDING_BOTTOM - 6 }}
      >
        <Text className="text-[10px] text-ink-faint" style={{ fontVariant: ['tabular-nums'] }}>
          {formatY(yMax)}
        </Text>
        <Text className="text-[10px] text-ink-faint" style={{ fontVariant: ['tabular-nums'] }}>
          {formatY(midValue)}
        </Text>
        <Text className="text-[10px] text-ink-faint" style={{ fontVariant: ['tabular-nums'] }}>
          {formatY(yMin)}
        </Text>
      </View>

      {/* Chart area */}
      <View
        className="flex-1"
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w !== chartWidth)
            setChartWidth(w);
        }}
      >
        {chartWidth > 0 && (
          <>
            <Svg width={chartWidth} height={height}>
              {/* Faint horizontal gridlines at top, mid, baseline */}
              <Line
                x1={0}
                y1={PADDING_TOP}
                x2={innerWidth}
                y2={PADDING_TOP}
                stroke="#26272D"
                strokeWidth={1}
              />
              <Line
                x1={0}
                y1={PADDING_TOP + innerHeight / 2}
                x2={innerWidth}
                y2={PADDING_TOP + innerHeight / 2}
                stroke="#26272D"
                strokeWidth={1}
              />
              <Line
                x1={0}
                y1={baselineY}
                x2={innerWidth}
                y2={baselineY}
                stroke="#26272D"
                strokeWidth={1}
              />

              {/* Filled area under the line — gives the trend visual weight without
                  needing a gradient. 12% opacity stays subtle on dark surfaces. */}
              <Path d={areaPath} fill={color} fillOpacity={0.12} />

              {/* The line itself */}
              <Path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Endpoint dots — emphasize first and last so users can
                  see "started here, ended here" at a glance. */}
              <Circle cx={xFor(0)} cy={yFor(data[0].value)} r={3} fill={color} />
              <Circle
                cx={xFor(data.length - 1)}
                cy={yFor(data.at(-1)!.value)}
                r={3.5}
                fill={color}
              />
            </Svg>

            {/* X-axis labels (positioned absolutely so they don't fight the SVG) */}
            <View
              className="absolute inset-x-0 flex-row justify-between"
              style={{ bottom: 0, paddingRight: PADDING_RIGHT }}
            >
              <Text className="text-[10px] text-ink-faint" style={{ fontVariant: ['tabular-nums'] }}>
                {data[0].label}
              </Text>
              {showMiddleLabel && (
                <Text className="text-[10px] text-ink-faint" style={{ fontVariant: ['tabular-nums'] }}>
                  {data[middleIndex].label}
                </Text>
              )}
              <Text className="text-[10px] text-ink-faint" style={{ fontVariant: ['tabular-nums'] }}>
                {data.at(-1)!.label}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
