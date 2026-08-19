// ── SAVED LOGIN CREDENTIALS ──
// "Remember me" storage for the login screen. Credentials live in AsyncStorage
// on the device only — nothing here ever leaves the phone.
//
// The password is obfuscated rather than left as plain text so a casual read of
// the app's data directory doesn't hand over a working password. This is NOT
// real encryption — the key ships inside the app, so anyone determined enough
// to pull the file can also pull the key. It raises the bar, it does not
// replace a keystore. Treat "Remember me" as a convenience for personal
// devices; the login screen defaults it on but offers an opt-out for shared
// school devices, and "Sign out & forget me" clears everything below.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ID = '@quantaip/saved_id';
const KEY_PASS = '@quantaip/saved_pass';
const KEY_REMEMBER = '@quantaip/remember_me';

const CIPHER_KEY = 'QUANTAIP-EduOS-2026';

// XOR each character against the repeating key and write it out as fixed-width
// hex, so any character (including non-ASCII) survives the round trip.
const obfuscate = (plain: string): string => {
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const code =
      plain.charCodeAt(i) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length);
    out += code.toString(16).padStart(4, '0');
  }
  return out;
};

const deobfuscate = (stored: string): string => {
  let out = '';
  for (let i = 0; i + 4 <= stored.length; i += 4) {
    const code = parseInt(stored.slice(i, i + 4), 16);
    if (Number.isNaN(code)) return '';
    out += String.fromCharCode(
      code ^ CIPHER_KEY.charCodeAt((i / 4) % CIPHER_KEY.length),
    );
  }
  return out;
};

export type SavedCredentials = {
  id: string;
  pass: string;
  remember: boolean;
};

// Read back what was saved. `remember` defaults to true for a first-run device
// so the login screen's checkbox starts checked; it only turns false once the
// user has actually opted out.
export const loadCredentials = async (): Promise<SavedCredentials> => {
  try {
    const [[, id], [, pass], [, remember]] = await AsyncStorage.multiGet([
      KEY_ID,
      KEY_PASS,
      KEY_REMEMBER,
    ]);
    return {
      id: id || '',
      pass: pass ? deobfuscate(pass) : '',
      remember: remember !== 'false',
    };
  } catch (e) {
    console.log('❌ QUANTAIP Error:', e);
    return {id: '', pass: '', remember: true};
  }
};

export const saveCredentials = async (id: string, pass: string) => {
  try {
    await AsyncStorage.multiSet([
      [KEY_ID, id],
      [KEY_PASS, obfuscate(pass)],
      [KEY_REMEMBER, 'true'],
    ]);
  } catch (e) {
    console.log('❌ QUANTAIP Error:', e);
  }
};

// Drop the stored ID/password but remember that the user opted out, so the
// checkbox stays unchecked next time instead of silently re-arming itself.
export const clearCredentials = async () => {
  try {
    await AsyncStorage.multiRemove([KEY_ID, KEY_PASS]);
    await AsyncStorage.setItem(KEY_REMEMBER, 'false');
  } catch (e) {
    console.log('❌ QUANTAIP Error:', e);
  }
};

// "Forget me" at sign-out: wipe the credentials but leave the preference alone,
// so a user who normally wants to be remembered still is on the next login.
export const forgetCredentials = async () => {
  try {
    await AsyncStorage.multiRemove([KEY_ID, KEY_PASS]);
  } catch (e) {
    console.log('❌ QUANTAIP Error:', e);
  }
};
