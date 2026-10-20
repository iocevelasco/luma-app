# Materiales: corregir errores y descargar la lista de compras en PDF

**Estado:** borrador (decisiones 1 y 2 cerradas) · **Fecha:** 2026-10-19 · **Pantalla:** `/app/admin/proyectos/:projectId/materiales` (Compras)

## Resumen

Tres cambios sobre `MaterialItem`, sin crear un modelo nuevo:

1. **Editar** un material cargado con un error.
2. **Eliminar** un material cargado por error.
3. **Descargar en PDF** la lista de lo que falta comprar, como tabla
   *Material – Cantidad – Proveedor*.

Editar y eliminar valen **sólo mientras el material no cambió de estado**. En
cuanto alguien lo pasa de Pendiente a Solicitado se asume que estaba bien y
queda como registro.

Este spec sale de dos pasadas previas: una técnica (código, permisos, riesgos)
y una de UX (flujos, microcopy, móvil). Donde se contradicen, gana lo que se
verificó en el código.

---

## Problema

El feedback de quienes ya usan Compras:

> "Los materiales, si tuvieron algún error no se pueden eliminar ni editar."
>
> "Normalmente hay varios proveedores… nunca tiene todo una misma locación."

- **No hay forma de corregir.** La API ya acepta `PATCH` y `DELETE`, pero la
  pantalla no los expone. Un error de tipeo en la cantidad o un material duplicado
  se queda en la lista para siempre y ensucia "Por comprar".
- **La lista no sirve para salir a comprar.** *Copiar lista* y *Compartir* arman
  `- nombre: cantidad unidad` **sin proveedor**. Como la compra se reparte entre
  varios proveedores, la persona tiene que rearmar a mano qué le pide a cada uno.
- **Hoy no hay guarda de integridad.** Si se habilitara editar tal cual, se podría
  cambiar la cantidad de algo que ya se pidió al proveedor y la lista dejaría de
  coincidir con lo que realmente se encargó.

## Objetivos

1. Que el gerente o el supervisor corrijan un material con error sin pedir ayuda,
   en menos de 30 segundos desde que lo ven.
2. Que un material que ya salió de Pendiente **no pueda** modificarse ni borrarse,
   ni desde la pantalla ni llamando a la API directamente.
3. Que la persona se lleve una lista de compras que ya diga *a quién* comprarle
   cada cosa, en un archivo que se manda por WhatsApp o se imprime.
4. Que las tres salidas de la lista (copiar, compartir, PDF) digan lo mismo.

## No-objetivos

| Fuera de alcance | Por qué |
|---|---|
| Un estado **"Anulado"** o una vía de desbloqueo | Es la salida natural cuando algo se descubre mal *después* de solicitarlo, pero abre preguntas de permisos y de auditoría. Queda en P2 (ver Decisiones tomadas). |
| **Deshacer** un borrado / baja lógica | Nada referencia un material, así que el borrado duro no rompe nada (ver Requisitos). La confirmación es la protección. |
| Vincular `supplier` al directorio de **Proveedores** | `supplier` es texto libre y `Provider` es otra entidad (subcontratistas). Unirlos es un modelo nuevo; se consulta antes. |
| PDF por proveedor, envío por mail, Excel, vista previa | Se valida primero que el PDF único alcance. |
| Edición inline en la fila y selección múltiple | Con guantes y en el celular, una fila entera "tocable" se activa por error. |
| Costos en el PDF | Lo ve gente que no debería (ver Restricciones). |

---

## Historias de usuario

**Supervisor / gerente**

- Como supervisor, quiero **editar** un material que cargué con la cantidad
  equivocada, para que la lista de compras refleje lo que realmente necesito.
- Como supervisor, quiero **eliminar** un material duplicado o cargado por error,
  para que no aparezca como pendiente de compra.
- Como supervisor, quiero **entender por qué** un material ya no se puede editar,
  para no pensar que la pantalla está rota.
- Como gerente, quiero **descargar la lista de Por comprar en PDF** con el
  proveedor de cada ítem, para salir a comprar o mandársela a quien compra.
- Como supervisor en el sitio con el celular, quiero que el PDF **se abra en la
  hoja de compartir**, para mandarlo por WhatsApp sin buscar el archivo.

