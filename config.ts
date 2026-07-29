// QUANTAIP Education OS — Central Configuration
import auth from '@react-native-firebase/auth';

// Fallback school code — used only when the logged-in user's email
// can't be parsed (e.g. before login).
export const SCHOOL_CODE = 'GHS-001';

// OpenAI key for the AI Class Insight card (gpt-4o-mini) on the Class Progress
// Report. Leave it empty and the card still works — it falls back to an
// on-device rule-based insight built from the same class stats.
//
// WARNING: anything set here is compiled into the APK and committed to git, so
// treat this key as public. Give it a low monthly spend cap, and rotate it if
// the app is ever distributed outside your own school.
export const OPENAI_API_KEY = '';

// Resolve the active school code from the logged-in user's email
// (e.g. ghs-001-adm-001@quantaip.edu.pk → "GHS-001"). Every screen
// must use this rather than the hard-coded SCHOOL_CODE constant so the
// app is scoped to whichever school the current user belongs to.
export function getSchoolCode(): string {
  const email = auth().currentUser?.email || '';
  const localPart = email.split('@')[0]; // ghs-001-adm-001
  const segs = localPart.split('-');
  if (segs.length >= 2 && segs[0] && segs[1]) {
    return `${segs[0]}-${segs[1]}`.toUpperCase(); // GHS-001
  }
  return SCHOOL_CODE; // fallback only
}
