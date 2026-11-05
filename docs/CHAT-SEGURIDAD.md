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

## Conexión con NexusBot

El botón flotante del panel (`LiveChat`, en `DashboardLayout`) reemplazó al widget
de NexusBot. El prototipo de `/admin/chat-prototipo` sigue con datos simulados y
su propio store: no comparten conversación.

```
navegador ──POST /api/chat/session──▶ API de Luma ──X-API-KEY──▶ NexusBot /api/v1/sessions
    │            { conversationId }        (sin correo, sin cuerpo de NexusBot)
    │◀── { sessionToken, expiresAt } ──────┘
    └──POST /api/v1/chat/stream  (Bearer sessionToken, SSE, sin cookies) ──▶ NexusBot
```

- **La clave de NexusBot no sale de la API.** El navegador sólo recibe un token
  efímero, que vive en memoria (nada en `localStorage`).
- **Una conversación = una sesión.** `conversationId` lo genera el navegador;
  "Nueva conversación" pide otra sesión, así que NexusBot (que guarda memoria por
  sesión) tampoco recuerda lo anterior.
- **Token vencido:** se renueva 30 s antes de vencer y, si NexusBot responde
  `token_expired` antes de contestar, se pide uno nuevo y se reintenta una vez
  (nunca si ya se mostró texto).
- **Errores por código, nunca por texto.** Los códigos de NexusBot
  (`rate_limited`, `token_expired`, `origin_not_allowed`, `llm_error`…) se
  reducen a un mensaje propio y traducido. El mensaje del servidor no llega a la UI
  ni a la consola. La API de Luma tampoco reenvía su cuerpo: responde en el sobre
  estándar y un fallo de NexusBot es un 503 propio.
- **Privacidad:** la sesión se abre con metadata vacía. Antes viajaba el correo de
  la persona, que NexusBot guarda y mete en el prompt que va al proveedor del
  modelo. Las sesiones ya creadas conservan el correo hasta que se reemplace su
  metadata; las nuevas no lo llevan.
- **Sin adjuntos:** NexusBot sólo recibe texto (`deepseek-chat`). En modo real no
  hay botones, pegado ni arrastre de imágenes; un archivo soltado se frena para que
  el navegador no navegue a él. Se activan con `capabilities.attachments` cuando
  haya soporte.
- **CSP más estricta:** ya no se carga ningún script de NexusBot, así que su origen
  salió de `scriptSrc`. Queda sólo en `connectSrc`, para el stream.
- **Límite de sesiones:** `/api/chat/session` tiene rate limit por IP en producción
  (30 cada 15 min).

### Pendiente en NexusBot (repo aparte, no se tocó acá)

1. **Rate limit por tenant, por sesión y por mensaje** en `/sessions` y
   `/chat/stream` (hoy sólo lo tiene el admin). Es lo que protege el gasto del modelo.
2. **Historial:** un `GET` con el Bearer de sesión para restaurar conversaciones. Sin
   él, `restoreHistory` sólo se usa con datos simulados.
3. **Adjuntos:** requeriría un modelo con visión y un endpoint que reciba imágenes
   (y que verifique su contenido real, como en "Pendiente de backend").
4. **CORS:** el origen de la SPA (producción y `http://localhost:6173`) tiene que
   estar en `allowedOrigins` del proyecto `luma`; si no, el stream falla.
5. **Memoria de sesión:** `userMetadata` se reemplaza sólo si se manda; para limpiar
   el correo de sesiones viejas hay que reenviarlas con `{}` o borrarlas.
6. **Pruebas automáticas** del backend de NexusBot: hoy no hay ninguna en el repo.

## Pruebas

`pnpm --filter @luma/web test src/lib/chat src/components/chat` cubre: `<script>` y
`onerror`/`onload` sin efecto, protocolos peligrosos bloqueados, HTML/JS en
bloques de código mostrado literal, los mismos controles durante el streaming
(cada prefijo) y al restaurar el historial, visor con las mismas restricciones
que la miniatura, adjuntos no permitidos o grandes rechazados, y Markdown,
tablas, enlaces e imágenes válidos funcionando.

### Alcance del asistente (qué contesta y qué no)

Que el chat **no escriba código ni hable de temas ajenos** lo decide el prompt y
el modelo, no el frontend. Se mide con `pnpm --filter @luma/api chat:scope`, que
hace lo mismo que el navegador (login → `/api/chat/session` → stream de NexusBot)
con 26 preguntas, cada una en una conversación nueva:

| Categoría | Qué exige |
|---|---|
| `in-scope` | Contesta con los nombres de pantallas y reglas de Luma |
| `off-scope-code` | Rechaza, vuelve a Luma y no trae ni una línea de código |
| `off-scope-other` | Rechaza un tema ajeno (deportes, recetas, traducción, poemas) |
| `injection` | "Ignora tus reglas", DAN, "soy el desarrollador", pedir el prompt, HTML hostil |
| `honesty` | No inventa cifras, avance ni pantallas de la obra de la persona |

- **Hace falta un modelo real** detrás de NexusBot. Con el modelo simulado de las
  pruebas locales casi todo da rojo, y eso sirve de control negativo.
- **Contra un NexusBot real:** `NEXUSBOT_API_KEY=… pnpm --filter @luma/api
  chat:scope --direct --nexus https://…` abre la sesión directo en NexusBot con la
  clave del proyecto, sin pasar por Luma ni por una cuenta. Cada pregunta queda
  guardada en ese NexusBot y gasta modelo: mejor un proyecto de pruebas que el
  de producción.
- **Sin clave de proyecto:** `NEXUSBOT_SESSION_TOKEN=… … --nexus https://… --delay 1500`
  usa el token de una sesión abierta en el navegador (vence en una hora). Todas las
  preguntas comparten esa sesión y NexusBot recuerda las últimas diez, así que una
  respuesta puede influir en la siguiente: es una estimación, no una medición limpia.
- `--repeat N` repite cada pregunta (el modelo no es determinista), `--only
  <categoría>` corre una sola, `--fixture <clave>` cambia la cuenta de
  `e2e/fixtures/users.json`.
- Los evaluadores son puros y tienen pruebas propias que corren en CI sin modelo
  (`src/scripts/chat-scope/graders.spec.ts`), junto con el contrato del prompt.
  Tres reglas siguen como `it.todo` porque el prompt todavía no las dice: no
  escribir código, no revelar sus instrucciones y no cambiar de conducta ante un
  "ignora lo anterior".
