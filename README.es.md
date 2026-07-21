# Docs Studio

**Promesa:** un workspace documental para crear entregables que siguen el brief.

Docs Studio convierte una guía, rúbrica, plantilla o conjunto de requisitos en un documento estructurado. La IA puede redactar y proponer cambios, pero la persona conserva la decisión final.

No intenta reemplazar Word, Google Docs o Notion como editores generales. Está enfocado en el paso donde un encargo debe convertirse en un informe, propuesta, especificación o documento técnico que cumpla reglas concretas.

## Para qué sirve

- **Universidades y formación:** informes de talleres, laboratorios, trabajos de investigación y entregas basadas en rúbricas.
- **Agencias y consultorías:** propuestas, respuestas a RFP, estrategias e informes que deben seguir un brief y una plantilla.
- **Ingeniería, operaciones y compliance:** especificaciones, procedimientos, cambios, incidentes y reportes con campos obligatorios.
- **Documentos por lotes:** una plantilla aprobada con nombres, sedes, proyectos, fechas o mediciones diferentes.

## Las dos caras

**Para personas:** cargar contexto, generar un borrador, revisar propuestas y exportar un documento editable.

**Para agentes:** usar la misma superficie mediante MCP para crear, leer, completar, revisar y exportar documentos.

## Qué hace de verdad

| Área | Función |
|------|---------|
| Canvas | Lienzo multipágina Letter/Legal como fuente de verdad |
| Brief | Mantiene guías, rúbricas y referencias disponibles durante el trabajo |
| Draft | Genera un primer borrador en el documento |
| Edits | Propone cambios con diff y espera Aceptar / Rechazar |
| Normas | APA, IEEE, MLA, Simple y Mínimo |
| Math | Ecuaciones MATH-SAFE con protección del servidor |
| Export | PDF y `.docx` generado en servidor |
| Biblioteca | Autosave local o Google |
| MCP | Herramientas para agentes externos, recursos, prompts y exportación |

## Inicio rápido

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:9003`.

## Rutas

| Ruta | Propósito |
|------|-----------|
| `/` | Landing y entrada guiada |
| `/usecases` | Casos de uso y diferencia frente a un editor general |
| `/origin` | Historia y evolución del producto |
| `/home` | Biblioteca de documentos |
| `/studio` | Workspace con lienzo, agente, herramientas y exportación |
| `/mcp` | Superficie MCP para agentes externos |

## MCP

```bash
npm run mcp:stdio
npm run mcp:http
```

La documentación completa está en [`docs/mcp/README.md`](./docs/mcp/README.md).

## Honestidad del producto

Docs Studio no promete colaboración masiva en tiempo real, maquetación editorial avanzada ni reemplazar todos los usos de Word o Google Docs. Su ventaja es trabajar con documentos que tienen un brief, una rúbrica, una plantilla o reglas que deben respetarse.

## Origen

Docs Studio nació del prototipo personal [`edies76/studio`](https://github.com/edies76/studio) y evolucionó hacia un workspace documental con agente, reglas y MCP. La historia técnica está en [`docs/HACKATHON_CHANGES.md`](./docs/HACKATHON_CHANGES.md).