**Casos borde**

- Como supervisor, si otra persona pasó el material a Solicitado mientras yo tenía
  abierto el editor, quiero un aviso claro al guardar en vez de pisar el dato.
- Como supervisor, si no hay nada por comprar, no quiero un botón de descarga que
  genere un PDF vacío.

*Quién ve la pantalla:* sólo `gerente` y `supervisor` tienen `material.read` (la
grilla en `packages/shared/src/permissions/index.ts`); `cliente` y `contador` no
llegan a Compras. No hace falta una capability nueva.

---

## Requisitos

### P0 — sin esto no se entrega

**R1. Regla de bloqueo, en un solo lugar.**
Un material es editable cuando `status === 'pendiente' && !statusChangedAt`.

- Vive en `packages/shared/src/utils/material.ts` como `isMaterialEditable(...)`,
  exportada desde `@luma/shared`. La API la usa para decidir y para armar el DTO;
  la UI **no la recalcula**.
- `toMaterialDTO` agrega `editable: boolean`.
- Por qué la conjunción y no sólo una de las dos condiciones:
  - Sólo `status === 'pendiente'`: el menú "…" permite volver a Pendiente, lo que
    desbloquearía la edición y anularía la regla.
  - Sólo `!statusChangedAt`: un material legado que ya está Comprado y nunca tuvo
    fecha de cambio quedaría editable.
- Sin migración: un legado Pendiente sin fecha queda editable; un legado en otro
  estado queda bloqueado.

Criterios de aceptación:
- [ ] Pendiente nunca tocado → `editable: true`.
- [ ] Pendiente → Solicitado → Pendiente → `editable: false`.
- [ ] Creado directamente como Solicitado/Comprado → `editable: false`.
- [ ] Legado en Comprado sin `statusChangedAt` → `editable: false`.
- [ ] Tabla de verdad cubierta por unit test en `shared`.

**R2. La API hace cumplir la regla.**
- `PATCH` con campos de contenido (nombre, cantidad, unidad, actividad, costo,
  proveedor) sobre un material bloqueado → **409**, `code: MATERIAL_LOCKED`.
  Un `PATCH` que sólo cambia `status` **se permite siempre**: el flujo de estados
  sigue como hoy.
- `DELETE` sobre un material bloqueado → 409, `MATERIAL_LOCKED`.
- Material inexistente → 404.
- La escritura es **atómica**: `findOneAndUpdate` / `findOneAndDelete` con
  `{ _id, project, status: 'pendiente', statusChangedAt: null }` en el filtro. Si
  devuelve `null`, se relee: sin documento → 404, con documento → 409. Un
  `findOne` previo sin ese filtro deja una ventana para pisar un cambio de estado
  concurrente.
- Nuevo `ApiErrorCode` `MATERIAL_LOCKED` (409). Se agrega en
  `packages/shared/src/types/errors.ts` (unión y `STATUS_BY_ERROR_CODE`),
  `packages/api/src/middleware/errorHandler.ts` (`STATUS_FOR`),
  `packages/web/src/lib/error-message.ts` (`KEY_BY_CODE`) y las claves `errors.*`
  en es/pt. El typecheck obliga a no olvidar ninguno.
- Se **lanza** el error (`throw`), no se arma a mano. Ojo: el controller envuelve
  todo en `try/catch → 500`; un `throw` ahí adentro se vuelve un 500. Hay que
  sacar esos `try/catch` y envolver con `wrap` como en `directory.controller.ts`,
  y adaptar `material.controller.spec.ts`, que hoy asserta `res.status(400)`.

Criterios de aceptación:
- [ ] `curl` de edición o borrado sobre un material Solicitado devuelve 409 con
      `code: MATERIAL_LOCKED`.
- [ ] Dos pedidos simultáneos (cambio de estado y edición) no dejan nunca un
      material editado *después* de salir de Pendiente.
- [ ] El `500` no expone nada interno.

**R3. Editar.**
- Campos editables: nombre, cantidad, unidad, actividad, costo estimado, proveedor.
  El **estado no** está en el formulario: cambia por el flujo que ya existe.
