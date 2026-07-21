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
      <h3>${index + 1}. ${escapeHtml(task.title)}</h3>
      <p><strong>${isEs ? 'Consigna:' : 'Task:'}</strong> ${escapeHtml(task.description || task.title)}</p>
      <p><em>${isEs ? 'Escribe aquí tu desarrollo y evidencia.' : 'Write your development and evidence here.'}</em></p>
      <p><br></p>`).join('')
    : `<h2>${isEs ? 'Desarrollo' : 'Development'}</h2><p><em>${isEs ? 'Descompón la consigna en argumentos, evidencia y decisiones antes de redactar.' : 'Break the assignment into arguments, evidence, and decisions before drafting.'}</em></p><p><br></p>`;
  const rubricItems = brief.rubric.length
    ? brief.rubric.map((criterion) => `<li>${escapeHtml(criterion.name)}${criterion.weightPercent ? ` (${criterion.weightPercent}%)` : ''}</li>`).join('')
    : `<li>${isEs ? 'Relaciona cada requisito con una parte del documento.' : 'Map each requirement to a document section.'}</li>`;

  return `<h1>${escapeHtml(brief.title || (isEs ? 'Guía de trabajo' : 'Working guide'))}</h1>
<p><strong>${isEs ? 'Estructura inicial' : 'Initial structure'}</strong>. ${isEs ? 'La consigna queda guardada aquí. Completa el razonamiento y las fuentes con tu propio trabajo.' : 'The assignment stays here. Complete the reasoning and sources with your own work.'}</p>
<h2>${isEs ? 'Qué pide' : 'What it asks for'}</h2>
<p>${escapeHtml(brief.instructions || (isEs ? 'Revisa la consigna original antes de comenzar.' : 'Review the original assignment before starting.'))}</p>
<ul>${list(brief.objectives, isEs ? 'Identifica el objetivo principal.' : 'Identify the main objective.')}</ul>
<h2>${isEs ? 'Plan breve' : 'Short plan'}</h2>
<ol>
  <li>${isEs ? 'Marca cada entregable.' : 'Mark each deliverable.'}</li>
  <li>${isEs ? 'Reúne evidencia y fuentes reales.' : 'Gather real evidence and sources.'}</li>
  <li>${isEs ? 'Escribe tu enfoque antes de desarrollar.' : 'Write your approach before developing it.'}</li>
</ol>
<h2>${isEs ? 'Desarrollo' : 'Development'}</h2>${taskBlocks}
<h2>${isEs ? 'Criterios' : 'Criteria'}</h2>
<ul>${rubricItems}</ul>
<h2>${isEs ? 'Antes de entregar' : 'Before submitting'}</h2>
<ul>
  <li>${isEs ? 'Respondí cada tarea obligatoria.' : 'I addressed every required task.'}</li>
  <li>${isEs ? 'Mis fuentes, datos y citas son reales.' : 'My sources, data, and citations are real.'}</li>
  <li>${isEs ? 'Revisé formato y extensión.' : 'I checked format and length.'}</li>
</ul>`;
}
