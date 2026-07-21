# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-07-19

## Product Overview

**One-liner:**
Docs Studio convierte un brief, una rúbrica, una plantilla o una guía en un documento revisable y exportable.

**What it does:**
Docs Studio mantiene el contexto del encargo junto al documento de trabajo. El agente puede leer la estructura, proponer borradores y preparar cambios específicos, pero cada cambio queda visible para que la persona lo acepte, lo rechace o lo ajuste antes de que pase al documento.

El resultado es un documento real en un canvas paginado, con texto, tablas, ecuaciones, imágenes y exportación a PDF/DOCX. La propuesta no es competir con Word o Google Docs como editores generales; es resolver el momento anterior a la entrega, cuando hay que transformar requisitos en un archivo que se pueda revisar.

**Product category:**
Workspace de documentos guiados por requisitos / brief-to-document workspace.

**Product type:**
SaaS/web workspace documental con agente y exportación estructurada. MVP enfocado en trabajos académicos, informes técnicos y documentos con requisitos explícitos.

**Business model:**
Por definir. La versión actual es un MVP/hackathon con acceso guest-first y opciones de biblioteca/sincronización en desarrollo.

## Target Audience

**Target companies / users:**
Beachhead: estudiantes universitarios, docentes y equipos académicos que producen informes, talleres, laboratorios o trabajos finales a partir de una consigna y una rúbrica.

Segundo segmento: equipos pequeños de ingeniería, operaciones, consultoría y agencias que convierten briefs o plantillas aprobadas en entregables repetibles.

**Decision-makers:**
- Usuario primario: la persona que redacta y entrega el documento.
- Champion: docente, líder técnico, coordinador o responsable de calidad que quiere menos entregas incompletas.
- Decisor futuro: responsable de equipo que necesita un flujo repetible y revisable.

**Primary use case:**
Recibir una guía o rúbrica, convertirla en una estructura de documento, redactar con el contexto visible, pedir cambios concretos, revisar las propuestas y exportar el resultado final.

**Jobs to be done:**
- “Ayúdame a no olvidar ningún requisito de la guía.”
- “Convierte esta consigna en un documento que pueda revisar antes de entregar.”
- “Propón mejoras sin reescribir todo ni borrar decisiones que ya tomé.”
- “Déjame entregar un PDF/DOCX con estructura, ecuaciones y tablas intactas.”

**Use cases:**
- Informe académico desde una consigna y rúbrica.
- Taller de matemáticas o laboratorio con procedimiento, ecuaciones y conclusiones.
- Informe técnico con secciones y campos obligatorios.
- Propuesta de agencia a partir de un brief de cliente.
- Serie de documentos que deben seguir una misma plantilla.

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Estudiante técnico | Cumplir la guía, explicar el razonamiento, entregar a tiempo | El chat genera texto, pero la rúbrica, las ecuaciones y el archivo final se desalinean | Un workspace que mantiene la guía cerca y hace visibles las decisiones | 
| Docente / coordinador | Calidad y consistencia de entregas | Recibe documentos que responden parcialmente a la consigna | Un flujo que hace explícitos requisitos, estructura y revisión | 
| Redactor técnico | Claridad, trazabilidad, exportación | Los cambios manuales rompen formato y estructura | Propuestas localizadas sobre objetos documentales reales | 
| Líder de equipo | Repetibilidad y control | Cada persona interpreta el brief de forma distinta | Una superficie común para brief, borrador, revisión y archivo | 

## Problems & Pain Points

**Core problem:**
La persona tiene que producir un documento que siga una guía, pero trabaja con piezas separadas: brief en un PDF o chat, checklist en otra parte, texto en Word/Google Docs y revisión manual al final. El problema no es solo escribir; es conservar la relación entre requisito, estructura, cambio y entrega.

**Why alternatives fall short:**
- Word y Google Docs son excelentes editores generales. Ofrecen formato, colaboración, comentarios, historial y control de cambios, pero el flujo comienza en el documento, no en la transformación de un brief o rúbrica en una estructura de trabajo.
- Un chat de IA puede redactar una respuesta, pero deja a la persona copiando, pegando, verificando y reconstruyendo un archivo real.
- Una plantilla fija ayuda a empezar, pero no entiende qué exige una consigna concreta ni propone cambios revisables sobre el documento.
- Un checklist externo puede marcar casillas, pero no mantiene el requisito conectado con el bloque, la ecuación, la tabla o la sección donde se cumple.

