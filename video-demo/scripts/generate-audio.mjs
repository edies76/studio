import { mkdir, writeFile } from 'node:fs/promises';

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  throw new Error('Falta ELEVENLABS_API_KEY. Configúrala en C:\\Nueva-carpeta\\studio\\.env.local y vuelve a ejecutar npm run audio.');
}

const root = new URL('../public/audio/', import.meta.url);
const out = (...parts) => new URL(parts.join('/'), root);
const headers = { 'xi-api-key': key, 'Content-Type': 'application/json' };
const voiceId = process.env.ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV';
const language = process.env.DEMO_LANGUAGE === 'es' ? 'es' : 'en';

const narrations = {
  en: `Most AI work ends in a chat. But a student still has to turn a brief, a rubric, and a pile of instructions into a document they can actually submit.

I built Docs Studio for that moment.

First, the assignment enters as context: the brief, requirements, formatting rules, and rubric.

Then the agent turns that context into a structured draft on a real paginated canvas, not another chat transcript.

You can inspect the document, work with equations, tables, and sections, and request a specific improvement exactly where it matters.

Before anything changes, Docs Studio shows a proposal. You see what will be added, removed, or rewritten, and you choose whether to accept or reject it.

The requirement stays connected to the document from the first brief to the final revision.

When it is ready, export a PDF or DOCX without rebuilding the file somewhere else.

Docs Studio is not trying to replace Word. It makes the work before submission clearer: from brief, to reviewable document, to deliverable file.`,
  es: `Mucho trabajo con IA termina en un chat. Pero un estudiante todavía tiene que convertir una guía, una rúbrica y muchas instrucciones en un documento que realmente pueda entregar.

Por eso construí Docs Studio.

Primero entra el encargo como contexto: la guía, los requisitos, las normas de formato y la rúbrica.

Después, el agente transforma ese contexto en un borrador estructurado sobre un lienzo paginado real, no en otra transcripción de chat.

Puedes revisar el documento, trabajar con ecuaciones, tablas y secciones, y pedir una mejora concreta justo donde hace falta.

Antes de cambiar algo, Docs Studio muestra una propuesta. Ves qué se agrega, qué se elimina o qué se reescribe, y decides si aceptarla o rechazarla.

El requisito sigue conectado al documento desde el primer brief hasta la revisión final.

Cuando está listo, exportas PDF o DOCX sin reconstruir el archivo en otra herramienta.

Docs Studio no intenta reemplazar Word. Hace más claro el trabajo antes de entregar: del brief, al documento revisable, al archivo final.`,
};
const narration = narrations[language];

const effects = [
  ['sfx/transition-whoosh.mp3', 'soft editorial whoosh, short, clean, premium software product transition', 0.8],
  ['sfx/agent-start.mp3', 'subtle intelligent interface activation, tiny warm synth pulse, no futuristic cliché', 0.7],
  ['sfx/canvas-focus.mp3', 'gentle paper and interface focus sound, soft tap with a restrained airy tail', 0.7],
  ['sfx/proposal-pop.mp3', 'small elegant notification pop for a proposed document change, clean and understated', 0.7],
  ['sfx/accept-confirm.mp3', 'soft positive confirmation chime, warm single note, minimal and professional', 0.8],
  ['sfx/export-click.mp3', 'refined export confirmation sound, tiny click followed by a warm short chime', 0.8],
  ['music-bed.mp3', 'minimal warm documentary technology underscore, soft piano pulses and subtle analog texture, no melody competing with narration, seamless 90 second bed', 30],
];

async function save(url, bytes) {
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, Buffer.from(bytes));
}

async function tts() {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text: narration,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.58, similarity_boost: 0.78, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!response.ok) throw new Error(`TTS falló (${response.status}): ${await response.text()}`);
  const audio = await response.arrayBuffer();
  await save(out('voiceover.mp3'), audio);
  await save(out(`voiceover.${language}.mp3`), audio);
}

async function sound(name, prompt, duration) {
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: prompt, duration_seconds: duration, prompt_influence: 0.72 }),
  });
  if (!response.ok) throw new Error(`SFX ${name} falló (${response.status}): ${await response.text()}`);
  await save(out(name), await response.arrayBuffer());
}

await tts();
for (const [name, prompt, duration] of effects) await sound(name, prompt, duration);
console.log('Audio del demo generado en video-demo/public/audio/.');