- Se reutiliza el drawer del alta: `NewMaterialDrawer` se extrae a
  `components/materials/material-drawer.tsx` como `MaterialDrawer`, con modo alta
  y modo edición (valores precargados). Título *Editar material*, botón
  *Guardar cambios*, apagado hasta que haya cambios (`isDirty`).
- **Poder vaciar campos.** Hoy no se puede borrar el costo estimado ni la
  actividad una vez cargados: es el mismo problema de "no se puede corregir".
  `estimatedCost` y `supplier` pasan a `.nullable()` (la API hace `$unset`) y el
  selector de actividad suma la opción *Sin actividad*.
- Falla al guardar → **banner en el drawer**, nunca toast. `useUpdateMaterial`
  tiene hoy un `onError` con toast, pensado para el cambio inline de estado: la
  edición usa una variante **sin toast de error**, o el error saldría duplicado.
- Éxito → toast verde *Material actualizado* y se cierra el drawer.
- Si el servidor responde `MATERIAL_LOCKED`: el drawer queda abierto con el
  banner, el guardar apagado, y se invalida `materials` para que la fila de atrás
  ya se vea bloqueada.
- En móvil: ancho completo, pie fijo (lo da `FormDrawer`), sin autofocus para que
  el teclado no tape el formulario. Al cerrar, el foco vuelve al disparador.

Criterios de aceptación:
- [ ] Cambiar la cantidad de un Pendiente y guardar actualiza la fila.
- [ ] Se puede dejar vacío el costo y el proveedor, y sacar la actividad.
- [ ] Guardar sin cambios no es posible (botón apagado).
- [ ] Editar un material que pasó a Solicitado en otra pestaña muestra el banner
      de bloqueo; no guarda.
- [ ] Los `#material-*` del formulario se conservan (el E2E actual los usa).

**R4. Eliminar.**
- Ítem *Eliminar* en el menú "…" (rojo, `Trash2`, separado de los estados). No va
  suelto en la fila: es lo más peligroso.
- `AlertDialog` de confirmación (mismo patrón que el cambio de estado) nombrando
  el material y la cantidad.
- **Borrado duro.** Se verificó que nada lo referencia salvo
  `activity.controller.ts:370` (que sólo pone `activity: null` al borrar una
  actividad) y el seed: ningún gasto, compromiso, hito ni resumen guarda un
  `materialId`. La baja lógica de CLAUDE.md es para cuentas; un material
  Pendiente nunca tocado no tiene historia que preservar. Se actualizan los
  comentarios de `models/MaterialItem.ts` ("transiciones libres", "borrado DURO").
- Éxito → toast *Material eliminado* (la clave ya existe). Falla → **toast**
  (no hay formulario donde poner un banner).
- Un enlace viejo `?material=<id>` a un material borrado simplemente no encuentra
  la fila.
- Tras borrar, el disparador se desmonta: el foco se lleva a la fila siguiente o
  al panel de la pestaña.

Criterios de aceptación:
- [ ] Eliminar un Pendiente lo saca de "Por comprar" y de los conteos de la
      pestaña, del resumen de la obra y de la actividad vinculada.
- [ ] Cancelar el diálogo no borra nada.
- [ ] Un material que ya no es Pendiente no se puede eliminar: la UI no ofrece *Eliminar* y la API responde 409.

**R5. Comunicar el bloqueo.**
Tres capas, sin ruido por fila:

1. **Ocultar** *Editar* y *Eliminar* en las filas bloqueadas (no deshabilitarlos:
   un botón gris en un celular no explica nada y el tooltip no existe).
2. **Una línea fija** bajo las pestañas, sólo con permiso de escritura.
3. **Una nota dentro del "…"** de las filas bloqueadas, en texto (se lee tocando).

Y una cuarta, en el momento de la transición, para que no sea una sorpresa: el
diálogo de cambio de estado **desde Pendiente** agrega el aviso de que después
no se podrá editar ni eliminar.

