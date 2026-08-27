// hooks/useAutoFullscreenOnRotate.js
//
// Opens a video in fullscreen when the phone is physically turned to landscape,
// and closes it when the phone is turned back to portrait.
//
// Why the accelerometer and not ScreenOrientation:
// the app is locked to PORTRAIT_UP (see app/_layout.jsx), so iOS never reports an
// interface-orientation change. Reading gravity is the only way to know the phone
// was turned while the UI itself stays portrait — which is what we want here:
// the mission screen must not rotate, only the player.

import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';

const SAMPLE_MS = 200;
// Gravity thresholds with a dead zone between them, so a phone held at an angle
// does not flip back and forth.
const LANDSCAPE_X = 0.75;
const PORTRAIT_Y = 0.75;
// A tilt has to hold this long before we act on it, so putting the phone down
// on a table or a quick hand movement never opens the player.
const HOLD_MS = 400;

export default function useAutoFullscreenOnRotate({ enabled, getVideoRef }) {
  const isFullscreen = useRef(false);
  // Set when the viewer closes the player themselves while still holding the
  // phone sideways. We stay out of their way until the phone returns to portrait.
  const suppressed = useRef(false);
  const pending = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const clearPending = () => {
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
      }
    };

    const enter = async () => {
      const video = getVideoRef();
      if (!video || isFullscreen.current) return;
      isFullscreen.current = true;
      try {
        await video.presentFullscreenPlayer();
        await video.playAsync();
      } catch {
        isFullscreen.current = false;
      }
    };

    const exit = async () => {
      const video = getVideoRef();
      if (!video || !isFullscreen.current) return;
      isFullscreen.current = false;
      try {
        await video.dismissFullscreenPlayer();
      } catch {
        // Already dismissed by the viewer — nothing to undo.
      }
    };

    Accelerometer.setUpdateInterval(SAMPLE_MS);
    const sub = Accelerometer.addListener(({ x, y }) => {
      if (cancelled) return;

      const landscape = Math.abs(x) > LANDSCAPE_X;
      const portrait = Math.abs(y) > PORTRAIT_Y;
      // In the dead zone (flat on a table, or held diagonally) we do nothing.
      if (!landscape && !portrait) {
        clearPending();
        return;
      }

      if (portrait) {
        suppressed.current = false;
        if (isFullscreen.current) {
          clearPending();
          pending.current = setTimeout(exit, HOLD_MS);
        } else {
          clearPending();
        }
        return;
      }

      // landscape
      if (suppressed.current || isFullscreen.current) {
        clearPending();
        return;
      }
      if (!pending.current) {
        pending.current = setTimeout(enter, HOLD_MS);
      }
    });

    return () => {
      cancelled = true;
      clearPending();
      sub.remove();
      // Leaving the screen with the player still open would strand the viewer
      // in a fullscreen video with nothing behind it.
      if (isFullscreen.current) {
        isFullscreen.current = false;
        getVideoRef()?.dismissFullscreenPlayer?.().catch(() => {});
      }
    };
  }, [enabled, getVideoRef]);

  // Called from the player's own onFullscreenUpdate so that a viewer who taps
  // the close button while still sideways is not immediately pulled back in.
  return {
    handleDismissedByViewer: () => {
      if (isFullscreen.current) {
        isFullscreen.current = false;
        suppressed.current = true;
      }
    },
    handlePresentedByViewer: () => {
      isFullscreen.current = true;
    },
  };
}