**What it costs them:**
- Entregas que omiten un punto aunque el texto “suene bien”.
- Horas de revisión y formato al final del trabajo.
- Cambios que rompen tablas, ecuaciones, paginación o referencias.
- Incertidumbre antes de entregar: “¿respondí realmente a la guía?”
- Pérdida de confianza cuando el agente cambia demasiado sin explicar qué hizo.

**Emotional tension:**
La persona no teme únicamente escribir mal. Teme entregar algo aparentemente terminado que no responde a lo que le pidieron.

## Competitive Landscape

**Direct:**
No se define aún un competidor directo dominante. La categoría propuesta es nueva: workspace de documentos guiados por requisitos.

**Secondary:**
- **Microsoft Word / Word para la web** — fuerte en edición, formato, colaboración y revisión; Docs Studio compite por el flujo de brief/rúbrica → estructura → propuesta → revisión → entrega, no por ser un procesador de texto más completo.
- **Google Docs** — fuerte en colaboración y edición abierta; Docs Studio compite por mantener el encargo y las decisiones de revisión dentro de la misma superficie.
- **Notion, plantillas y formularios** — fuertes en estructura flexible o captura; no son el foco actual para producir un documento paginado académico/técnico listo para exportar.

**Indirect:**
- Chatbots generalistas.
- Copiar y pegar desde una guía a un documento.
- Checklist manual + Word.
- Revisión final hecha a mano la noche antes de entregar.

**Competitive truth:**
No decir que Word o Google Docs “no pueden” revisar cambios o seguir una plantilla. Sí pueden hacer muchas partes del trabajo. La diferencia es que Docs Studio organiza la experiencia alrededor del requisito y de la revisión de propuestas; los editores generales organizan la experiencia alrededor de editar el archivo.

## Differentiation

**Key differentiators:**
- El brief, la rúbrica y las restricciones son contexto de trabajo, no una referencia olvidada en otra pestaña.
- El documento es la fuente de verdad: canvas paginado, bloques, tablas, imágenes y ecuaciones reales.
- El agente propone cambios específicos y deja un diff visible antes de modificar el documento.
- Aceptar y rechazar son acciones explícitas; no hay que confiar en una mutación silenciosa.
- El mismo flujo termina en un PDF/DOCX exportable.
- El sistema está pensado para documentos donde importa la estructura, el procedimiento y la evidencia visible del razonamiento.

**How we do it differently:**
Docs Studio une cinco estados que normalmente están separados: **contexto → estructura → redacción → revisión → archivo**. La IA no es el producto; es una capacidad dentro de ese circuito.

**Why that’s better:**
La persona puede avanzar más rápido sin perder el control del resultado. Puede preguntar “qué cambió”, revisar una parte concreta y conservar el documento que ya tenía. El valor está en reducir el riesgo de desalineación, no en generar la mayor cantidad de texto.

**Why customers choose us:**
Eligen Docs Studio cuando el documento no puede ser simplemente “bonito” o “bien escrito”: tiene que responder a una guía, conservar una estructura, mostrar un procedimiento y salir en un formato entregable.

## Objections

| Objection | Response |
|-----------|----------|
| “Ya tengo Word o Google Docs.” | Perfecto: Docs Studio no intenta reemplazarlos. Resuelve el tramo anterior: convertir el brief o la rúbrica en un documento que puedas revisar y luego exportar. |
| “No quiero que una IA cambie mi trabajo sin permiso.” | El agente propone; tú aceptas, rechazas o ajustas. La propuesta queda visible antes de aplicarse. |
| “¿Me garantiza una buena calificación?” | No. Ayuda a trabajar contra la guía y a detectar estructura/requisitos, pero la calidad académica y la decisión final siguen siendo humanas. |
| “¿El archivo se puede entregar?” | El flujo exporta PDF y DOCX, y conserva objetos documentales como tablas y ecuaciones dentro del workspace. |
| “No quiero aprender otro editor.” | El producto debe demostrar un recorrido corto: cargar contexto, generar estructura, revisar una propuesta y exportar. No se vende como una suite completa. |

**Anti-persona:**
- Quien busca un procesador de texto generalista para escribir cualquier cosa sin requisitos.
- Quien necesita maquetación editorial pixel-perfect o diseño de libros.
- Equipos que necesitan colaboración masiva en tiempo real como requisito principal.
- Organizaciones que necesitan gestión documental, permisos, retención legal o auditoría empresarial completa.
- Personas que quieren delegar toda la decisión en el agente y no revisar el resultado.