| Dónde | es-AR | pt |
|---|---|---|
| Línea fija | Podés editar o eliminar un material mientras esté Pendiente. Después de solicitarlo queda como registro. | Você pode editar ou excluir um material enquanto ele estiver Pendente. Depois de solicitado, ele fica como registro. |
| Nota en "…" | Ya no se puede editar ni eliminar: salió de Pendiente. | Não pode mais ser editado nem excluído: saiu de Pendente. |
| Diálogo de estado (desde Pendiente) | Vas a marcar este material como "Solicitado". Después ya no vas a poder editarlo ni eliminarlo. | Depois disso, você não poderá mais editá-lo nem excluí-lo. |
| Banner de bloqueo | Este material ya cambió de estado y no se puede editar. Cerrá y mirá cómo quedó. | Este material já mudou de status e não pode mais ser editado. Feche e veja como ficou. |
| Confirmar borrado | ¿Eliminar este material? · Vas a eliminar "Cemento portland" (20 bolsas). No se puede deshacer. | Excluir este material? · Você vai excluir "…". Não é possível desfazer. |

Verificar el vocabulario pt contra `pt/translation.json` antes de cerrar.

**R6. Descargar PDF de lo que falta comprar.**
- Botón *Descargar PDF* (`FileDown`, outline) primero en la barra de la pestaña
  "Por comprar": `[Descargar PDF] [Copiar lista] [Compartir]`. Visible con los
  mismos criterios que *Copiar lista* (hay algo por comprar). Se gatea con
  `material.read`; no hace falta una capability nueva.
- **Contenido:** encabezado con nombre de la obra y fecha; tabla **Material –
  Cantidad (con unidad) – Proveedor**; "N materiales · M proveedores".
- **Orden:** por proveedor (comparación sin tildes ni mayúsculas, `trim`,
  `localeCompare`), con **"Sin proveedor" al final**; dentro de cada proveedor, por
  nombre. Así quien compra recorre la tabla proveedor por proveedor.
- **Qué entra:** lo que ya muestra la pestaña "Por comprar" (`organizeMaterials(...).toBuy`:
  Pendiente y Solicitado). **Decidido:** los Solicitado entran **marcados como
  "ya pedido"**, para que quien compra no los duplique. La marca va en texto
  (*Ya pedido* / *Já solicitado*), nunca sólo en color, y no agrega una cuarta
  columna: se escribe en la celda del material. Los Pendiente van primero dentro
  de cada proveedor; los ya pedidos, después.
- **Nunca** lleva costo estimado, estados internos ni nombres de usuario.
- **Una sola implementación del armado** (`buildToBuyLines` / `groupToBuyBySupplier`
  en `lib/materials.ts`); *Copiar* y *Compartir* pasan a usarla y por fin
  incluyen el proveedor.
- **Cliente, no servidor.** `jspdf` + `jspdf-autotable` agregadas sólo a
  `packages/web`, con `import()` dinámico. Los datos ya están en el navegador, no
  hace falta un endpoint ni una dependencia pesada en la API, y `window.print` no
  da una descarga confiable en iOS. Generador en `lib/materials-pdf.ts`. Las
  fuentes estándar cubren es/pt (á ñ ã ç); se sanean los caracteres fuera de
  latin-1 (emoji, guiones largos).
- **Paginado:** la tabla repite el encabezado en cada hoja, numera "Página 2 de 3"
  y no corta un proveedor corto entre dos hojas. Tipografía ≥ 10 pt y filas de
  ~8 mm: se puede escribir encima si se imprime.
- **Casillero** al inicio de las filas **Pendiente**: sirve impreso. Las filas ya
  pedidas no lo llevan. No se confunde con *Marcar solicitado*, que es un cambio
  de estado. Se dibuja como rectángulo vectorial, no como el carácter ☐, que las
  fuentes estándar (latin-1) no tienen.
- **Entrega:**
  - Escritorio: descarga directa + toast *PDF descargado*.
  - iPhone/Android: si existe `navigator.canShare({ files })`, abre la hoja de
    compartir con el PDF (el uso real: WhatsApp al proveedor, o guardarlo en
    Archivos). Si no, descarga con `<a download>`. Cancelar la hoja no es error.
  - Safari exige gesto de usuario para `share()`/descarga: un `await import()` lo
    rompe, así que el chunk se **precarga** al montar la pestaña o al hacer hover.
    Sin `window.open` después de un `await`.
- Mientras se genera: botón deshabilitado con spinner, *Generando…*, `aria-busy`.
  Falla → toast *No pudimos generar el PDF. Probá de nuevo.*
- Archivo: `compras-<obra-sin-acentos>-AAAA-MM-DD.pdf`.

