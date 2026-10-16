# Hitos: reuniones, minuta en Markdown y adjuntos

**Estado:** borrador · **Fecha:** 2026-10-15 · **Pantalla:** `/app/admin/proyectos/:projectId/hitos`

## Resumen

Tres cambios sobre la entidad `Milestone` que ya existe, sin crear un modelo nuevo:

1. Un tipo nuevo, **`reunion`**, para dejar la minuta de una reunión de obra.
2. La **descripción pasa a Markdown**, con un editor de formato (título, subtítulo,
   negrita, itálica, listas). Vale para **todos** los tipos.
3. **Adjuntos en todos los hitos**: PDF e imágenes, con el mismo storage que la
   documentación de obra.

`severity` se queda como está: `info`, `atencion` y `critico`. Las reuniones usan
la misma escala que el resto de los hitos.

---

## Problema

Hoy un hito es un título, una fecha y un texto plano de hasta 2000 caracteres.
Alcanza para avisar que "pasó algo", pero no para dejar constancia de **cómo**
pasó ni **qué se decidió**:

- **Las reuniones con el cliente no quedan registradas en la obra.** La minuta
  vive en un mail, un WhatsApp o un cuaderno. Cuando seis meses después el
  cliente dice "yo nunca aprobé cambiar el porcelanato", no hay dónde buscarlo.
- **Un hito no tiene prueba.** Un vicio oculto sin foto o un problema de
  permisología sin el acta escaneada obliga a ir a buscar el respaldo a otro
  lado (o a cargarlo en Documentación, que es para planos y permisos, no para
  eventualidades).
- **El texto plano no tiene estructura.** Una minuta de una hora con temas,
  acuerdos y pendientes en un solo párrafo no se puede leer después.

## Objetivos

1. Que el gerente pueda registrar una reunión de obra con su minuta completa,
   sin salir de Luma.
2. Que cualquier hito pueda llevar el respaldo que lo prueba (foto, PDF).
3. Que la minuta sea legible después: con títulos, listas y énfasis, no un
   bloque de texto.
4. No sumar complejidad al modelo: un tipo más en el enum, un campo opcional y
   un array embebido.

## Fuera de alcance

| Qué | Por qué no ahora |
|---|---|
| Compromisos de la reunión que se convierten en actividades | Es la mejor idea para la próxima versión, pero agrega estructura propia de la reunión. Primero hay que ver si se usan minutas |
| Conformidad del cliente ("leí y estoy de acuerdo") | Requiere un estado nuevo y una decisión sobre qué pasa si se edita después. Va con la versión siguiente |
| Reuniones en serie y pendientes que pasan a la próxima reunión | Depende de los compromisos |
| Exportar la minuta a PDF o mandarla por mail | El cliente ya la ve en la app si la audiencia es `cliente` |
| Bloquear o versionar una minuta publicada | Hoy un hito al cliente sólo lo edita quien tiene `milestone.publish`; alcanza para esta versión |
| Notificar cuando se agrega un adjunto a un hito existente | La notificación sale al crear el hito, igual que hoy |
| Transcripción o resumen con IA | Consentimiento y costo por minuto. Sólo si se ve que la gente no escribe minutas |
| Escala de relevancia de 4 niveles | Decidido: se mantienen los 3 de `severity` |

## Usuarios e historias

**Gerente**
- Como gerente, quiero registrar una reunión con el cliente con fecha,
  asistentes y la minuta, para tener constancia de lo que se acordó.
- Como gerente, quiero escribir la minuta con títulos, listas y negritas, para
  que se pueda leer de un vistazo meses después.
- Como gerente, quiero adjuntar el presupuesto revisado o fotos de la visita a
  la reunión, para que el respaldo quede junto al acuerdo.
- Como gerente, quiero adjuntar fotos a un hito de vicio oculto, para que el
  cliente vea el problema y no solo lo lea.

**Supervisor**
- Como supervisor, quiero dejar la minuta de una reunión interna con el equipo,
  para que el gerente se entere de lo que se habló sin estar presente.
- Como supervisor, quiero adjuntar fotos a una eventualidad, para que el gerente
  pueda evaluar la gravedad sin ir a la obra.

**Cliente**
- Como cliente, quiero leer las minutas de las reuniones a las que fui y ver sus
  adjuntos, para revisar lo que se acordó.
- Como cliente, **no** tengo que ver reuniones internas ni sus adjuntos.

---

## Requisitos

### P0 — sin esto no sale

#### R1. Tipo `reunion`

- Se agrega `'reunion'` a `MilestoneType`, `MILESTONE_TYPES`, el schema Zod y el
  enum de Mongoose.
