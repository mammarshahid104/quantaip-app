// QUANTAIP — Auth Account Backfill
// ---------------------------------------------------------------------------
// Reads existing Firestore docs (teachers / students / parents) for a school
// and creates the matching Firebase Auth accounts, using the email convention
//   <id-lowercase>@quantaip.edu.pk   and the `password` field on each doc.
//
// This uses the Firebase JS *web* SDK (the `firebase` package) — NOT
// firebase-admin — so it stays within the app's auth model: it signs in as the
// school admin, reads the docs, then calls createUserWithEmailAndPassword for
// each record. Accounts that already exist are skipped, not treated as errors.
//
// NOTE: createUserWithEmailAndPassword signs the client in AS the newly created
// user. So we deliberately do every Firestore read first (while the admin is
// authenticated, satisfying security rules) and only then create accounts.
//
// Usage:
//   ADMIN_PASSWORD=Test@1234 node scripts/createAuthAccounts.mjs TST-001
//
// Optional env:
//   ADMIN_EMAIL   override the admin email (default <code>-adm-001@quantaip.edu.pk)
// ---------------------------------------------------------------------------

import {initializeApp, deleteApp} from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
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
      `   Run: ADMIN_PASSWORD=yourpass node scripts/createAuthAccounts.mjs ${SCHOOL_CODE}`,
  );
  process.exit(1);
}

const emailFor = id => `${String(id).toLowerCase()}@${EMAIL_DOMAIN}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Same format the app uses for students: {firstName}{4-digit-random}
// e.g. "Ahmed Ali" -> "Ahmed4521".
const generatePass = name => {
  const first = String(name || 'Parent').trim().split(/\s+/)[0] || 'Parent';
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${first}${num}`;
};

// Parents are often seeded without a password. Generate one (from the linked
// student's name) and persist it back to the parent's Firestore doc, so both
// the Auth account and the doc agree. MUST run while still signed in as admin,
// before account creation churns the active session.
const backfillParentPasswords = async (db, base, parents) => {
  let fixed = 0;
  for (const p of parents) {
    if (String(p.password || '').trim().length >= 6) continue;
    const pass = generatePass(p.studentName || p.name);
    try {
      await updateDoc(doc(db, `${base}/parents/${p.id}`), {password: pass});
      p.password = pass; // reuse in-memory for the create step below
      fixed++;
    } catch (e) {
      console.warn(
        `\n   ⚠️  Could not save password for parent ${p.id}: ${e.code || e.message}`,
      );
    }
  }
  if (fixed > 0) {
    console.log(`   ✓ Generated & saved passwords for ${fixed} parent(s) with none`);
  }
  return fixed;
};

// Gentle throttle between creates to avoid tripping Firebase's per-IP signup
// rate limit. Override with THROTTLE_MS env if needed.
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 250);
// Waits (ms) to retry after an auth/too-many-requests response.
const RATE_LIMIT_BACKOFFS = [5000, 15000, 30000, 60000];

// Create one Auth account.
// Returns 'created' | 'skipped' | 'failed' | 'ratelimited' (retries exhausted).
const createAccount = async (auth, id, password, label) => {
  if (!id) {
    console.warn(`\n   ⚠️  ${label} record has no id — skipping.`);
    return 'failed';
  }
  const pass = String(password || '').trim();
  if (pass.length < 6) {
    console.warn(
      `\n   ⚠️  ${id}: missing/short password (needs ≥6 chars) — skipping.`,
    );
    return 'failed';
  }
  let attempt = 0;
  for (;;) {
    try {
      await createUserWithEmailAndPassword(auth, emailFor(id), pass);
      return 'created';
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') return 'skipped';
      if (e.code === 'auth/too-many-requests') {
        if (attempt >= RATE_LIMIT_BACKOFFS.length) return 'ratelimited';
        const wait = RATE_LIMIT_BACKOFFS[attempt++];
        process.stdout.write(
          `\n   ⏳ Rate limited — waiting ${wait / 1000}s, then retrying ${id}…\n`,
        );
        await sleep(wait);
        continue;
      }
      console.warn(`\n   ⚠️  ${id}: ${e.code || e.message}`);
      return 'failed';
    }
  }
};

