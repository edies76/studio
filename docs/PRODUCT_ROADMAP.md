# Docs Studio — roadmap de producto

Este documento conserva las apuestas diferenciales acordadas para Docs Studio. No son promesas activas hasta que tengan diseño, implementación y pruebas, pero orientan las siguientes iteraciones del producto.

## Norte de producto

Docs Studio no debe limitarse a ser un lienzo de texto con IA. Debe ayudar a convertir una consigna en una entrega verificable, con una estructura, un estilo y evidencias claras de que cumple los requisitos.

## Diferenciadores priorizados

### 1. Perfil de entrega

Una entrega combina tres piezas que normalmente están separadas:

- **Brief:** qué pide la persona, profesor o institución.
- **Plantilla:** cómo debe verse y organizarse el documento.
- **Referencias:** archivos, rúbricas, ejemplos y fuentes que definen el contexto.

El perfil guarda esas piezas para volver a usarlas en futuros documentos. Por ejemplo: “Informes de Cálculo — Universidad X”.

### 2. Matriz de cumplimiento

Cada requisito del brief se convierte en una fila comprobable: estado, sección relacionada, evidencia y siguiente acción. El usuario puede ver qué está completo, qué falta y qué todavía requiere revisión humana.

### 3. Redacción guiada por evidencia

El agente redacta con el brief, las referencias seleccionadas y el contenido actual del documento. Debe citar de dónde obtiene cada regla o dato, no inventar condiciones ni afirmar que un requisito se cumplió sin comprobarlo.

### 4. Revisión previa a entrega

Un preflight de entrega verifica, antes de exportar: estructura requerida, longitud, títulos, tablas/figuras, formato, campos pendientes, referencias y elementos que no se pudieron importar o validar.

### 5. Historial y decisiones del brief

Los perfiles y briefs deben poder versionarse. El usuario puede saber qué regla cambió, cuándo y por qué; también puede recuperar una versión anterior de la entrega.

### 6. Importación en dos modos

- **Editable:** convierte Word en bloques nativos de Docs Studio para seguir editando el contenido.
- **Referencia fiel:** conserva el archivo de origen como autoridad visual y extrae su estructura, reglas y estilo para crear un perfil reutilizable.

Ambos modos deben explicar con honestidad qué se conservó, qué se convirtió y qué necesita revisión.

### 7. Biblioteca de patrones reutilizables

No solo plantillas completas: portadas, tablas de contenido, secciones de metodología, rúbricas, bibliografías y bloques institucionales. Cada patrón debe aceptar datos variables y respetar las reglas del perfil.

## Criterios para construirlos

- Toda promesa del agente debe poder comprobarse en el documento.
- Ninguna automatización debe destruir el trabajo existente sin una acción reversible.
- Los formatos complejos de Word se importan con degradación explícita, nunca silenciosa.
- La IA debe ser más rápida cuando la tarea es pequeña: contexto selectivo, herramientas solo cuando hagan falta y respuesta visible durante la operación.

