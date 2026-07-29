// AI Class Insight — the ✨ card on the Class Progress Report.
//
// Sends the class's headline numbers (never student names) to gpt-4o-mini and
// asks for two plain-English sentences a teacher can act on. The network call
// is best-effort: no key, no signal, a slow response or a malformed reply all
// fall through to localInsight(), which builds the same two sentences on-device
// from the same numbers. The card therefore always renders something useful.
//
// Callers are expected to cache the result per class+subject — see
// TeacherScreen's insightCache — so opening the report repeatedly costs nothing.

import {OPENAI_API_KEY} from '../config';

export type ClassInsightStats = {
  className: string;
  subject: string;
  average: number;
  highest: number;
  lowest: number;
  belowForty: number;
  studentCount: number;
  testsConducted: number;
  trend: 'improving' | 'declining' | 'steady';
};

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 12000;

// Two sentences, derived purely from the numbers. Also the fallback whenever
// the API is unavailable, so it has to read well on its own.
export function localInsight(s: ClassInsightStats): string {
  const spread = Math.max(0, s.highest - s.lowest);

  const first =
    s.average >= 75
      ? `${s.subject} is in good shape in ${s.className} — the class is averaging ${s.average}% across ${s.testsConducted} test(s), and results are ${s.trend}.`
      : s.average >= 50
      ? `${s.className} is averaging ${s.average}% in ${s.subject} over ${s.testsConducted} test(s), with results ${s.trend}.`
      : `${s.className} is struggling in ${s.subject} at a ${s.average}% average across ${s.testsConducted} test(s), and results are ${s.trend}.`;

  const second =
    s.belowForty > 0
      ? `${s.belowForty} of ${s.studentCount} student(s) are still below 40% — pull that group for a short revision session before the next test.`
      : spread >= 40
      ? `Scores run from ${s.lowest}% to ${s.highest}%, so the class is splitting into two groups — pair the stronger students with the weaker ones for practice work.`
      : s.trend === 'declining'
      ? `Nobody is below 40%, but the recent slide suggests the latest topic did not land — re-teach it before moving on.`
      : `Nobody is below 40% and the spread is tight, so the class can move on to harder practice questions together.`;

  return `${first} ${second}`;
}

function buildPrompt(s: ClassInsightStats): string {
  return [
    `Class: ${s.className}`,
    `Subject: ${s.subject}`,
    `Students with marks: ${s.studentCount}`,
    `Tests conducted: ${s.testsConducted}`,
    `Class average: ${s.average}%`,
    `Highest student average: ${s.highest}%`,
    `Lowest student average: ${s.lowest}%`,
    `Students below 40%: ${s.belowForty}`,
    `Overall trend: ${s.trend}`,
  ].join('\n');
}

export async function generateClassInsight(
  stats: ClassInsightStats,
): Promise<string> {
  if (!OPENAI_API_KEY) return localInsight(stats);

  // AbortController rather than a bare fetch: a hung request would otherwise
  // leave the card spinning for as long as the screen is open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 140,
        messages: [
          {
            role: 'system',
            content:
              'You advise school teachers. Given a class\'s test statistics, reply with exactly two sentences of plain English: the first states what the numbers show, the second gives one specific action the teacher can take this week. Be concrete and cite the numbers. No greetings, no bullet points, no markdown, no preamble.',
          },
          {role: 'user', content: buildPrompt(stats)},
        ],
      }),
    });

    if (!res.ok) return localInsight(stats);

    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content || '').trim();
    // A one-word or empty reply is worse than the deterministic fallback.
    return text.length >= 40 ? text : localInsight(stats);
  } catch (e) {
    console.log('❌ QUANTAIP AI Insight:', e);
    return localInsight(stats);
  } finally {
    clearTimeout(timer);
  }
}
