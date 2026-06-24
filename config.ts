// QUANTAIP Education OS — Central Configuration
import auth from '@react-native-firebase/auth';

// Fallback school code — used only when the logged-in user's email
// can't be parsed (e.g. before login).
export const SCHOOL_CODE = 'GHS-001';

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
