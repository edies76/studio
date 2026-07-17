/**
 * Exact-ish Gaussian elimination helpers for linear algebra talleres.
 * Used to ground document generation (no hallucinated solutions).
 */

export type LinearSystem = {
  id: string;
  name: string;
  A: number[][];
  b: number[];
  display: string[];
};

/** The three systems from colgii17_t2_tra (Álgebra Lineal — Eliminación gaussiana). */
export const GAUSS_TALLER_SYSTEMS: LinearSystem[] = [
  {
    id: 's1',
    name: 'Sistema de ecuaciones 1',
    A: [
      [2, -1, 3],
      [4, 0, -2],
      [1, 3, -1],
    ],
    b: [16, -4, -9],
    display: [
      '2x₁ − x₂ + 3x₃ = 16',
      '4x₁ − 2x₃ = −4',
      'x₁ + 3x₂ − x₃ = −9',
    ],
  },
  {
    id: 's2',
    name: 'Sistema de ecuaciones 2',
    A: [
      [1, 5, -1],
      [2, -1, 3],
      [3, 4, 2],
    ],
    b: [7, 10, 4],
    display: [
      'x₁ + 5x₂ − x₃ = 7',
      '2x₁ − x₂ + 3x₃ = 10',
      '3x₁ + 4x₂ + 2x₃ = 4',
    ],
  },
  {
    id: 's3',
    name: 'Sistema de ecuaciones 3',
    A: [
      [-2, 3, 1],
      [2, 1, -3],
      [4, -2, -4],
    ],
    b: [5, 12, 7],
    display: [
      '−2x₁ + 3x₂ + x₃ = 5',
      '2x₁ + x₂ − 3x₃ = 12',
      '4x₁ − 2x₂ − 4x₃ = 7',
    ],
  },
];

function cloneMatrix(M: number[][]): number[][] {
  return M.map((row) => [...row]);
}

export type GaussStep = { title: string; matrix: number[][]; note?: string };

export type SystemKind = 'unique' | 'none' | 'infinite';

export function gaussianElimination(A: number[][], b: number[]): {
  steps: GaussStep[];
  solution: number[] | null;
  singular: boolean;
  kind: SystemKind;
  analysis: string;
} {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const steps: GaussStep[] = [
    { title: 'Matriz aumentada inicial [A|b]', matrix: cloneMatrix(M) },
  ];

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) {
      // skip zero column — continue reduction on remaining
      continue;
    }
    if (pivot !== col) {
      [M[col], M[pivot]] = [M[pivot], M[col]];
      steps.push({
        title: `Intercambio R${col + 1} ↔ R${pivot + 1}`,
        matrix: cloneMatrix(M),
      });
    }
    const piv = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= piv;
    steps.push({
      title: `Normalizar R${col + 1} (dividir por pivote ${piv.toFixed(4)})`,
      matrix: cloneMatrix(M),
    });

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
      steps.push({
        title: `R${r + 1} ← R${r + 1} − (${factor.toFixed(4)})·R${col + 1}`,
        matrix: cloneMatrix(M),
      });
    }
  }

  // Classify: unique / none / infinite
  let rankA = 0;
  let rankAug = 0;
  for (let i = 0; i < n; i++) {
    const rowHasA = M[i].slice(0, n).some((v) => Math.abs(v) > 1e-9);
    const rowHasAug = M[i].some((v) => Math.abs(v) > 1e-9);
    if (rowHasA) rankA++;
    if (rowHasAug) rankAug++;
    // inconsistency: 0 0 0 | c
    const allZeroA = M[i].slice(0, n).every((v) => Math.abs(v) < 1e-9);
    if (allZeroA && Math.abs(M[i][n]) > 1e-9) {
      const analysis =
        'Sistema incompatible: aparece una fila [0 … 0 | c] con c≠0. No hay solución (planos sin intersección común).';
      steps.push({ title: 'Diagnóstico', matrix: cloneMatrix(M), note: analysis });
      return { steps, solution: null, singular: true, kind: 'none', analysis };
    }
  }

  if (rankA < n) {
    const analysis =
      'Sistema con infinitas soluciones (o dependiente): rank(A) < n y rank([A|b]) = rank(A). Los planos no determinan un único punto.';
    steps.push({ title: 'Diagnóstico', matrix: cloneMatrix(M), note: analysis });
    return { steps, solution: null, singular: true, kind: 'infinite', analysis };
  }

  const solution = M.map((row) => row[n]);
  const analysis = `Solución única: x₁=${solution[0].toFixed(6)}, x₂=${solution[1].toFixed(6)}, x₃=${solution[2].toFixed(6)}. Los tres planos se intersectan en un punto.`;
  steps.push({
    title: 'Forma reducida (Gauss-Jordan) → solución única',
    matrix: cloneMatrix(M),
    note: analysis,
  });
  return { steps, solution, singular: false, kind: 'unique', analysis };
}

export function solveNumpyStyle(A: number[][], b: number[]): number[] | null {
  // Same as Gaussian for n=3; used as "numpy.linalg.solve" reference
  return gaussianElimination(A, b).solution;
}