## Switching Dynamics

**Push:**
“Ya entregué algo que estaba bien escrito, pero no respondía a todos los puntos.” “Tengo el brief en un PDF, el borrador en Word y la revisión en el chat.” “Cada corrección cambia otra parte.”

**Pull:**
Brief y documento juntos; estructura visible; cambios propuestos y comparables; canvas real; exportación sin reconstruir el archivo.

**Habit:**
Word y Google Docs ya están instalados, son conocidos y muchas instituciones los esperan.

**Anxiety:**
Que el resultado no sea editable, que el agente invente contenido, que la exportación se rompa o que cambiar de herramienta agregue trabajo.

## Customer Language

**How they describe the problem:**
- “No sé si cumplí todos los puntos de la rúbrica.”
- “El documento está escrito, pero no sé si sigue la guía.”
- “Tengo que pasar de la consigna a algo entregable.”
- “Quiero ver qué cambia antes de aceptarlo.”
- “No quiero que me reescriba todo.”
- “Necesito que el procedimiento quede visible, no solo la respuesta.”

**How they describe us:**
- “Un espacio de trabajo para convertir una guía en un documento.”
- “Un documento que recuerda el encargo.”
- “El agente propone, yo decido.”
- “Del brief al archivo.”

**Words to use:**
brief, guía, rúbrica, requisitos, restricciones, estructura, procedimiento, documento revisable, propuesta, diff, aceptar, rechazar, fuente de verdad, archivo entregable, PDF, DOCX.

**Words to avoid:**
reemplazo de Word, calificación automática, cumplimiento garantizado, escribe por ti, magia, IA que sabe todo, documento perfecto, cero errores, agente autónomo sin supervisión, nombre del proveedor/modelo.

**Glossary:**

| Term | Meaning |
|------|---------|
| Brief / guía | Documento o instrucción que define qué debe contener el trabajo |
| Rúbrica | Criterios que explican cómo se evaluará el resultado |
| Contexto | Información que el agente y el workspace conservan para trabajar |
| Canvas / lienzo | Documento paginado donde vive el resultado real |
| Propuesta | Cambio preparado por el agente, todavía no aplicado |
| Revisión | Comparación y decisión humana sobre una propuesta |
| Documento guiado por requisitos | Documento cuyo contenido y estructura parten de condiciones explícitas |

## Brand Voice

**Tone:**
Claro, seguro, sobrio y útil. Académico/técnico sin sonar institucional ni burocrático.

**Style:**
Explicar con ejemplos concretos. Hablar de decisiones y resultados visibles. No exagerar la autonomía del agente. Reconocer que Word y Google Docs son buenos en lo que hacen.

**Personality:**
Focused, honest, calm, structured, human-controlled.

## Proof Points

**Metrics:**
No hay métricas públicas verificadas todavía. No inventar cifras de tiempo, calidad o calificaciones.

**Product evidence:**
- Brief intake desde documentos y contexto.
- Canvas Letter/Legal con páginas reales.
- Borrador y edición asistida.
- Propuestas con Accept/Reject.
- Tablas, imágenes y ecuaciones como objetos del documento.
- Normas APA/IEEE/MLA.
- Exportación PDF/DOCX.
- Historial y versiones recuperables.
- Caso determinista de taller de eliminación gaussiana con tareas y rúbrica.

**Testimonials:**
Todavía no hay testimonios externos. No usar citas ficticias.

**Value themes:**

| Theme | Proof |
|-------|-------|
| Trabajar contra el encargo | El brief y la rúbrica forman parte del contexto |
| Revisar antes de aplicar | Cada propuesta tiene diff y Accept/Reject |
| Conservar el razonamiento | Canvas paginado con pasos, ecuaciones y tablas |
| Llegar al archivo | Exportación PDF/DOCX desde la misma representación |

## Goals

**Business goal:**
Encontrar un wedge claro y memorable para Docs Studio, empezando por documentos académicos y técnicos guiados por rúbricas/requisitos.

**Conversion action:**
“Ver el workspace” / “Empezar desde una guía”. El video debe llevar a probar un caso real, no a descargar una herramienta genérica de IA.

**Current metrics:**
No disponibles.

## Changelog

- v1 (2026-07-19) — Creado el contexto de product marketing; reposicionamiento desde “editor documental con IA” hacia workspace de documentos guiados por brief, rúbrica y requisitos.
