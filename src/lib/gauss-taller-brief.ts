import type { AssignmentBrief, RubricCriterion, AssignmentTask } from '@/lib/assignment-types';
import { GAUSS_TALLER_RAW, GAUSS_TALLER_SYSTEMS } from '@/lib/gauss-solver';

/** Deterministic brief for colgii17_t2_tra — Eliminación gaussiana. */
export function buildGaussTallerBrief(rawOverride?: string): AssignmentBrief {
  const raw = rawOverride || GAUSS_TALLER_RAW;
  const tasks: AssignmentTask[] = [];
  for (const sys of GAUSS_TALLER_SYSTEMS) {
    tasks.push(
      {
        id: `${sys.id}-graph`,
        title: `${sys.name}: gráfica 3D`,
        description:
          'Trazar las tres ecuaciones (planos) en el mismo sistema de coordenadas y explicar qué se afirma sobre la solución.',
        required: true,
      },
      {
        id: `${sys.id}-gauss`,
        title: `${sys.name}: método de Gauss`,
        description: 'Resolver paso a paso con eliminación gaussiana y registrar la solución.',
        required: true,
      },
      {
        id: `${sys.id}-numpy`,
        title: `${sys.name}: numpy.linalg.solve`,
        description: 'Obtener la solución con numpy.linalg.solve y comparar con Gauss.',
        required: true,
      },
    );
  }
  tasks.push({
    id: 'conclusions',
    title: 'Conclusiones',
    description: 'Dos o tres conclusiones sobre conceptos, problemas y uso de Python.',
    required: true,
  });
  tasks.push({
    id: 'apa-pdf',
    title: 'Presentación APA + PDF',
    description: 'Documento PDF, máximo 10 páginas, normas APA y referencias.',
    required: true,
  });

  const rubric: RubricCriterion[] = [
    {
      id: 'integration',
      name: 'Integración de conocimientos',
      weightPercent: 40,
      levels: [
        { label: 'Muy bien', description: 'Análisis completo e integración de álgebra lineal', scoreRange: '3.2–4.0' },
        { label: 'Se puede mejorar', description: 'Aborda situaciones pero omite detalle', scoreRange: '2.0–3.1' },
        { label: 'No se aplica', description: 'Sin detalle conceptual', scoreRange: '0–1.9' },
      ],
    },
    {
      id: 'graphics',
      name: 'Representación gráfica y analítica',
      weightPercent: 20,
      levels: [
        { label: 'Muy bien', description: 'Gráficos y análisis congruentes', scoreRange: '1.6–2.0' },
        { label: 'Se puede mejorar', description: 'Análisis mejorable', scoreRange: '1.0–1.5' },
        { label: 'No se aplica', description: 'Sin datos/gráficos', scoreRange: '0–0.9' },
      ],
    },
    {
      id: 'conclusions',
      name: 'Conclusiones',
      weightPercent: 10,
      levels: [
        { label: 'Muy bien', description: 'Conclusiones coherentes', scoreRange: '0.8–1.0' },
        { label: 'Se puede mejorar', description: 'Conclusiones parciales', scoreRange: '0.5–0.7' },
        { label: 'No se aplica', description: 'Sin conclusiones', scoreRange: '0–0.4' },
      ],
    },
    {
      id: 'tools',
      name: 'Uso de herramientas',
      weightPercent: 10,
      levels: [
        { label: 'Muy bien', description: 'Python, ecuaciones, graficadores', scoreRange: '0.8–1.0' },
        { label: 'Se puede mejorar', description: 'Uso limitado de herramientas', scoreRange: '0.5–0.7' },
        { label: 'No se aplica', description: 'No se reporta uso de herramientas', scoreRange: '0–0.4' },
      ],
    },
    {
      id: 'presentation',
      name: 'Presentación (PDF + APA + referencias)',
      weightPercent: 20,
      levels: [
        { label: 'Muy bien', description: 'PDF organizado, APA y referencias', scoreRange: '1.6–2.0' },
        { label: 'Se puede mejorar', description: 'PDF ok pero APA/referencias débiles', scoreRange: '1.0–1.5' },
        { label: 'No se aplica', description: 'No cumple pautas', scoreRange: '0–0.9' },
      ],
    },
  ];

  return {
    title: 'Trabajo: Eliminación gaussiana',
    course: 'Álgebra Lineal',
    objectives: [
      'Aplicar solución de sistemas de ecuaciones lineales (temas 1 y 2).',
      'Usar Python para cálculos, gráficas 3D y matrices.',
    ],
    instructions: raw,
    tasks,
    constraints: [
      'Entrega únicamente en formato PDF',
      'Extensión máxima: 10 páginas',
      'Normas APA',
      'Incluir referencias',
      'Tres sistemas: gráfica + Gauss + numpy.linalg.solve',
      '2–3 conclusiones',
    ],
    learningOutcome:
      'Explicar distintos modelos matemáticos a partir de la definición de espacios vectoriales y la resolución de sistemas de ecuaciones lineales.',
    rubric,
    rawText: raw,
    systems: GAUSS_TALLER_SYSTEMS.map((s) => s.display.join('; ')),
    language: 'es',
  };
}