// Walk a list of docs, creating accounts and printing a live "x/total" counter.
// Stops early (rateLimited) if the rate limit persists past all retries.
const processGroup = async (auth, docs, emoji, label) => {
  const total = docs.length;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let done = 0;
  let rateLimited = false;

  for (const data of docs) {
    const result = await createAccount(auth, data.id, data.password, label);
    if (result === 'ratelimited') {
      rateLimited = true;
      break;
    }
    if (result === 'created') created++;
    else if (result === 'skipped') skipped++;
    else failed++;
    done++;
    process.stdout.write(`\r${emoji} ${label}: ${done}/${total}   `);
    if (created > 0 && THROTTLE_MS > 0) await sleep(THROTTLE_MS);
  }
  process.stdout.write('\n');
  console.log(
    `   └─ created ${created}, skipped ${skipped} (already existed), failed ${failed}`,
  );
  return {created, skipped, failed, total, rateLimited};
};

// Cleanly shut Firebase down so Node's event loop can drain on its own.
// (Abruptly calling process.exit() while Firebase's async handles are still
// closing triggers a libuv assertion crash on Windows.)
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
  console.log(`🔐 Creating Auth accounts for ${SCHOOL_CODE}`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // 1) Sign in as the school admin. If the admin Auth account doesn't exist
    //    yet (fresh school with only Firestore docs), create it on the fly with
    //    ADMIN_PASSWORD — createUserWithEmailAndPassword also signs us in, which
    //    is exactly what we need to read the data below.
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log(`   ✓ Signed in as ${ADMIN_EMAIL}`);
    } catch (e) {
      const missing =
        e.code === 'auth/invalid-credential' ||
        e.code === 'auth/user-not-found';
      if (!missing) {
        console.error(`❌ Admin sign-in failed: ${e.code || e.message}`);
        process.exitCode = 1;
        return;
      }
      console.log(
        `   • ${ADMIN_EMAIL} can't sign in — creating the admin account…`,
      );
      try {
        await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log(`   ✓ Created admin account & signed in as ${ADMIN_EMAIL}`);
      } catch (e2) {
        if (e2.code === 'auth/email-already-in-use') {
          console.error(
            `❌ ${ADMIN_EMAIL} already exists but the password is wrong.\n` +
              '   The admin account is there — re-run with the correct ADMIN_PASSWORD.',
          );
        } else {
          console.error(
            `❌ Could not create admin account: ${e2.code || e2.message}`,
          );
        }
        process.exitCode = 1;
        return;
      }
    }

    // 2) Read ALL docs up front, while the admin session is still active.
    //    (createUserWithEmailAndPassword below will switch the active user.)
    const base = `schools/${SCHOOL_CODE}`;
    const [teacherSnap, studentSnap, parentSnap] = await Promise.all([
      getDocs(collection(db, `${base}/teachers`)),
      getDocs(collection(db, `${base}/students`)),
      getDocs(collection(db, `${base}/parents`)),
    ]);

    const teachers = teacherSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const students = studentSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const parents = parentSnap.docs.map(d => ({id: d.id, ...d.data()}));
    console.log(
      `   ✓ Fetched ${teachers.length} teachers, ${students.length} students, ${parents.length} parents`,
    );

    // 2b) Backfill any missing parent passwords (write requires admin session).
    await backfillParentPasswords(db, base, parents);
    console.log('');

    // 3) Create accounts (reads are done, so session churn no longer matters).
    const t = await processGroup(auth, teachers, '👨‍🏫', 'Teachers');
    const s = await processGroup(auth, students, '🎓', 'Students');
    const p = await processGroup(auth, parents, '👨‍👩‍👧', 'Parents');

    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }

    const totalCreated = t.created + s.created + p.created;
    const totalSkipped = t.skipped + s.skipped + p.skipped;
    const totalFailed = t.failed + s.failed + p.failed;
    const rateLimited = t.rateLimited || s.rateLimited || p.rateLimited;

    if (rateLimited) {
      console.log(
        `\n⏸️  Stopped early — Firebase signup rate limit still active for this IP.` +
          `\n   Created ${totalCreated} so far (skipped ${totalSkipped}). ` +
          `Wait ~1 hour and re-run the SAME command;` +
          `\n   already-created accounts are skipped, so only the rest get made.`,
      );
      process.exitCode = 3;
    } else {
      console.log(
        `\n✅ All done! ${SCHOOL_CODE} accounts ready. ` +
          `(created ${totalCreated}, skipped ${totalSkipped}, failed ${totalFailed})`,
      );
      process.exitCode = totalFailed > 0 ? 2 : 0;
    }
  } finally {
    await shutdown(app, db);
  }
};

main().catch(e => {
  console.error('❌ Unexpected error:', e);
  process.exitCode = 1;
});
