// QUANTAIP — Backfill Parent Documents
// ---------------------------------------------------------------------------
// Creates one parent Firestore doc for every existing student in a school that
// doesn't already have one. Each parent gets a generated password in the same
// format the app uses for students: {firstName}{4-digit-random} (from the
// linked student's name, e.g. "Ahmed Ali" -> "Ahmed4521").
//
// Parent id mirrors the student id with the role segment swapped:
//   TST-001-STU-0083  ->  TST-001-PAR-0083
// (or the student's own `parentId` field if it already has one).
//
// Uses the Firebase JS *web* SDK (NOT firebase-admin). It only writes Firestore
// as the signed-in admin — no Auth signups — so it isn't affected by Firebase's
// per-IP signup rate limit. Run createAuthAccounts.mjs afterwards to turn these
// parent docs into Auth accounts.
//
// Idempotent: parents that already exist are skipped.
//
// Usage:
//   ADMIN_PASSWORD=TST@2026 node scripts/addDummyData.mjs TST-001
//
// Optional env:
//   ADMIN_EMAIL   override the admin email (default <code>-adm-001@quantaip.edu.pk)
// ---------------------------------------------------------------------------

import {initializeApp, deleteApp} from 'firebase/app';
import {getAuth, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  terminate,
} from 'firebase/firestore';

// Web SDK config (from android/app/google-services.json — same Firebase project)
const firebaseConfig = {
  apiKey: 'AIzaSyAeTAwG2-hZmGadQcwko33GF6rV956bAzs',
  authDomain: 'quantaip-eduapp.firebaseapp.com',
  projectId: 'quantaip-eduapp',
  storageBucket: 'quantaip-eduapp.firebasestorage.app',
  messagingSenderId: '676753188837',
  appId: '1:676753188837:android:08ee145fdbd955e58ff10c',
};

const EMAIL_DOMAIN = 'quantaip.edu.pk';

// ── inputs ──────────────────────────────────────────────────────────────
const SCHOOL_CODE = (process.argv[2] || 'TST-001').toUpperCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  `${SCHOOL_CODE.toLowerCase()}-adm-001@${EMAIL_DOMAIN}`;

if (!ADMIN_PASSWORD) {
  console.error(
    '❌ Missing ADMIN_PASSWORD.\n' +
      `   Run: ADMIN_PASSWORD=yourpass node scripts/addDummyData.mjs ${SCHOOL_CODE}`,
  );
  process.exit(1);
}

// Same format the app uses for students: {firstName}{4-digit-random}
const generatePass = name => {
  const first = String(name || 'Parent').trim().split(/\s+/)[0] || 'Parent';
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${first}${num}`;
};

// Derive the parent id for a student: prefer the student's own parentId, else
// swap the -STU- role segment for -PAR-.
const parentIdFor = student => {
  if (student.parentId) return String(student.parentId);
  const sid = String(student.id || '');
  if (sid.includes('-STU-')) return sid.replace('-STU-', '-PAR-');
  return null;
};

const shutdown = async (app, db) => {
  try {
    await terminate(db);
  } catch {
    /* ignore */
  }
  try {
    await deleteApp(app);
  } catch {
    /* ignore */
  }
};

const main = async () => {
  console.log(`👨‍👩‍👧 Backfilling parent docs for ${SCHOOL_CODE}`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // Sign in as the school admin (needed for the Firestore writes below).
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log(`   ✓ Signed in as ${ADMIN_EMAIL}`);
    } catch (e) {
      console.error(`❌ Admin sign-in failed: ${e.code || e.message}`);
      console.error(
        `   Check that ${ADMIN_EMAIL} exists in Auth and ADMIN_PASSWORD is correct.`,
      );
      process.exitCode = 1;
      return;
    }

    const base = `schools/${SCHOOL_CODE}`;
    const studentSnap = await getDocs(collection(db, `${base}/students`));
    const students = studentSnap.docs.map(d => ({id: d.id, ...d.data()}));
    console.log(`   ✓ Found ${students.length} students\n`);

    const total = students.length;
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let done = 0;

    for (const student of students) {
      const parentId = parentIdFor(student);
      if (!parentId) {
        console.warn(
          `\n   ⚠️  ${student.id || '(no id)'}: can't derive a parent id — skipping.`,
        );
        failed++;
        done++;
        continue;
      }

      try {
        const parentRef = doc(db, `${base}/parents/${parentId}`);
        const existing = await getDoc(parentRef);
        if (existing.exists()) {
          skipped++;
        } else {
          const studentName = student.fullName || student.name || '';
          await setDoc(parentRef, {
            id: parentId,
            studentId: student.id,
            studentName,
            phone: student.parentPhone || '',
            password: generatePass(studentName),
            role: 'parent',
            school: SCHOOL_CODE,
            createdAt: serverTimestamp(),
          });
          // Link the student back to its parent if it isn't already.
          if (!student.parentId) {
            await updateDoc(doc(db, `${base}/students/${student.id}`), {
              parentId,
            });
          }
          created++;
        }
      } catch (e) {
        console.warn(`\n   ⚠️  ${parentId}: ${e.code || e.message}`);
        failed++;
      }

      done++;
      process.stdout.write(`\r👨‍👩‍👧 Parents: ${done}/${total}   `);
    }

    process.stdout.write('\n');

    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }

    console.log(
      `\n✅ Done! ${SCHOOL_CODE} parents backfilled. ` +
        `(created ${created}, skipped ${skipped} (already existed), failed ${failed})`,
    );
    if (created > 0) {
      console.log(
        '   Next: run createAuthAccounts.mjs to create the parent Auth accounts.',
      );
    }
    process.exitCode = failed > 0 ? 2 : 0;
  } finally {
    await shutdown(app, db);
  }
};

main().catch(e => {
  console.error('❌ Unexpected error:', e);
  process.exitCode = 1;
});
