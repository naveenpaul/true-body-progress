import type { TextStyle } from 'react-native';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';

import { cancelRestEndAlert, playRestDone, playRestTick, scheduleRestEndAlert } from './rest-alerts';
import { formatSeconds } from './set-utils';
import { useWorkoutStore } from './use-workout-store';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

// If we only notice the rest ended this long after it did (app was in the
// background), the notification already alerted — don't beep again.
const LATE_BEEP_GRACE_MS = 1500;

// Floating rest timer: idle shows the duration stepper + start, running shows
// the countdown. Beeps 3-2-1 and at zero; a scheduled notification covers the
// phone-locked case.
export function RestTimerBar({ bottomInset }: { bottomInset: number }) {
  const restDuration = useWorkoutStore.use.restDuration();
  const restEndsAt = useWorkoutStore.use.restEndsAt();
  const startRest = useWorkoutStore.use.startRest();
  const cancelRest = useWorkoutStore.use.cancelRest();
  const setRestDuration = useWorkoutStore.use.setRestDuration();
  const soundEnabled = useWorkoutStore.use.restSoundEnabled();
  const setSoundEnabled = useWorkoutStore.use.setRestSoundEnabled();

  const [now, setNow] = useState(() => Date.now());
  const lastTickRef = useRef<number | null>(null);

  // Tick a few times a second while running so 3-2-1 beeps land on time.
  useEffect(() => {
    if (!restEndsAt)
      return;
    lastTickRef.current = null;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // Background alert for when the phone is locked. Rescheduled whenever the
  // rest changes; cancelled on skip, finish, or leaving the workout.
  useEffect(() => {
    if (!restEndsAt)
      return;
    void scheduleRestEndAlert(restEndsAt, soundEnabled);
    return () => {
      void cancelRestEndAlert();
    };
  }, [restEndsAt, soundEnabled]);

  // End of rest: beep + vibrate, then hide the countdown.
  useEffect(() => {
    if (!restEndsAt)
      return;
    const finish = () => {
      if (Date.now() - restEndsAt < LATE_BEEP_GRACE_MS)
        void playRestDone(soundEnabled);
      cancelRest();
    };
    const remaining = restEndsAt - Date.now();
    if (remaining <= 0) {
      finish();
      return;
    }
    const id = setTimeout(finish, remaining);
    return () => clearTimeout(id);
  }, [restEndsAt, cancelRest, soundEnabled]);

  // `now` can be stale for the first tick after a rest starts; clamp so the
  // countdown never shows more than the rest length.
  const remainingSec = restEndsAt
    ? Math.min(restDuration, Math.max(0, Math.ceil((restEndsAt - now) / 1000)))
    : 0;

  // 3-2-1 countdown ticks.
  useEffect(() => {
    if (!restEndsAt || !soundEnabled || remainingSec < 1 || remainingSec > 3)
      return;
    if (lastTickRef.current === remainingSec)
      return;
    lastTickRef.current = remainingSec;
    void playRestTick();
  }, [remainingSec, restEndsAt, soundEnabled]);

  const soundToggle = (
    <Pressable
      onPress={() => setSoundEnabled(!soundEnabled)}
      hitSlop={8}
      accessibilityLabel={soundEnabled ? 'Mute rest timer' : 'Unmute rest timer'}
    >
      <Text className="text-lg">{soundEnabled ? '🔔' : '🔕'}</Text>
    </Pressable>
  );

  if (restEndsAt) {
    return (
      <View
        className="absolute inset-x-5 flex-row items-center justify-between rounded-2xl bg-success-500 px-5 py-4 shadow-lg"
        style={{ bottom: bottomInset + 12 }}
      >
        <Text className="text-lg font-bold text-black" style={NUM_STYLE}>
          {`Rest  ${formatSeconds(remainingSec)}`}
        </Text>
        <View className="flex-row items-center gap-4">
          {soundToggle}
          <Pressable onPress={cancelRest}>
            <Text className="text-sm font-semibold text-black">Skip</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      className="absolute inset-x-5 flex-row items-center justify-between rounded-2xl border border-ink-hairline bg-ink-card px-4 py-3"
      style={{ bottom: bottomInset + 12 }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => setRestDuration(restDuration - 15)}
          className="size-8 items-center justify-center rounded-full border border-ink-hairline"
        >
          <Text className="text-base text-ink-text">−</Text>
        </Pressable>
        <Text className="w-12 text-center text-base font-semibold text-ink-text" style={NUM_STYLE}>
          {formatSeconds(restDuration)}
        </Text>
        <Pressable
          onPress={() => setRestDuration(restDuration + 15)}
          className="size-8 items-center justify-center rounded-full border border-ink-hairline"
        >
          <Text className="text-base text-ink-text">+</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center gap-3">
        {soundToggle}
        <Pressable
          onPress={startRest}
          className="rounded-lg bg-success-500 px-4 py-2"
        >
          <Text className="text-sm font-bold text-black">Start rest</Text>
        </Pressable>
      </View>
    </View>
  );
}