- Ícono Lucide `Users` en la tarjeta. Etiqueta en los dos idiomas.
- Se actualiza el comentario de `MILESTONE_TYPES` ("los cinco tipos que enumera
  la matriz") para explicar que `reunion` no viene de la matriz.

**Criterios de aceptación**
- [ ] Al crear un hito, "Reunión" aparece en el selector de tipo.
- [ ] Una reunión se guarda con `audience`, `severity` y fecha, como cualquier
  otro hito, y respeta las mismas reglas de permisos.
- [ ] Una reunión con audiencia `cliente` notifica a los tres roles; una interna,
  sólo a gerente y supervisor (mismo `notifyForMilestone`, sin código nuevo).

#### R2. Asistentes (sólo en reuniones)

- Campo opcional `attendees: string[]`, **por nombre** y sin referencia a
  `User`: en una reunión hay gente que no tiene cuenta (arquitecto, inspector).
  Mismo criterio que el responsable de una tarea.
- Hasta 30 nombres de hasta 80 caracteres cada uno, recortados y sin vacíos.
- Es el **único** campo condicional al tipo. El schema lo rechaza si
  `type !== 'reunion'`, y cambiar el tipo de una reunión a otro lo vacía.

**Criterios de aceptación**
- [ ] El campo de asistentes aparece en el formulario sólo si el tipo es "Reunión".
- [ ] Mandar `attendees` con otro tipo devuelve 400 con `code` de validación.
- [ ] La tarjeta de la reunión muestra los asistentes debajo del título.

#### R3. Descripción en Markdown

- `description` sigue siendo un `string`, ahora interpretado como Markdown. El
  texto plano que ya existe es Markdown válido: **no hace falta migración**.
- El límite sube de 2000 a **20.000 caracteres** (una minuta de una hora no
  entra en 2000).
- **Editor:** Tiptap v3 (`@tiptap/react` + `@tiptap/starter-kit` + extensión
  oficial de Markdown). Barra con: Título (H2), Subtítulo (H3), Negrita,
  Itálica, Lista con viñetas, Lista numerada y Enlace. Nada más: sin tablas,
  sin colores, sin imágenes en línea (las imágenes van como adjunto).
  - Los botones de la barra son `Toggle` de shadcn con íconos Lucide y
    `aria-label` por i18n.
  - Funcionan los atajos estándar (⌘B, ⌘I).
  - El editor se carga de forma diferida (`React.lazy`) y solo en el formulario.
- **Lectura:** `react-markdown` **sin `rehype-raw`**. No se interpreta HTML: si
  se guardara, cualquiera con `milestone.report` podría meter un `<script>`
  que después vería el cliente. Los enlaces abren en otra pestaña con
  `rel="noopener noreferrer"`.
- Los títulos de la minuta van en Inter, no en serif: `Instrument Serif` es
  sólo para el título de la pantalla.
- En la lista, una descripción larga se muestra recortada con un "Ver más".

**Criterios de aceptación**
- [ ] Un hito viejo con texto plano se ve igual que antes.
- [ ] Una minuta con título, subtítulo, negrita, itálica y listas se guarda como
  Markdown y se ve con ese formato en la tarjeta.
- [ ] Un `<script>` o `<img onerror>` escrito en la descripción se muestra como
  texto, no se ejecuta.
- [ ] Más de 20.000 caracteres devuelve el error de validación en el banner del
  formulario.
- [ ] El editor funciona en Chrome, Safari de escritorio y Safari de iOS (incluye
  el teclado en pantalla y la barra de herramientas al alcance del pulgar).

#### R4. Adjuntos en todos los hitos

**Modelo.** Array embebido en `Milestone`, igual que `evidence` en `Activity`:

```ts
attachments: [{
  key: string;          // ruta en el bucket — nunca sale en una respuesta
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: ObjectId;
  createdAt: Date;
}]
```

En la respuesta, cada adjunto lleva `id`, `fileName`, `contentType`,
`sizeBytes` y una **URL firmada generada en cada respuesta**; nunca se guarda.

**Límites.** Los mismos de Documentación: `DOCUMENT_MIME_TYPES` (PDF, JPG, PNG,
WebP) y `DOCUMENT_MAX_BYTES` (20MB) por archivo. Hasta **10 adjuntos por hito**.

**Endpoints** (anidados bajo `/api/projects/:projectId/milestones/:milestoneId`):

| Método | Ruta | Capacidad |
|---|---|---|
| `POST` | `/attachments` (multipart, `file`) | `milestone.report` |
| `DELETE` | `/attachments/:attachmentId` | `milestone.report` |

- Si el hito tiene audiencia `cliente`, subir o borrar un adjunto también
  requiere `milestone.publish`. Es la misma regla que para editarlo: un
  supervisor no cambia lo que el cliente ya recibió.
- Los errores se lanzan con `utils/errors.ts`, en castellano y con `code`.
  Archivo muy grande, tipo no permitido y tope de 10 tienen cada uno su
  mensaje propio.
- **Borrar el hito borra sus archivos del bucket.** Si falla el borrado de algún
  objeto, se loguea y el hito se borra igual.
- **El cliente nunca recibe adjuntos de un hito interno.** Ya no le llegan esos
  hitos; un test lo deja asegurado.

**Interfaz**
- En el formulario, sección "Adjuntos" con selector de archivos (en iOS abre la
  cámara o la galería).
- **Al crear:** primero se guarda el hito y después se suben los archivos uno por
  uno. Si alguno falla, el formulario queda abierto en modo edición y el banner
  de `FormShell` lista los archivos que no se subieron, con opción de
  reintentar. El hito ya quedó creado.
- **Al editar:** cada archivo se sube apenas se elige y se puede quitar (con
  confirmación).
- **En la tarjeta:** las imágenes se muestran en miniatura y los PDF como chip con
  ícono `FileText`, nombre y tamaño. Al tocar, se abre en otra pestaña.

**Criterios de aceptación**
- [ ] Un hito de cualquier tipo acepta adjuntos.
- [ ] Un archivo de 21MB o un `.docx` se rechaza con un mensaje claro en el banner.
- [ ] Un adjunto número 11 se rechaza.
- [ ] El supervisor no puede subir ni borrar adjuntos en un hito al cliente (403).
- [ ] El cliente ve los adjuntos de hitos al cliente y nunca los de hitos
  internos (test de unidad en la API).
- [ ] Borrar un hito borra sus objetos del bucket (test con el storage mockeado).
- [ ] La `key` nunca aparece en ninguna respuesta.

#### R5. El formulario deja de ser un drawer

Con minuta, asistentes y adjuntos, el formulario de hito no entra en un panel
lateral. Pasa a una **superficie de edición que ocupa todo el área de contenido
del dashboard**:

- **Caja:** `bg-card` (el "blanco" de un sistema que tiene un solo tema,
  oscuro) que cubre de borde a borde el espacio interno del dashboard. El
  sidebar y el header quedan visibles. En el celular ocupa toda la pantalla
  (`100dvh`).
- **Cierre:** botón con ícono `X` arriba a la derecha (`aria-label` por i18n).
  `Esc` también cierra.
- **Contenido:** formulario centrado con un ancho máximo de lectura (~720px), y
  el título de la pantalla arriba ("Nuevo hito" / "Editar hito").
- **Pie fijo:** el mismo `FormShell` que usa el alta de obra
  ([project-new.tsx](../../packages/web/src/pages/projects/project-new.tsx)),
  con Cancelar y Guardar/Actualizar siempre a la vista y el banner de error
  pegado a los botones. No se arma un pie nuevo.
- **Cambios sin guardar:** si hay cambios (`isDirty`) y se cierra con la `X`,
  `Esc` o Cancelar, se pide confirmación antes de descartar. En el drawer no
  hacía falta; acá sí, porque se pierde una minuta de una hora con un toque.
  Recargar la pestaña con cambios dispara el aviso nativo (`beforeunload`).
- **Foco:** al abrir, el foco va al primer campo y queda atrapado dentro de la
  superficie. Al cerrar, vuelve al botón que la abrió.

**Componente reutilizable, no algo propio de hitos.** `FormDrawer` dice que es
"el panel único para toda la edición" y esta sería la segunda superficie. Para
que no aparezca una tercera, se crea en `components/common/` (por ejemplo
`FormPanel`) con la misma API que `FormDrawer` (`open`, `onOpenChange`,
`title`, `onSubmit`, `isDirty`, `error`…), y se documenta cuándo usar cada uno:
**drawer** para formularios cortos de campos sueltos y **panel** cuando hay
texto largo o adjuntos.

**Criterios de aceptación**
- [ ] Crear y editar un hito abren la superficie de edición, no el drawer.
- [ ] La superficie cubre el área de contenido y deja el sidebar y el header a la
  vista. En 375px ocupa toda la pantalla y el pie no queda tapado por el
  teclado de iOS.
- [ ] Cancelar y Guardar se ven siempre, sin scroll, con una minuta de 20.000
  caracteres.
- [ ] Cerrar con cambios pide confirmación; cerrar sin cambios no.
- [ ] `Esc` cierra, el foco queda atrapado mientras está abierta y vuelve al botón
  de origen al cerrar.
- [ ] Funciona en Chrome y en Safari (escritorio e iOS).

#### R6. Lo que exige el repo

- [ ] Claves i18n nuevas en `es` y `pt` a la vez (pasa el test de paridad).
- [ ] `pnpm bump:web minor`.
- [ ] Unit en la API para los endpoints de adjuntos y la validación de `attendees`.
- [ ] E2E por flujo: "el gerente registra una reunión con minuta y un adjunto, y
  el cliente la ve".
- [ ] El editor y el selector de archivos revisados a ojo para Safari: tocan
  APIs del browser. Los E2E corren sólo en Chromium.

### P1 — si se puede, en esta versión

- **Filtro por tipo** en la lista, para ver sólo las reuniones.
- **Arrastrar y soltar** archivos en el formulario (escritorio).
- **Pegar una imagen** en el editor la sube como adjunto en lugar de insertarla
  en el texto.

### P2 — no se construye, pero el diseño no lo tiene que impedir

- **Compromisos → actividades.** Un renglón de la minuta se vuelve una
  `Activity`. Para esto la minuta tiene que poder referenciar actividades: no
  guardar nada que lo impida.
- **Conformidad del cliente.** Requiere saber si la minuta cambió después de que
  el cliente la leyó: `updatedAt` ya alcanza como base.
- **Separar `reunion` en su propia colección** si crecen los campos propios
  (compromisos, serie, conformidad). Con `attendees` como único campo
  específico, la migración es un script corto.

---

## Métricas de éxito

No hay analytics de producto. Todo se mide con consultas a Mongo, a 30 y 90 días.

**De uso inmediato (30 días)**
| Métrica | Éxito | Ideal |
|---|---|---|
| Obras activas con al menos una reunión registrada | 30% | 50% |
| Hitos nuevos con al menos un adjunto | 25% | 40% |
| Hitos nuevos cuya descripción usa formato Markdown | 20% | 35% |

**A más largo plazo (90 días)**
| Métrica | Éxito |
|---|---|
| Reuniones por obra activa por mes | ≥ 2 |
| Reuniones con audiencia `cliente` sobre el total de reuniones | Se mide sin meta: dice si la minuta es una herramienta hacia el cliente o interna, y eso define si la conformidad del cliente es la próxima prioridad |

Si a los 90 días casi no hay reuniones registradas, no conviene construir
compromisos ni conformidad: el problema es otro (la gente no escribe minutas) y
ahí sí tiene sentido evaluar la transcripción.

## Preguntas abiertas

| Pregunta | Quién | ¿Bloquea? |
|---|---|---|
| ¿Hay que aceptar Word y Excel como adjuntos? Las minutas a veces vienen en `.docx`. Hoy Documentación no los acepta | Producto | No: arrancar con los tipos de Documentación y ampliar si se pide |
| Si el gerente edita una minuta que el cliente ya recibió, ¿hay que volver a notificarlo? | Producto | No |
| ¿La superficie de edición se abre por estado o por ruta (`hitos/nuevo`, `hitos/:id/editar`)? Por ruta, el botón "atrás" del celular la cierra y un enlace la abre directo. Por estado es más simple. Recomendación: ruta | Ingeniería | Sí, antes de R5 |
| Navegar desde el sidebar con cambios sin guardar los pierde sin aviso: la app usa `BrowserRouter`, que no tiene `useBlocker`. ¿Se acepta en esta versión o se migra a un data router? | Ingeniería | No: aceptarlo y dejarlo anotado |
| ¿Pasan a la superficie nueva otros formularios largos (gasto, presupuesto)? | Producto | No: esta spec solo cubre hitos |
| ¿La extensión de Markdown de Tiptap v3 conserva bien las listas anidadas al ida y vuelta? Si no, se limita la barra a un nivel de lista | Ingeniería, con spike de medio día | Sí, antes de R3 |

## Plan de entrega

Un solo PR con R1 a R6. Los adjuntos (R4) iban a ir en un segundo PR y se
sumaron a este: la card nueva de la cronología muestra la evidencia, y
separarlos dejaba una card a medio hacer.

Cada parte sigue el orden de `/feature`: shared → api → capa 1 → capa 2 → UI → i18n.

### Card de la cronología

Agregado durante la implementación, a pedido:

- Agrupada por mes; en cada card, tipo con ícono y fecha arriba, después el título.
- Gravedad con colores de estado (`atencion` ámbar, `critico` rojo); `info` no
  lleva badge.
- Sólo las críticas muestran un preview del texto; el resto queda detrás de
  "Ver minuta" / "Ver detalle".
- La evidencia (fotos en miniatura, PDF como chip) va debajo del texto.
- Toda la card es cliqueable: quien puede editar abre la edición; el cliente
  abre y cierra el texto. Editar y eliminar van en el menú "⋯".
