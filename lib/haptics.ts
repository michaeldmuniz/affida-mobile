import * as Haptics from 'expo-haptics'

// Centralized haptic feedback — fire-and-forget so a failed call never breaks UI flow.
export const haptics = {
    /** Light tick for taps on rows, toggles, pickers */
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
    /** Medium thunk for primary buttons and sheet openings */
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
    /** Confirmation buzz after a successful save/create */
    success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
    /** Warning buzz for destructive confirmations */
    warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
    /** Error buzz when an action fails */
    error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
}
