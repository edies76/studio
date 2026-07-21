# Docs Studio — plan de demo

## Objetivo

Mostrar que Docs Studio convierte una guía imperfecta en un documento revisable y exportable. El protagonista no es el chat ni el proveedor del modelo: es el documento, el contexto y la decisión humana sobre cada cambio.

Lenguaje público obligatorio: **el agente**. No mencionar proveedores, modelos, APIs internas ni claves.

## Duración y formato

- Versión principal: 75–90 segundos, 1920×1080, 30 fps, H.264.
- Versión social: 35–45 segundos, 1080×1920, 30 fps.
- Exportar también una versión limpia sin voz, con subtítulos quemados y otra con subtítulos separados si hace falta.

## Historia recomendada

Caso: un estudiante recibe una guía para un taller de eliminación gaussiana, con tareas, restricciones, normas APA y una rúbrica. Necesita convertirla en un documento claro, estructurado y entregable.

1. **Requisito** — La guía y la rúbrica entran primero.
2. **Estructura** — El workspace conserva tareas, restricciones y formato solicitado.
3. **Borrador** — El agente transforma el encargo en un documento sobre el lienzo.
4. **Trabajo real** — El lienzo muestra títulos, pasos, ecuación y conclusión; no es una transcripción de chat.
5. **Revisión** — El agente propone una mejora visible; el usuario compara antes/después.
6. **Decisión** — El usuario acepta el cambio.
7. **Entrega** — El archivo sale como PDF o DOCX.

## Storyboard de la versión principal

| Tiempo | Imagen | Texto en pantalla / narración |
|---|---|---|
| 00–04 s | Landing / título | “Una guía no es un documento.” |
| 04–14 s | Brief intake con guía y rúbrica | “El requisito entra primero.” |
| 14–23 s | Resumen de tareas, restricciones y formato | “El encargo se convierte en contexto de trabajo.” |
| 23–37 s | Prompt breve; borrador apareciendo en el canvas | “El agente propone una estructura inicial.” |
| 37–49 s | Paneo por documento: headings, pasos, ecuación | “El trabajo vive en un lienzo paginado.” |
| 49–63 s | Solicitar una mejora concreta | “Pide un cambio específico, no una respuesta genérica.” |
| 63–75 s | Tarjeta de propuesta / diff | “Revisa qué cambia antes de aplicarlo.” |
| 75–82 s | Accept | “Tú decides qué entra al documento.” |
| 82–95 s | Export menu + PDF/DOCX + end card | “Del brief al archivo, con la guía todavía presente.” |

## Guion de voz sugerido

> Una guía no es todavía un documento.
>
> En Docs Studio, el requisito entra primero: una consigna, una rúbrica, unas restricciones y el formato de entrega.
>
> El workspace convierte ese encargo en contexto de trabajo. Así el agente puede proponer un borrador con estructura, pasos, tablas y ecuaciones visibles.
>
> Después puedes pedir un cambio concreto. La propuesta aparece junto al documento para que veas qué se modifica.
>
> Nada entra a ciegas: aceptas, rechazas o ajustas la propuesta.
>
> Cuando el documento está listo, lo exportas como PDF o DOCX.
>
> Docs Studio: del brief al archivo, con la guía presente y la decisión siempre en tus manos.

## Clips que necesitamos grabar

Grabar cada clip por separado, con 3 segundos quietos al principio y al final. No hace falta narrar durante la captura.

### Obligatorios

1. `01-landing-to-brief.mp4` — abrir Docs Studio y entrar al intake de brief.
2. `02-brief-context.mp4` — pegar/cargar la guía completa con rúbrica.
3. `03-brief-parsed.mp4` — mostrar tareas, restricciones, formato y rúbrica extraídos.
4. `04-agent-draft.mp4` — enviar el prompt y dejar que aparezca el borrador completo.
5. `05-canvas-tour.mp4` — recorrer el canvas mostrando estructura, pasos y ecuación.
6. `06-request-edit.mp4` — pedir una mejora concreta sobre una sección.
7. `07-review-proposal.mp4` — mostrar la propuesta/diff sin mover el cursor demasiado rápido.
8. `08-accept-edit.mp4` — aceptar el cambio y dejar visible el resultado.
9. `09-export.mp4` — abrir Export y mostrar PDF/DOCX; si la descarga ocurre demasiado rápido, grabar también el menú abierto.

### Opcionales

- Importar un DOCX real.
- Insertar o editar una ecuación.
- Mostrar una tabla editable.
- Abrir historial de cambios.
- Aplicar una norma de formato.
- Mostrar la vista MCP únicamente en una versión técnica, no en el demo principal.

## Cómo grabar

- Resolución: 1920×1080.
- Zoom del navegador: 100%.
- Ocultar DevTools, pestañas personales, notificaciones y datos privados.
- Usar una ventana limpia y maximizada.
- Cursor visible, movimiento lento y deliberado.
- No hacer scroll durante una acción importante; dejar que cada estado permanezca 2–4 segundos.
- Usar texto realista y breve. Evitar “pruebas” como `linea linea`.
- Mantener el idioma del producto y del prompt en español.
- Grabar una toma limpia por acción; los errores se descartan, no se corrigen durante la misma toma.

## Material que debe acompañar los clips

- Logo o marca en SVG/PNG, si existe.
- Colores y tipografías de marca, si deben respetarse.
- Voz en WAV o MP3, idealmente 48 kHz.
- Música con permiso de uso, si la tienes; si no, dejar una versión sin música.
- Texto final exacto y URL que debe aparecer.
- Preferencia de tono: académico, producto SaaS, técnico o institucional.

## Audio preparado

El proyecto Remotion incluye un generador local para ElevenLabs. Generará una voz masculina de narrador técnico en español, una cama musical de 90 segundos y seis efectos: transición, activación del agente, foco del canvas, propuesta, aceptación y exportación. La mezcla se hará con la voz al frente, música baja y efectos puntuales, sin tapar el texto de la narración.

No hace falta que grabes audio. Solo configura `ELEVENLABS_API_KEY` en `studio/.env.local` y ejecuta `npm run audio` desde `studio/video-demo`.

## Edición en Remotion

La composición tendrá una pista principal de video, una pista de voz, música opcional y overlays calculados por frame. Los overlays incluirán:

- títulos de sección;
- subtítulos sincronizados;
- zoom y recorte de zonas del canvas;
- resaltado del cursor y clics;
- tarjetas breves “Contexto”, “Propuesta”, “Revisión” y “Exportar”;
- end card con Docs Studio.

Se prepararán dos composiciones a partir de los mismos clips: `DocsStudioDemo16x9` y `DocsStudioDemo9x16`.

## Criterios de calidad

- El espectador entiende el flujo sin leer cada palabra de la interfaz.
- Se ve al menos una propuesta antes de aceptarla.
- El canvas ocupa más espacio visual que el chat.
- No se afirma que el agente “hace todo” ni que reemplaza Word.
- No aparece el nombre de ningún proveedor de IA.
- El resultado final muestra claramente el archivo exportable.
