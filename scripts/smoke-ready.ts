import { config } from 'dotenv';
config({ path: '.env.local' });
config();

async function main() {
  const ok = (msg: string) => console.log(`PASS ${msg}`);
  const fail = (msg: string) => {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  };

  const key = process.env.GOOGLE_API_KEY;
  if (!key) fail('GOOGLE_API_KEY missing in .env.local');
  ok(`ENV key present (${key!.slice(0, 6)}…)`);

  // Pure libs (no server-only)
  const { gaussianElimination, GAUSS_TALLER_SYSTEMS, buildSolvedContextHtml } = await import(
    '../src/lib/gauss-solver'
  );
  const s1 = gaussianElimination(GAUSS_TALLER_SYSTEMS[0].A, GAUSS_TALLER_SYSTEMS[0].b);
  if (s1.kind !== 'unique' || !s1.solution) fail(`Gauss s1 unexpected: ${s1.kind}`);
  ok(`Gauss s1 unique [${s1.solution.map((x) => x.toFixed(2)).join(', ')}]`);

  const s2 = gaussianElimination(GAUSS_TALLER_SYSTEMS[1].A, GAUSS_TALLER_SYSTEMS[1].b);
  const s3 = gaussianElimination(GAUSS_TALLER_SYSTEMS[2].A, GAUSS_TALLER_SYSTEMS[2].b);
  ok(`Gauss s2=${s2.kind} s3=${s3.kind}`);

  const solvedHtml = buildSolvedContextHtml();
  if (solvedHtml.length < 200) fail('Solved context HTML too short');
  ok(`Solved context HTML ${solvedHtml.length} chars`);

  const { buildGaussTallerBrief } = await import('../src/lib/gauss-taller-brief');
  const brief = buildGaussTallerBrief();
  if (brief.tasks.length < 5 || brief.rubric.length < 5) fail('Brief incomplete');
  ok(`Brief "${brief.title}" tasks=${brief.tasks.length} rubric=${brief.rubric.length}`);

  // Direct Gemini REST (same key the app uses)
  const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.0-flash'];
  let aiOk = false;
  let used = '';
  let lastErr = '';
  for (const m of models) {
    try {
      const t0 = Date.now();
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with exactly: Studio ready' }] }],
            generationConfig: { maxOutputTokens: 32 },
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        lastErr = `${m}: ${res.status} ${JSON.stringify(body).slice(0, 120)}`;
        continue;
      }
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        lastErr = `${m}: empty`;
        continue;
      }
      used = m;
      ok(`Gemini REST ${m} in ${Date.now() - t0}ms → ${String(text).slice(0, 40)}`);
      aiOk = true;
      break;
    } catch (e: any) {
      lastErr = `${m}: ${e?.message || e}`;
    }
  }
  if (!aiOk) fail(`No Gemini model available. Last: ${lastErr}`);

  console.log(`\nLOCAL CHECKS PASSED (AI model usable: ${used})`);
  console.log('Next: start Next.js and hit /api/health?deep=1 for Genkit path.');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
