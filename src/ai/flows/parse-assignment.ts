'use server';

import { z } from 'genkit';
import { generateTextWithFallback } from '@/lib/ai-runtime';
import type { AssignmentBrief } from '@/lib/assignment-types';
import { buildGaussTallerBrief } from '@/lib/gauss-taller-brief';

const ParseInputSchema = z.object({
  text: z.string().min(20),
  fileName: z.string().optional(),
});

function tryParseJson(text: string): any {
  let raw = text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

export async function parseAssignment(input: {
  text: string;
  fileName?: string;
}): Promise<AssignmentBrief> {
  const parsed = ParseInputSchema.parse(input);
  const lower = parsed.text.toLowerCase();

  if (
    lower.includes('eliminación gaussiana') ||
    lower.includes('eliminacion gaussiana') ||
    lower.includes('numpy.linalg.solve') ||
    (lower.includes('gauss') && lower.includes('álgebra lineal')) ||
    lower.includes('colgii17')
  ) {
    return buildGaussTallerBrief(parsed.text);
  }

  const prompt = `Eres un parser de guías de taller universitario. Extrae un JSON estricto (sin markdown) con esta forma:
{
  "title": string,
  "course": string|null,
  "objectives": string[],
  "instructions": string,
  "tasks": [{"id": string, "title": string, "description": string, "required": boolean}],
  "constraints": string[],
  "learningOutcome": string|null,
  "rubric": [{"id": string, "name": string, "weightPercent": number, "levels": [{"label": string, "description": string, "scoreRange": string|null}]}],
  "language": "es"|"en"
}

Incluye TODAS las tareas calificables y la rúbrica con pesos si existen.
Texto del profe / archivo ${parsed.fileName || ''}:
---
${parsed.text.slice(0, 30000)}
---`;

  try {
    const { text } = await generateTextWithFallback({ prompt });
    const data = tryParseJson(text);
    return {
      title: data.title || 'Assignment',
      course: data.course || undefined,
      objectives: data.objectives || [],
      instructions: data.instructions || parsed.text.slice(0, 4000),
      tasks: (data.tasks || []).map((t: any, i: number) => ({
        id: t.id || `task-${i}`,
        title: t.title || `Task ${i + 1}`,
        description: t.description || '',
        required: t.required !== false,
      })),
      constraints: data.constraints || [],
      learningOutcome: data.learningOutcome || undefined,
      rubric: (data.rubric || []).map((r: any, i: number) => ({
        id: r.id || `crit-${i}`,
        name: r.name || `Criterion ${i + 1}`,
        weightPercent: Number(r.weightPercent) || 0,
        levels: r.levels || [],
      })),
      rawText: parsed.text,
      language: data.language === 'en' ? 'en' : 'es',
    };
  } catch {
    return {
      title: parsed.fileName || 'Assignment',
      objectives: [],
      instructions: parsed.text.slice(0, 8000),
      tasks: [
        {
          id: 'full',
          title: 'Complete the assignment',
          description: parsed.text.slice(0, 1500),
          required: true,
        },
      ],
      constraints: [],
      rubric: [
        {
          id: 'overall',
          name: 'Overall quality',
          weightPercent: 100,
          levels: [{ label: 'Complete', description: 'Meets requirements' }],
        },
      ],
      rawText: parsed.text,
      language: /[áéíóúñ¿¡]/.test(parsed.text) ? 'es' : 'en',
    };
  }
}