Criterios de aceptación:
- [ ] La tabla tiene exactamente tres columnas: Material, Cantidad, Proveedor.
- [ ] "Sin proveedor" queda al final y se ve marcado.
- [ ] Un material Solicitado aparece con la marca "Ya pedido" y sin casillero; uno Pendiente, con casillero y sin marca.
- [ ] *Copiar* y *Compartir* usan el mismo texto: proveedor y "(ya pedido)" incluidos.
- [ ] "Corralón Sur", " corralon sur" y "CORRALÓN SUR" se ordenan juntos.
- [ ] Con 60 materiales el PDF pagina, repite el encabezado y conserva ñ y acentos.
- [ ] Sin materiales por comprar el botón no aparece.
- [ ] Carga sin errores de consola en Chromium; el chunk del PDF no entra al
      bundle principal.
- [ ] Probado a mano en un iPhone real (los E2E sólo corren en Chromium).

### P1 — fast follow

- **Autocompletar proveedor** (`datalist` con los ya usados en la obra) en el
  campo del formulario. Es la mitigación en origen del texto libre: evita que el
  mismo proveedor aparezca con tres grafías.
- **Agrupar visualmente por proveedor** en el PDF (encabezado de sección con
  conteo) si la tabla plana resulta difícil de recorrer.
- **Sumar duplicados** (mismo nombre, unidad y proveedor) en el PDF.
- Botones y ítems de menú a **44 px** en móvil (`min-h-11 sm:min-h-8`); hoy son
  `h-8`/`size-8`. Etiquetas con el nombre del material para lectores de pantalla
  (*"Editar Cemento portland"*, *"Más acciones de Cemento portland"*): el
  `aria-label` actual *Cambiar estado* ya no describe el menú.

### P2 — diseñar sin cerrar la puerta

- **Vía de desbloqueo** (gerente) o estado **Anulado**, si el equipo lo necesita.
- **Baja lógica** con `deletedAt`, si se quiere auditoría: obligaría a filtrar
  listados, resumen y actividades.
- `supplier` enlazado al directorio de **Proveedores**.

---

## Restricciones y riesgos

- **Plata:** `estimatedCost` hoy lo ve cualquiera con `material.write`, supervisor
  incluido, aunque la grilla dice que el supervisor no ve plata. Es una
  inconsistencia previa y queda fuera de este alcance; el PDF no la agrava porque
  no lleva costos.
- **Compatibilidad de fixtures:** `editable` obligatorio rompe los fixtures de
  `lib/materials.spec.ts` y los mocks. Se actualizan en el mismo cambio.
- **Safari/iOS:** gesto de usuario al descargar tras `import()` (ver R6).
- **Limpiar `estimatedCost`** exige `$unset` en la API además del `.nullable()`.
- **Regla 13 / permisos:** no se introducen capabilities nuevas; las rutas siguen
  declarando `requireCapability('material.write')`.

## Métricas de éxito

**Indicadores adelantados (2–4 semanas)**

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Materiales editados o eliminados por obra activa | > 0 en la mitad de las obras con ≥ 5 materiales | Conteo de `PATCH` de contenido y `DELETE` exitosos |
| Rechazos `MATERIAL_LOCKED` | < 5 % de los intentos | Logs de la API; un valor alto significa que la UI no comunica el bloqueo |
| Descargas de PDF por semana | ≥ 1 en la mitad de las obras con materiales por comprar | Evento de descarga en la SPA |
| Errores de generación de PDF | < 1 % | Toast de falla / consola |

**Indicadores rezagados (1–3 meses)**

| Métrica | Objetivo |
|---|---|
| Feedback "no se puede corregir" | Cero repeticiones en el seguimiento con usuarios |
| Uso de *Copiar/Compartir* vs PDF | Entender cuál reemplaza a cuál antes de invertir en más formatos |

Hoy no hay analítica de producto conectada: antes de definir los umbrales
definitivos, confirmar qué se puede medir (ver pregunta abierta 4).

---

## Plan de implementación

Orden del repo (shared → api → capa 1 → capa 2 → UI → i18n), en pasos chicos:

