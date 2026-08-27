// ── SET THE EAS PROJECT ID ──
// The EAS project ID has to appear in two files that are read by two different
// things, and updating only one of them fails in a way that is annoying to
// debug (publishing works, devices never receive anything):
//
//   app.json                      -> read by the `eas` CLI when you publish
//   android/.../AndroidManifest.xml -> read by the app at runtime to know where
//                                      to fetch updates from
//
// Normally EAS Build injects the manifest value for you; this project builds
// locally with ./gradlew, so it is set by hand. This script sets both at once.
//
// Usage:  node scripts/setEasProjectId.mjs <project-id>
// Get the id from `eas init` (or `eas project:info`).

import {readFileSync, writeFileSync} from 'node:fs';

const projectId = process.argv[2];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!projectId || !UUID.test(projectId)) {
  console.error('Usage: node scripts/setEasProjectId.mjs <project-id>');
  console.error('The project ID is a UUID, e.g. 3f1c9a20-....-....-............');
  process.exit(1);
}

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const APP_JSON = 'app.json';

// Matches both the placeholder and a previously-set UUID, so this is re-runnable.
const idPattern = /YOUR_PROJECT_ID|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

let changed = 0;

for (const file of [APP_JSON, MANIFEST]) {
  const before = readFileSync(file, 'utf8');
  // Only touch the u.expo.dev URL and the extra.eas.projectId value, never any
  // other UUID that might live in these files.
  const after = before
    .replace(/(https:\/\/u\.expo\.dev\/)(YOUR_PROJECT_ID|[0-9a-f-]{36})/gi, `$1${projectId}`)
    .replace(/("projectId":\s*")(YOUR_PROJECT_ID|[0-9a-f-]{36})(")/gi, `$1${projectId}$3`);

  if (after !== before) {
    writeFileSync(file, after);
    console.log(`✅ updated ${file}`);
    changed++;
  } else {
    console.log(`⚠️  no placeholder found in ${file} — check it by hand`);
  }
}

if (changed === 2) {
  console.log('\nBoth files set. Rebuild the app (./gradlew bundleRelease) so the');
  console.log('new update URL is baked into the binary, then publish with:');
  console.log('  eas update --branch production --message "..."');
}
