// Class list — single source of truth.
// Every "Class" dropdown in the app reads schools/{schoolCode}/classes; nothing
// hardcodes Nursery…Grade 12 any more, so a school with only "Play Group" and
// "Montessori" sees exactly those.
//
// Mirrors quantaip-web's src/services/classes.js — keep the two in sync.
import {useCallback, useEffect, useState} from 'react';
import firestore from '@react-native-firebase/firestore';
import {getSchoolCode} from '../config';

// Order: Pre-Nursery, Nursery, Prep, KG, then Grade 1..12, unknowns last.
const NAMED_RANK: {[key: string]: number} = {
  'pre-nursery': -4,
  prenursery: -4,
  nursery: -3,
  prep: -2,
  kg: -1,
  kindergarten: -1,
};

export function classRank(name: string): number {
  const key = String(name).toLowerCase().trim();
  if (key in NAMED_RANK) return NAMED_RANK[key];
  const m = key.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 999;
}

// Known names keep the Nursery → Grade 12 order; anything else falls back to
// alphabetical (and sorts after the known ones).
export function classSort(a: string, b: string): number {
  const ra = classRank(a);
  const rb = classRank(b);
  if (ra !== rb) return ra - rb;
  return String(a).localeCompare(String(b));
}

export const NO_CLASSES_MESSAGE =
  'No classes found. Please add classes first from the web dashboard or Classes screen.';

// Sorted class names from schools/{schoolCode}/classes.
export async function fetchClassNames(schoolCode?: string): Promise<string[]> {
  const code = schoolCode || getSchoolCode();
  const snap = await firestore()
    .collection('schools').doc(code)
    .collection('classes').get();
  const names = snap.docs
    .map(d => String((d.data() || {}).name || d.id).trim())
    .filter(Boolean);
  return Array.from(new Set(names)).sort(classSort);
}

// Case-insensitive lookup so "grade 1" in a spreadsheet matches "Grade 1".
export function matchClass(classList: string[], value: any): string | null {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return classList.find(c => c.toLowerCase() === key) || null;
}

export type UseClasses = {
  classes: string[];
  loading: boolean;
  error: string;
  empty: boolean;
  reload: () => Promise<void>;
};

// Live class list for a school. `empty` is true only once loading has finished
// with nothing in the collection — that's the "add classes first" state.
export function useClasses(schoolCode?: string): UseClasses {
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setClasses(await fetchClassNames(schoolCode));
    } catch (e: any) {
      console.log('❌ QUANTAIP Error: load classes failed', e);
      setError(
        e?.code === 'firestore/permission-denied'
          ? "You don't have access to this school's classes."
          : "Couldn't load classes. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolCode]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    classes,
    loading,
    error,
    empty: !loading && !error && classes.length === 0,
    reload,
  };
}
