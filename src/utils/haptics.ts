import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const run = async (task: () => Promise<void>) => {
  try {
    await task();
  } catch {
    // Ignore unsupported-device errors.
  }
};

const androidTick = (kind: Haptics.AndroidHaptics) =>
  run(() => Haptics.performAndroidHapticsAsync(kind));

const impact = (style: Haptics.ImpactFeedbackStyle) =>
  run(() => Haptics.impactAsync(style));

export const haptics = {
  selection: () =>
    Platform.OS === 'android'
      ? androidTick(Haptics.AndroidHaptics.Segment_Tick)
      : run(() => Haptics.selectionAsync()),
  light: () =>
    Platform.OS === 'android'
      ? androidTick(Haptics.AndroidHaptics.Clock_Tick)
      : impact(Haptics.ImpactFeedbackStyle.Soft),
  medium: () =>
    Platform.OS === 'android'
      ? androidTick(Haptics.AndroidHaptics.Context_Click)
      : impact(Haptics.ImpactFeedbackStyle.Light),
  success: () =>
    Platform.OS === 'android'
      ? androidTick(Haptics.AndroidHaptics.Confirm)
      : run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () =>
    Platform.OS === 'android'
      ? androidTick(Haptics.AndroidHaptics.Reject)
      : run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
