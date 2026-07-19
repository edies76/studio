import type { AssignmentBrief } from './assignment-types';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function list(items: string[], empty: string) {
  const values = items.filter(Boolean);
  if (!values.length) return `<li>${escapeHtml(empty)}</li>`;
  return values.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

/**
 * Turns an analysed assignment into a working outline, never a finished
 * answer. Keeping this deterministic makes opening a brief fast and leaves
 * the student's reasoning, research and writing visibly theirs.
 */
export function buildStudentScaffold(brief: AssignmentBrief): string {
  const isEs = brief.language !== 'en';
  const taskBlocks = brief.tasks.length
    ? brief.tasks.map((task, index) => `
      <h2>${index + 1}. ${escapeHtml(task.title)}</h2>
      <p><strong>${isEs ? 'Qué pide la guía:' : 'What the guide asks for:'}</strong> ${escapeHtml(task.description || task.title)}</p>
      <p><em>${isEs ? 'Escribe aquí tu enfoque, evidencia y desarrollo propio.' : 'Write your own approach, evidence, and development here.'}</em></p>
      <p><br></p>`).join('')
    : `<h2>${isEs ? 'Desarrollo' : 'Development'}</h2><p><em>${isEs ? 'Descompón la consigna en argumentos, evidencia y decisiones antes de redactar.' : 'Break the assignment into arguments, evidence, and decisions before drafting.'}</em></p><p><br></p>`;
  const rubricRows = brief.rubric.length
    ? brief.rubric.map((criterion) => `<tr><td>${escapeHtml(criterion.name)}</td><td>${criterion.weightPercent ? `${criterion.weightPercent}%` : '—'}</td><td>${isEs ? 'Anota qué evidencia propia mostrará este criterio.' : 'Note what evidence from your work will demonstrate this criterion.'}</td></tr>`).join('')
    : `<tr><td>${isEs ? 'Requisitos de la guía' : 'Assignment requirements'}</td><td>—</td><td>${isEs ? 'Relaciona cada requisito con una parte del documento.' : 'Map each requirement to a document section.'}</td></tr>`;

  return `<h1>${escapeHtml(brief.title || (isEs ? 'Guía de trabajo' : 'Working guide'))}</h1>
<p><strong>${isEs ? 'Documento de preparación' : 'Preparation document'}</strong> — ${isEs ? 'estructura creada a partir de la consigna. Completa el razonamiento y las fuentes con tu propio trabajo.' : 'structure created from the assignment. Complete the reasoning and sources with your own work.'}</p>
<hr>
<h2>${isEs ? 'Qué debes entregar' : 'What you need to deliver'}</h2>
<p>${escapeHtml(brief.instructions || (isEs ? 'Revisa la consigna original antes de comenzar.' : 'Review the original assignment before starting.'))}</p>
<h2>${isEs ? 'Objetivos y condiciones' : 'Objectives and conditions'}</h2>
<h3>${isEs ? 'Objetivos' : 'Objectives'}</h3>
<ul>${list(brief.objectives, isEs ? 'Identifica el objetivo principal directamente en la guía.' : 'Identify the main objective directly from the assignment.')}</ul>
<h3>${isEs ? 'Restricciones que no puedes perder' : 'Constraints not to lose'}</h3>
<ul>${list(brief.constraints, isEs ? 'Confirma extensión, formato, fecha y fuentes requeridas.' : 'Confirm length, format, due date, and required sources.')}</ul>
<h2>${isEs ? 'Plan antes de escribir' : 'Plan before writing'}</h2>
<ol>
  <li>${isEs ? 'Lee la consigna y marca cada entregable verificable.' : 'Read the assignment and mark every verifiable deliverable.'}</li>
  <li>${isEs ? 'Reúne evidencia, apuntes y fuentes permitidas; no inventes citas.' : 'Gather evidence, notes, and permitted sources; do not invent citations.'}</li>
  <li>${isEs ? 'Define una tesis, solución o postura propia antes de desarrollar.' : 'Define your own thesis, solution, or position before developing.'}</li>
  <li>${isEs ? 'Comprueba la tabla de criterios antes de entregar.' : 'Check the criteria table before submitting.'}</li>
</ol>
<h2>${isEs ? 'Estructura de trabajo' : 'Working structure'}</h2>${taskBlocks}
<h2>${isEs ? 'Evidencia por criterio' : 'Evidence by criterion'}</h2>
<table><thead><tr><th>${isEs ? 'Criterio' : 'Criterion'}</th><th>${isEs ? 'Peso' : 'Weight'}</th><th>${isEs ? 'Mi evidencia / revisión' : 'My evidence / review'}</th></tr></thead><tbody>${rubricRows}</tbody></table>
<h2>${isEs ? 'Checklist antes de entregar' : 'Before-submission checklist'}</h2>
<ul>
  <li>☐ ${isEs ? 'Respondí cada tarea obligatoria de la guía.' : 'I addressed every required task in the assignment.'}</li>
  <li>☐ ${isEs ? 'Mis fuentes, datos y citas son reales y verificables.' : 'My sources, data, and citations are real and verifiable.'}</li>
  <li>☐ ${isEs ? 'Revisé formato, extensión, nombres de archivo y fecha.' : 'I checked format, length, file naming, and due date.'}</li>
  <li>☐ ${isEs ? 'Puedo señalar la evidencia de cada criterio de la rúbrica.' : 'I can point to evidence for every rubric criterion.'}</li>
</ul>`;
}
