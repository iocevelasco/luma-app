# Chat — controles de seguridad

Prototipo del chat con **datos simulados** en `/admin/chat-prototipo`
(`packages/web/src/components/chat`, `packages/web/src/lib/chat`). No hay red,
modelo ni credenciales. Este documento dice qué controla el frontend y qué
**queda pendiente en el backend**.

> **La validación del frontend no sustituye a la del servidor.** Mejora la
> experiencia y reduce superficie, pero cualquiera puede llamar a la API sin
> pasar por la UI. Todo lo de la sección "Pendiente de backend" es obligatorio
> antes de conectar un modelo real.

## Qué se hace en el frontend

| Tema | Control | Dónde |
|---|---|---|
| Contenido no confiable | Mensajes, respuestas, historial, títulos, nombres de archivo y URLs se tratan como no confiables. Una respuesta de IA nunca es HTML seguro. | todo |
| XSS | Todo se pinta con el escape de React. Sin `innerHTML`, `dangerouslySetInnerHTML`, `eval` ni `new Function`. Ni regex ni quitar etiquetas. | `chat-conversation.tsx` |
| Markdown | `react-markdown` + `remark-gfm`, **sin `rehype-raw`**: el HTML escrito se ve como texto. Lista cerrada de elementos (`allowedElements`); sin scripts, `on*`, `style`, iframes, formularios ni embebidos. Los componentes propios no reenvían atributos del Markdown. Mismo componente en streaming, al terminar y al restaurar. | `chat-markdown.tsx` |
| Enlaces | `URL` + lista cerrada: sólo `https:`, sin credenciales. `javascript:`, `vbscript:`, `file:`, `data:`, `blob:` y `http:` se bloquean con un estado visible. Siempre `target="_blank" rel="noopener noreferrer"`. | `lib/chat/urls.ts` |
| Imágenes remotas | Sólo HTTPS desde `ALLOWED_REMOTE_IMAGE_ORIGINS`, **hoy vacía**. `referrerPolicy="no-referrer"`. | `lib/chat/limits.ts`, `safe-image.tsx` |
| Imágenes locales | `blob:` sólo si lo creó la app (registro) y se revoca al quitar el adjunto o reiniciar. Miniaturas y visor pasan por el mismo `SafeImage` y vuelven a validar. | `urls.ts`, `safe-image.tsx` |
| Adjuntos | JPEG/PNG/WebP. Se rechazan SVG y HTML. Máx. 4 por mensaje, 5 MB cada uno, 4096 px por lado, 16 Mpx. El formato y las dimensiones salen de **los bytes** (firma y cabecera), no de la extensión, el MIME ni `accept`. | `lib/chat/attachments.ts`, `image-info.ts` |
| Nombres de archivo | Se muestran como texto; se quitan caracteres de control y de dirección y se acota el largo. | `attachments.ts` |
| Copiar, pegar, arrastrar | Copiar escribe el texto original de la respuesta (no el DOM) y avisa si el portapapeles no está. Pegar e arrastrar archivos pasan por `validateAttachments`; texto o URLs arrastrados se ignoran. Enter envía, Shift+Enter salta de línea (no durante IME). | `chat-conversation.tsx` |
| Privacidad | Sin `console.*` con contenido, sin analítica. Los errores son un código traducido, sin stack ni detalles. | `chat-store.ts` |
| Estado | En memoria (`zustand`, sin `persist`). Cerrar el panel conserva la conversación; recargar la borra. Nada en `localStorage`. | `chat-store.ts` |
| Límites | Mensaje de usuario 4000 caracteres; respuesta 20 000; 200 mensajes; Markdown con más de 400 líneas, 60 filas de tabla o 4 imágenes se muestra como texto plano. Un fallo de render cae a texto plano. | `limits.ts`, `content.ts` |
| CSP | No se toca. Si se autoriza un origen de imágenes, hay que agregarlo también a `imgSrc` en `packages/api/src/index.ts`. | — |

## Pendiente de backend

Fuera del alcance de este PR (no hay backend de chat todavía):

1. **Adjuntos**: verificar firma/contenido real (no la extensión ni `Content-Type`),
   re-comprobar cantidad, tamaño y dimensiones, rechazar SVG/HTML, y
   re-codificar o quitar metadatos (EXIF) antes de guardar o reenviar al modelo.
   Servirlos con `Content-Type` fijo, `X-Content-Type-Options: nosniff` y
   `Content-Security-Policy: sandbox`, desde un origen sin cookies.
2. **Límites**: largo de mensaje, tamaño de cuerpo, número de mensajes por
   conversación y tasa por cuenta (rate limit); cortar el stream al tope.
3. **Autorización**: quién puede leer cada conversación e historial; el
   historial restaurado debe venir de la API autenticada, no de un storage del
   cliente.
4. **Salida del modelo**: tratarla como no confiable también en el servidor
   (no reenviarla a otros sistemas como HTML; registrar sólo metadatos).
5. **URLs que el modelo cite**: decidir si el servidor las resuelve o las filtra;
   las imágenes remotas deberían pasar por un proxy propio (evita pixels de
   rastreo y exposición de la IP) en lugar de ampliar la CSP.
6. **Prompt injection** vía adjuntos y datos: el modelo no debe ejecutar
   acciones con efectos sin confirmación de la persona.
7. **Logs y analítica**: sin contenido de mensajes, imágenes, tokens ni URLs con
   datos sensibles; retención y borrado definidos (ver Política de Privacidad
   antes de persistir conversaciones).
8. **Secretos**: claves del proveedor de IA sólo en el servidor
   (`config/app.config.ts`); nunca en el bundle ni en `VITE_*`.

## Pruebas

`pnpm --filter @luma/web test src/lib/chat src/components/chat` cubre: `<script>` y
`onerror`/`onload` sin efecto, protocolos peligrosos bloqueados, HTML/JS en
bloques de código mostrado literal, los mismos controles durante el streaming
(cada prefijo) y al restaurar el historial, visor con las mismas restricciones
que la miniatura, adjuntos no permitidos o grandes rechazados, y Markdown,
tablas, enlaces e imágenes válidos funcionando.
