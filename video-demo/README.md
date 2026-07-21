# Docs Studio demo video

Proyecto Remotion para montar la demo a partir de clips de pantalla.

## Preparar los assets

Graba y guarda los clips en `C:\Users\ediva\Videos\Demodocss` con los nombres definidos en `../docs/demo/DEMO_PRODUCTION.md`. Luego impórtalos al proyecto:

```bash
npm run sync:clips
```

El importador copiará únicamente estos nombres esperados a `public/clips/`:

```text
public/
  clips/
    01-landing-to-brief.mp4
    02-brief-context.mp4
    03-brief-parsed.mp4
    04-agent-draft.mp4
    05-canvas-tour.mp4
    06-request-edit.mp4
    07-review-proposal.mp4
    08-accept-edit.mp4
    09-export.mp4
```

La voz y la música pueden ir en `public/audio/`. La composición solo muestra un placeholder hasta que cada clip exista.

## Uso

```bash
npm install
npm run audio        # narración principal en inglés; requiere ELEVENLABS_API_KEY en ../../.env.local
npm run audio:es     # alternativa en español
npm run studio
npm run render:landscape
npm run render:vertical
```

La voz seleccionada por defecto es masculina, cálida, clara y pausada, pensada para narración de producto en español. Si esa voz no está disponible en tu cuenta, define `ELEVENLABS_VOICE_ID` en `.env.local`; no hace falta cambiar el código.

El comando `npm run audio` genera la narración, una cama musical y seis efectos sincronizados: transición, activación del agente, foco del canvas, propuesta, aceptación y exportación.

El montaje está preparado para que la edición de tiempos, overlays, subtítulos y branding ocurra en código y pueda iterarse sin rehacer la captura.
