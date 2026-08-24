import * as ScreenOrientation from 'expo-screen-orientation'
import { useEffect } from 'react'

import { OrientationMode } from './useDeviceOrientation'

// Opt-in "lock orientation" preference for anyone who'd rather pin the current layout than have it
// follow every tilt — pass `enabled: false` to freely rotate with the device (useDeviceOrientation
// just tracks whatever shape is currently live). When enabled, pins native rotation to whichever
// orientation is active at that moment; disabling it unlocks rather than restoring one specific
// orientation, so free rotation resumes immediately rather than snapping back to whatever was last
// locked. On web this rejects (NotSupportedError) whenever the page isn't in fullscreen — the catch
// keeps that expected, unsupported-environment rejection from surfacing as an unhandled rejection.
export function useOrientationLock(enabled: boolean, orientationMode: OrientationMode) {
  useEffect(() => {
    if (!enabled) {
      ScreenOrientation.unlockAsync().catch(() => {})
      return
    }
    const lock = orientationMode === 'sideBySide' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
    ScreenOrientation.lockAsync(lock).catch(() => {})
  }, [enabled, orientationMode])
}