export function matrixToHtml(M: number[][], decimals = 4): string {
  const rows = M.map(
    (row) =>
      `<tr>${row.map((v) => `<td style="padding:2px 8px;border:1px solid #ccc;text-align:right">${Number.isFinite(v) ? v.toFixed(decimals) : v}</td>`).join('')}</tr>`,
  ).join('');
  return `<table style="border-collapse:collapse;margin:0.5rem 0;font-family:ui-monospace,monospace;font-size:0.9em"><tbody>${rows}</tbody></table>`;
}

export function buildSolvedContextHtml(): string {
  const parts: string[] = [
    '<section><h2>Datos resueltos (verificados por Studio)</h2>',
    '<p>Las soluciones siguientes fueron calculadas por el motor algebraico de Studio (eliminación gaussiana). Úsalas como verdad de referencia al redactar.</p>',
  ];

  for (const sys of GAUSS_TALLER_SYSTEMS) {
    const { steps, solution, singular, kind, analysis } = gaussianElimination(sys.A, sys.b);
    parts.push(`<h3>${sys.name}</h3>`);
    parts.push('<p><strong>Ecuaciones:</strong></p><ul>');
    if (sys.id === 's1') {
      parts.push('<li>\\(2x_1 - x_2 + 3x_3 = 16\\)</li>');
      parts.push('<li>\\(4x_1 - 2x_3 = -4\\)</li>');
      parts.push('<li>\\(x_1 + 3x_2 - x_3 = -9\\)</li>');
    } else if (sys.id === 's2') {
      parts.push('<li>\\(x_1 + 5x_2 - x_3 = 7\\)</li>');
      parts.push('<li>\\(2x_1 - x_2 + 3x_3 = 10\\)</li>');
      parts.push('<li>\\(3x_1 + 4x_2 + 2x_3 = 4\\)</li>');
    } else {
      parts.push('<li>\\(-2x_1 + 3x_2 + x_3 = 5\\)</li>');
      parts.push('<li>\\(2x_1 + x_2 - 3x_3 = 12\\)</li>');
      parts.push('<li>\\(4x_1 - 2x_2 - 4x_3 = 7\\)</li>');
    }
    parts.push('</ul>');
    parts.push(`<p><strong>Diagnóstico algebraico:</strong> ${analysis} <em>(kind=${kind})</em></p>`);

    if (singular || !solution) {
      parts.push(
        `<p><strong>numpy.linalg.solve:</strong> lanzará <code>LinAlgError</code> porque la matriz es singular (det(A)=0). Documenta el error y contrástalo con el análisis de Gauss.</p>`,
      );
    } else {
      parts.push(
        `<p><strong>Solución (Gauss = numpy.linalg.solve):</strong> \\(x_1=${solution[0].toFixed(6)},\\; x_2=${solution[1].toFixed(6)},\\; x_3=${solution[2].toFixed(6)}\\)</p>`,
      );
    }

    parts.push('<p><strong>Pasos clave de eliminación (matrices aumentadas):</strong></p>');
    // Only first, middle-ish, last to keep context smaller
    const keySteps = [steps[0], steps[Math.floor(steps.length / 2)], steps[steps.length - 1]].filter(Boolean);
    for (const st of keySteps) {
      parts.push(`<p>${st.title}</p>${matrixToHtml(st.matrix)}`);
      if (st.note) parts.push(`<p><em>${st.note}</em></p>`);
    }

    parts.push(`<pre><code class="language-python">import numpy as np
A = np.array(${JSON.stringify(sys.A)}, dtype=float)
b = np.array(${JSON.stringify(sys.b)}, dtype=float)
x = np.linalg.solve(A, b)
print(x)
# Gráfica 3D de planos (matplotlib):
# from mpl_toolkits.mplot3d import Axes3D
# import matplotlib.pyplot as plt
# ... generar malla y plot_surface para cada plano a1*x+a2*y+a3*z=b
</code></pre>`);
  }

  parts.push('</section>');
  return parts.join('\n');
}

export const GAUSS_TALLER_RAW = `Trabajo: Eliminación gaussiana
Curso: Álgebra Lineal

Objetivos:
- Aplicar conceptos de solución de sistemas de ecuaciones lineales (temas 1 y 2).
- Usar Python para cálculos, gráficas 3D y operaciones con matrices.

Pautas: Entrega ÚNICAMENTE en PDF. Extensión máxima: 10 páginas. Normas APA y referencias.

Sistema 1:
2x1 - x2 + 3x3 = 16
4x1 - 2x3 = -4
x1 + 3x2 - x3 = -9
Para cada sistema: (a) graficar 3 planos y comentar la solución; (b) Gauss paso a paso; (c) numpy.linalg.solve y comparar.

Sistema 2:
x1 + 5x2 - x3 = 7
2x1 - x2 + 3x3 = 10
3x1 + 4x2 + 2x3 = 4

Sistema 3:
-2x1 + 3x2 + x3 = 5
2x1 + x2 - 3x3 = 12
4x1 - 2x2 - 4x3 = 7

Conclusiones: 2 o 3 conclusiones (conceptos, problemas, uso de Python).

Rúbrica:
- Integración de conocimientos [40%] — análisis completo álgebra lineal
- Representación gráfica y analítica [20%] — gráficos y análisis congruentes
- Conclusiones [10%]
- Uso de herramientas [10%] — editores de ecuaciones, graficadores, Python
- Presentación APA + PDF + referencias [20%]

Resultado de aprendizaje: Explicar modelos matemáticos a partir de espacios vectoriales y resolución de sistemas lineales.
`;
