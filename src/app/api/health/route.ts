import { NextResponse } from 'next/server';
import { generateTextWithFallback } from '@/lib/ai-runtime';
import { buildGaussTallerBrief } from '@/lib/gauss-taller-brief';
import { gaussianElimination, GAUSS_TALLER_SYSTEMS } from '@/lib/gauss-solver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get('deep') === '1';

  const checks: Record<string, unknown> = {
    ok: true,
    hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY || process.env.GOOGLE_API_KEY),
    provider: process.env.DEEPSEEK_API_KEY ? 'deepseek' : process.env.GOOGLE_API_KEY ? 'gemini' : 'none',
    timestamp: new Date().toISOString(),
  };

  try {
    const s1 = gaussianElimination(GAUSS_TALLER_SYSTEMS[0].A, GAUSS_TALLER_SYSTEMS[0].b);
    checks.gauss = { kind: s1.kind, solution: s1.solution };
    const brief = buildGaussTallerBrief();
    checks.brief = { title: brief.title, tasks: brief.tasks.length, rubric: brief.rubric.length };

    if (deep) {
      const t0 = Date.now();
      const { text, modelUsed } = await generateTextWithFallback({
        prompt: 'Reply with exactly: <p>ok</p>',
        maxAttemptsPerModel: 2,
      });
      checks.ai = {
        modelUsed,
        ms: Date.now() - t0,
        preview: text.slice(0, 80),
      };
    }
  } catch (e: any) {
    checks.ok = false;
    checks.error = e?.message || String(e);
    return NextResponse.json(checks, { status: 503 });
  }

  return NextResponse.json(checks);
}