| # | Paso | Tamaño |
|---|---|---|
| 1 | **shared:** `isMaterialEditable`, campo `editable`, `MATERIAL_LOCKED`, schemas nullable y specs | S/M |
| 2 | **api:** sacar `try/catch`, `wrap`, guardas atómicas en PATCH y DELETE, DTO, `$unset`, comentarios del modelo, specs | M |
| 3 | **capa 1 y 2:** variante de update sin toast; `onError` que invalida `materials` ante `MATERIAL_LOCKED` | S |
| 4 | **UI edición y borrado:** `MaterialDrawer`, menú de la fila, diálogo de eliminar, línea de ayuda, i18n es/pt | M |
| 5 | **Agrupación por proveedor:** helpers puros en `lib/materials.ts`; *Copiar/Compartir* con proveedor | S |
| 6 | **PDF:** dependencias, generador lazy, botón, i18n, prueba manual en iPhone | M |
| 7 | **E2E + versión:** `pnpm bump:web minor` (0.5.2 → 0.6.0) y `/verify` | S/M |

Los pasos 5–6 (PDF) no dependen de 1–4 (edición): pueden ir en PRs separados.

**Tests**

- *shared:* `utils/material.spec.ts` (tabla de verdad de R1); `schemas/material.spec.ts` con los campos nullable.
- *api:* PATCH de contenido en editable / bloqueado / sólo-estado en bloqueado; carrera (`findOneAndUpdate` → `null` con documento existente → 409, sin documento → 404); DELETE en las tres variantes; el DTO trae `editable`; crear con estado ≠ pendiente setea `statusChangedAt`; `estimatedCost` oculto al cliente.
- *web:* `lib/materials.spec.ts` para agrupar por proveedor (sin proveedor al final, tildes, mayúsculas, `trim`) y las líneas de texto, incluido el orden Pendiente antes que Solicitado y la marca "ya pedido". Se prueba el armado de filas, no jsPDF en jsdom.
- *i18n:* claves nuevas en es y pt (test de paridad).
- *E2E* (`e2e/activities-materials.spec.ts`, ya con `requiresApi()` y su propia cuenta y obra): editar un Pendiente y ver el cambio; marcarlo Solicitado y comprobar que el menú ya no ofrece Editar ni Eliminar; eliminar otro Pendiente; descarga PDF con `page.waitForEvent('download')` y nombre terminando en `.pdf`; sin errores de consola.

## Decisiones tomadas

Cerradas con el dueño del producto el 2026-10-19; ya están reflejadas en los
requisitos.

1. **Volver a Pendiente sigue bloqueado.** Una vez que el material salió de
   Pendiente, no se vuelve a poder editar ni eliminar, aunque se lo regrese a ese
   estado (R1: `status === 'pendiente' && !statusChangedAt`). Corregir algo
   descubierto *después* de solicitar queda para P2 (vía de desbloqueo del gerente
   o estado *Anulado*); hasta entonces la salida es cargar un material nuevo.
2. **El PDF incluye Pendiente y Solicitado, y marca los ya pedidos** (R6). Los
   Solicitado llevan la marca en texto *Ya pedido* y sin casillero; los Pendiente
   van primero dentro de cada proveedor.

## Preguntas abiertas

Ninguna bloquea el inicio.

1. **¿Un material creado directamente como Solicitado/Comprado debe poder corregirse?** *(producto)*
   Hoy el formulario de alta no ofrece el estado, así que en la práctica no
   ocurre; por API queda bloqueado desde el alta.
2. **¿Puede el supervisor eliminar lo que cargó el gerente?** *(producto)*
   `material.write` cubre a ambos. Se dejó así.
3. **¿El PDF muestra la actividad o la fecha de inicio?** *(producto/UX)*
   Se dejó afuera de esta versión: es información interna y alarga el documento.
4. **¿Qué se puede medir hoy?** *(datos)*
   Para definir umbrales reales de las métricas.
5. **Borrado duro o con trazabilidad** *(producto)*: este spec elige duro; si hace
   falta auditoría, pasa a P2 con `deletedAt`.

## Cronograma

Sin fecha dura. Sugerencia de dos entregas: **(A)** pasos 1–4 y 7 (corregir
errores, que es lo que bloquea a la gente hoy) y **(B)** pasos 5–6 (PDF), que puede
salir antes o después sin depender de A.
