/** Brief haptic tick for the long-press-confirmed moment - feature-detected, silently a no-op wherever the Vibration API isn't available (desktop browsers, iOS Safari). */
export function vibrateShort(): void {
  navigator.vibrate?.(10)
}
