import type { AudioPlayer } from 'expo-audio';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Rest-timer feedback:
// - In the app: short ticks at 3-2-1, a double beep + vibration at 0.
// - Phone locked / app in background: JS timers pause, so a local notification
//   scheduled for the end of the rest plays the same beep instead.

const CHANNEL_ID = 'rest-timer';
const DONE_SOUND_FILE = 'rest_done.wav'; // bundled via the expo-notifications plugin

let tickPlayer: AudioPlayer | null = null;
let donePlayer: AudioPlayer | null = null;
let scheduledId: string | null = null;
// Bumped on every schedule/cancel so a slow schedule that finishes after a
// newer request can tell it's stale and cancel itself.
let generation = 0;
let initPromise: Promise<void> | null = null;

// Shared promise so concurrent callers all wait for the players to exist.
function init(): Promise<void> {
  initPromise ??= doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
  // Mix the beep over the user's music (ducking would keep it quieter for the
  // whole session) and play it even with the iOS silent switch on — the in-app
  // sound toggle is the way to mute it.
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  tickPlayer = createAudioPlayer(require('../../../assets/sounds/rest_tick.wav'));
  donePlayer = createAudioPlayer(require('../../../assets/sounds/rest_done.wav'));

  // While the app is open we beep ourselves, so suppress the notification UI/sound.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: DONE_SOUND_FILE,
      vibrationPattern: [0, 300, 150, 300],
    });
  }
}

function replay(player: AudioPlayer | null): void {
  if (!player)
    return;
  player.seekTo(0).then(() => player.play()).catch(() => {});
}

export async function playRestTick(): Promise<void> {
  await init();
  replay(tickPlayer);
}

export async function playRestDone(withSound: boolean): Promise<void> {
  await init();
  if (withSound)
    replay(donePlayer);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted)
    return true;
  if (!current.canAskAgain)
    return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// Schedules the background alert for when the rest ends. Replaces any earlier one.
export async function scheduleRestEndAlert(endsAt: number, withSound: boolean): Promise<void> {
  const cancelled = cancelRestEndAlert();
  const myGeneration = generation; // captured synchronously, before any await
  await cancelled;
  try {
    await init();
    if (!(await ensurePermission()))
      return;
    // Measured after the (first-time) permission prompt, which can take a while.
    const seconds = Math.round((endsAt - Date.now()) / 1000);
    if (seconds < 1 || myGeneration !== generation)
      return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest over',
        body: 'Time for your next set.',
        sound: withSound ? DONE_SOUND_FILE : false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL_ID,
      },
    });
    if (myGeneration !== generation)
      await Notifications.cancelScheduledNotificationAsync(id);
    else
      scheduledId = id;
  }
  catch (err) {
    console.warn('[rest-alerts] failed to schedule rest notification', err);
  }
}

export async function cancelRestEndAlert(): Promise<void> {
  generation += 1;
  const id = scheduledId;
  scheduledId = null;
  if (id)
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
