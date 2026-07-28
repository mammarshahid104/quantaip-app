// Teacher's improvement notes, stored per subject on the student doc:
//   students/{id}.teacherNotes = { "Mathematics": {note, updatedBy, updatedAt} }
// Teachers write them from TeacherScreen's Progress tab; students and parents
// read them.

export type TeacherNote = {
  note?: string;
  updatedBy?: string;
  // Firestore Timestamp on read, a Date right after a local save.
  updatedAt?: any;
};

// Firestore hands back a Timestamp; a freshly saved note holds a Date.
function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

// "Last updated 12/07/2026 by Mr. Ahmed" — either half is dropped if missing.
export function noteMetaLine(entry: TeacherNote | undefined): string {
  if (!entry) return '';
  const date = toDate(entry.updatedAt);
  const parts: string[] = [];
  if (date) parts.push(`Last updated ${date.toLocaleDateString()}`);
  if (entry.updatedBy) parts.push(`by ${entry.updatedBy}`);
  return parts.join(' ');
}

// Subjects that actually have a note, alphabetically.
export function subjectsWithNotes(teacherNotes: any): string[] {
  return Object.keys(teacherNotes || {})
    .filter(subject => String(teacherNotes[subject]?.note || '').trim())
    .sort((a, b) => a.localeCompare(b));
}
