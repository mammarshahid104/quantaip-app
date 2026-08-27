// ── OVER-THE-AIR (OTA) UPDATES ──
// Pulls JavaScript-only updates published with `eas update`. This covers JS,
// TypeScript, and bundled assets — screens, business logic, styling, bug fixes.
// It can NOT change native code: adding a native dependency, editing
// AndroidManifest permissions, or changing the app icon/name still requires a
// new AAB and a Play Store review. See CLAUDE.md for the full boundary.
//
// Deliberate behaviour: we download in the background but never call
// Updates.reloadAsync() on our own. This app is used to mark attendance and
// enter marks; yanking the JS bundle out from under a half-filled form would
// lose a teacher's work. expo-updates stores the downloaded bundle and the
// native runtime launches it on the NEXT cold start, which is invisible and
// safe. `promptReload` is exported for the rare case where you want to offer an
// immediate restart instead.
//
// Everything here is a no-op in development and in any build where
// expo-updates is disabled or misconfigured, so it can never break a debug run.

import {useEffect, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import * as Updates from 'expo-updates';

// Updates.isEnabled is false in dev, in Expo Go, and when EXPO_UPDATE_URL is
// missing/invalid — checking it keeps the network calls out of those builds.
const canUpdate = (): boolean => !__DEV__ && Updates.isEnabled;

// Returns true when a new bundle was downloaded and is staged for next launch.
export const checkForUpdate = async (): Promise<boolean> => {
  if (!canUpdate()) return false;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    console.log('✅ QUANTAIP: OTA update downloaded, applies on next launch');
    return true;
  } catch (e) {
    // Offline, server unreachable, or runtime-version mismatch. Never fatal —
    // the app keeps running whatever bundle it already has.
    console.log('❌ QUANTAIP Error:', e);
    return false;
  }
};

// Opt-in immediate restart. Only call this from a spot where you know no
// unsaved input is on screen.
export const applyUpdateNow = async () => {
  if (!canUpdate()) return;
  try {
    await Updates.reloadAsync();
  } catch (e) {
    console.log('❌ QUANTAIP Error:', e);
  }
};

// Checks once on launch, then again each time the app returns to the
// foreground, so a phone left open for days still picks updates up.
export const useOtaUpdates = () => {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!canUpdate()) return;

    checkForUpdate();

    const sub = AppState.addEventListener('change', next => {
      const cameToForeground =
        appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameToForeground) checkForUpdate();
    });

    return () => sub.remove();
  }, []);
};
