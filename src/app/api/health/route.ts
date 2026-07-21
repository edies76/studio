import { NextResponse } from 'next/server';
import { generateTextWithFallback } from '@/lib/ai-runtime';
import { buildGaussTallerBrief } from '@/lib/gauss-taller-brief';
import { gaussianElimination, GAUSS_TALLER_SYSTEMS } from '@/lib/gauss-solver';
import { storageBackend } from '@/lib/doc-store';
import { isAuthConfigured } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get('deep') === '1';

  const forceAuth = process.env.FORCE_AUTH === '1';
  const checks: Record<string, unknown> = {
    ok: true,
    hasApiKey: Boolean(process.env.FOUNDRY_GROK_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GOOGLE_API_KEY),
    // Keep provider identity out of the public health contract.
    providerConfigured: Boolean(process.env.FOUNDRY_GROK_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GOOGLE_API_KEY),
    storage: storageBackend(),
    authConfigured: isAuthConfigured(),
    /** Login is optional unless FORCE_AUTH=1 */
    forceAuth,
    guestAllowed: !forceAuth,
    authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL || null,
    docsTable: process.env.DOCS_TABLE || null,
    region: process.env.AWS_REGION || null,
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
