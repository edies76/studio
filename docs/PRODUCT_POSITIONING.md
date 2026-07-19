# Qué es Docs Studio

Docs Studio no intenta reemplazar Word, Google Docs ni un procesador de texto generalista. Su propósito es más específico: convertir un encargo con contexto —una guía, una rúbrica, un brief o un archivo de referencia— en un documento revisable y exportable sin perder la relación entre instrucciones, estructura y resultado.

El acceso es guest-first: se puede probar sin cuenta. Google es opcional y permite asociar la biblioteca y el progreso a una identidad para recuperarlos entre dispositivos; no hay flujo de correo y contraseña.

## El problema que resuelve

En un chat, la IA puede producir texto, pero el usuario pierde visibilidad sobre el documento real: qué cambió, qué parte cumple la guía, dónde quedó una ecuación, si una tabla conserva su estructura o si el archivo final se puede entregar. En un editor tradicional hay control manual, pero el contexto del encargo y la revisión asistida viven fuera del documento.

Docs Studio ocupa esa zona intermedia:

- el brief y la guía quedan disponibles como contexto de trabajo;
- el lienzo es la fuente de verdad, no una previsualización decorativa;
- el agente lee bloques, ecuaciones y estructura antes de proponer;
- cada cambio queda como propuesta aceptable o rechazable;
- tablas, imágenes y ecuaciones son objetos del documento, no texto frágil;
- el resultado sale como DOCX o PDF desde esa representación estructurada.
- cada propuesta aceptada puede quedar como una versión independiente y restaurable.

## Para qué es bueno

Es especialmente útil para informes académicos, talleres con procedimientos, propuestas que deben seguir una rúbrica, documentación técnica y cualquier documento donde importen la estructura, el razonamiento visible y la revisión humana.

No es la mejor herramienta para maquetación editorial avanzada, colaboración masiva en tiempo real o reemplazar todas las funciones de Word. La edición libre sigue siendo posible, pero el valor diferencial está en trabajar con contexto, cambios trazables y objetos documentales que un agente también puede controlar.

## La nube

La nube no es una “IA difusa” separada del producto. Es la misma superficie documental publicada: el workspace, sus documentos y el endpoint MCP viven detrás del mismo dominio y usan el mismo almacenamiento. Eso permite que una persona en el navegador y un agente externo trabajen sobre el mismo documento, con autenticación y propuestas explícitas, sin depender de una sesión local.

En producción, la arquitectura prevista es un servidor Next.js con DynamoDB para documentos y actividad, más el endpoint remoto `/api/mcp`. La configuración concreta está en [`DEPLOY_AWS.md`](./DEPLOY_AWS.md) y la superficie de herramientas en [`mcp/README.md`](./mcp/README.md).
