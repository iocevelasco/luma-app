# ADR-005: Integración con Google (login, Maps, Calendar, Drive)

**Estado:** Aceptado (2026-11-14), las cuatro entregas. **Implementado el 2026-11-20** en los PR #83 a #87, apilados y pendientes de merge y de la prueba en stage (ver "Implementación"). Se aceptó por primera vez el 2026-11-10; la evaluación de los agentes reabrió login y Maps, y las ocho decisiones que quedaron pendientes se cerraron el 2026-11-14 (ver "Decisiones tomadas").
**Fecha:** 2026-11-10
**Decide:** Producto + quien mantiene `packages/api`

## Contexto

Se pidió integrar los servicios de Google Cloud Platform: login, Maps, Calendar y
Drive. No es una integración sino cuatro, con costos muy distintos:

- **Login, Calendar y Drive** son APIs de cuenta de Google: se usan con OAuth en
  nombre de cada persona. Una cuenta de servicio no sirve para leer el Drive o el
  calendario de un usuario.
- **Maps** es Maps Platform: una clave de API y facturación por uso.
- Lo que más pesa no es el código sino **la verificación de Google**: según el
  scope que se pida, la app pasa sin trámite, pasa por una revisión de semanas, o
  queda obligada a una auditoría de seguridad anual paga.

Lo que hay hoy (leído del código):

- **Google casi no está adentro.** reCAPTCHA figura en la CSP de
  `packages/api/src/index.ts` y en la Política de Privacidad (`legal.page.*`),
  pero la SPA no carga ningún script de Google: ninguna pantalla llama a
  `executeRecaptcha` y producción corre con `SKIP_RECAPTCHA=true`
  (`docs/DEPLOY.md:105-111`).
- **Login**: sólo email + contraseña. Tres lugares emiten sesión en
  `auth.controller.ts` (`login`, `refreshToken`, `setPassword`). `User.password`
  no es obligatorio en el schema.
  - `login` **no mira `email_verified`**: una cuenta sin verificar entra
    (`auth.controller.ts:93-103`).
  - **Las sesiones no vencen ni se revocan**: `refreshToken` emite un refresh
    nuevo de 90 días en cada uso (`:189-190`), `logout` sólo borra la cookie
    (`:202-205`) y `resetPassword` no cierra las sesiones abiertas (`:287-295`).
  - Con `REQUIRE_EMAIL_VERIFICATION=false` las cuentas nacen con
    `email_verified: true` sin haber probado la casilla (`:142`).
  - "Cuenta activada" hoy significa "tiene contraseña": en
    `resendMemberInvitation` (`organization.controller.ts:386-391`), en
    `resendVerification` (`auth.controller.ts:403`) y en el `pending` de Equipo
    (`project.controller.ts:246-249`, `organization.controller.ts:300`).
- **Ubicación**: `Project.location` es texto libre obligatorio y **sólo se escribe
  al crear la obra**: `updateProjectSchema` acepta nada más que los cuatro flags de
  visibilidad (`packages/shared/src/schemas/project.ts:109-114`). No hay
  coordenadas ni ningún mapa en la SPA.
- **Fechas**: `Activity.startDate`/`endDate`, `Milestone.occurredOn` y los
  vencimientos de `PaymentScheduleItem` son días `YYYY-MM-DD`, sin hora. Los
  asistentes de una reunión (`Milestone.attendees`) son nombres, no correos.
- **Archivos**: `ProjectDocument` guarda una `key` del `media-service`
  (`storage.service.ts`, `STORAGE_CONFIG`). Se aceptan sólo PDF, JPEG, PNG y WebP,
  hasta 20 MB (`packages/shared/src/types/document.ts:52-60`).
- **Cabeceras**: `helmet` 8 va con sus valores por defecto salvo la CSP
  (`index.ts:126-163`), o sea `Cross-Origin-Opener-Policy: same-origin` y
  `Referrer-Policy: no-referrer`. La CSP sólo existe en producción; en desarrollo
  la SPA la sirve Vite, sin helmet.
- **ADR-004** (segundo factor por correo) sigue en *Propuesto* y toca el mismo
  login.

## Decisión

**Un proyecto de GCP como base y cuatro entregas independientes, en este orden:
login (§1) → Drive (§4) → Maps (§2) → calendario (§3). En ninguna se guardan
tokens de Google.** Los números de sección identifican cada entrega, no su orden
(el orden cambió el 2026-11-18: Drive pasa antes que Maps y calendario).

Cada entrega es un PR propio y queda deshabilitada si falta su configuración,
igual que `STORAGE_CONFIG`.

### 0. Base común

1. Dos proyectos de GCP: desarrollo y producción. Pantalla de consentimiento
   externa, con el dominio verificado y `/legal` como política de privacidad. El
   pie de la landing ya enlaza a Términos y Privacidad, que es lo que pide la
   verificación de marca. Los orígenes de stage se autorizan en el client id de
   desarrollo.
2. Toda clave pasa por `config/app.config.ts` (`GOOGLE_CONFIG`) y
   `validateConfig()`, con su aviso de "deshabilitado" como storage; en producción
   se carga en Coolify (y se redespliega). Hacen falta: `GOOGLE_GCP_CLIENT_ID`
   (ya está en `.env.example`), la clave de navegador de Maps, y la clave y el
   número de proyecto para el Picker. **No hay client secret**: el flujo de ID
   token no lo usa, y `GOOGLE_GCP_CLIENT_SECRET` se sacó de `.env.example`.
3. **La SPA recibe la configuración de la API, en runtime**, como hoy la
   clave publicable de Stripe (`stripe.service.ts:183,221`), en dos partes
   (separadas el 2026-11-21):
   - `GET /api/public/config`, sin sesión (`skipAuth: true`,
     `QueryKeys.publicConfig`): sólo el client id del login, que las pantallas
     públicas necesitan antes de entrar.
   - `GET /api/config/integrations`, con sesión (`enabled: isAuthenticated`,
     `QueryKeys.integrationsConfig`): las claves de navegador de Maps y Drive.
     Pedir sesión no las vuelve secretas (el registro es abierto, y la de Maps
     va en el iframe del mapa): las protege la restricción por dominio y por
     API, y la cuota (punto 4).
   Cada entrega llega con su dato o `null`, y esa es la única fuente de "entrega
   deshabilitada". No va como build arg `VITE_*`: duplicaría el client id (la
   API lo necesita para validar `aud`, la web para el botón), exige rebuild, y
   el camino de `VITE_RECAPTCHA_SITE_KEY` nunca corrió en producción.
4. **Cuotas diarias y por minuto por API** en Cloud Console: es lo único que
   corta el gasto. El presupuesto con alerta se suma, pero sólo avisa. La
   restricción por dominio de una clave de navegador se falsifica fuera del
   navegador; por eso la cuota.
5. **Cabeceras** (`index.ts`, que es de `packages/api`):
   - `Cross-Origin-Opener-Policy: same-origin-allow-popups`. Con el valor por
     defecto de helmet el popup de Google no puede devolver la credencial.
   - `Referrer-Policy: strict-origin-when-cross-origin`. Con `no-referrer`
     Google no puede comprobar el origen ni la restricción de la clave.
   - CSP con rutas exactas y no comodines (los hosts de Google en `script-src`
     son un vector conocido para saltarse la CSP):
     - Login: `script-src https://accounts.google.com/gsi/client`; `frame-src` y
       `connect-src https://accounts.google.com/gsi/`; `style-src
       https://accounts.google.com/gsi/style`.
     - Maps: `script-src` y `connect-src` de `maps.googleapis.com` y
       `places.googleapis.com`. El iframe del mapa usa `frame-src
       https://www.google.com`, que ya está.
     - Drive: `script-src https://apis.google.com`; `frame-src` de
       `docs.google.com` y `drive.google.com`; `connect-src
       https://www.googleapis.com`.
   - Los orígenes de Maps y Drive se fijan al implementar, partiendo de esta
     lista mínima. Como la CSP no existe en desarrollo, **cada entrega se prueba
     en stage con build de producción**: los E2E no ven nada de esto.
6. Los scripts de Google se cargan a mano, como `lib/stripe-js.ts`, sin paquetes
   npm en la web, y **se precargan al montar la pantalla**, no en el clic: en
   Safari una carga asíncrona entre el clic y el popup hace que el popup se
   bloquee. Detección con `typeof window.google?.accounts?.id?.initialize ===
   'function'`.

### 1. Login con Google

**Cambiado el 2026-11-21 (cuarta ronda):** Google se une solo a la cuenta de
ese correo cuando Google es autoridad sobre él (punto 7). Si la contraseña de esa
cuenta no está probada (`passwordProvenAt`), al unirse se borran la contraseña y
todo token pendiente, y se cierran todas las sesiones; si está probada, se
conserva. Para cualquier otro correo, Google se conecta poniendo la contraseña
una vez. La tabla del punto 6 y los puntos 9 y 12 ya dicen la regla nueva; el
párrafo de abajo es la regla original, que queda como registro.

~~Google nunca se une solo a una cuenta que ya tiene contraseña: se conecta
poniendo esa contraseña una vez. Lo único automático es activar una cuenta
invitada que nunca tuvo contraseña.~~

1. **El botón es el de Google, no un `Button` propio.** El ID token sólo sale del
   botón que dibuja Google (`google.accounts.id.renderButton`, un iframe): no
   acepta tokens ni `cn()`, y su texto es uno de los fijos de Google, traducido
   según `locale` (mapeado desde i18next). Va como excepción explícita en
   `DESIGN.md`: tema `outline`, forma rectangular, alto `large`, y el ancho
   medido de la columna (200 a 400 px; se vuelve a dibujar al cambiar tamaño o
   idioma). Sin One Tap. Va en `/login` (después del "o", antes de los dos CTA),
   en `/register` (debajo del aviso legal) y en `/activate`. No se pide ningún
   scope más allá de `openid email profile`.
2. **`POST /api/auth/google`**, público y **sólo JSON**:
   `{ credential, acceptedTerms? }`. **El mismo botón entra y registra, desde
   `/login` y desde `/register`** (decisión del 2026-11-18): la API no necesita
   saber de qué pantalla viene. Responde el mismo cuerpo que `login`. La emisión de sesión, hoy
   repetida en tres lugares, se extrae a un `issueSession(res, user)` que usen los
   cuatro emisores.
3. **Verificación del ID token** con `google-auth-library` (`verifyIdToken`,
   dependencia nueva de la API; hoy sólo hay `jsonwebtoken`): firma contra las
   claves de Google, `iss` (`accounts.google.com` o
   `https://accounts.google.com`), `aud` igual a nuestro client id, y `exp`.
   Además `email_verified === true`, estricto. El correo se pasa a minúsculas, sin
   normalizar puntos ni `+`, y se compara sólo contra `email`, nunca contra
   `pendingEmail`. `credential` no se loguea.
4. **Lo que se guarda**: `googleSub` en `User` (`select: false`, índice único
   disperso) y `googleEmail`, para mostrar con qué cuenta de Google está
   conectada. La identidad es el `sub`, no el correo. Se quitan con `$unset`,
   nunca con `null` (un índice disperso indexa `null` y el segundo choca). No se
   guarda la foto de Google; el nombre se toma sólo al crear la cuenta.
5. **Antes de cualquier escritura**: una cuenta deshabilitada, inactiva o purgada
   no entra, y una cuenta `admin` no entra con Google (punto 11).
6. **Qué hace la API según lo que encuentra:**

   | Lo que encuentra | Qué hace |
   |---|---|
   | Una cuenta con ese `googleSub` | Abre sesión |
   | Ninguna cuenta con ese correo y `acceptedTerms: true` | Crea la cuenta (punto 8) y abre sesión, venga de `/login` o de `/register` |
   | Ninguna cuenta con ese correo, sin `acceptedTerms` | `GOOGLE_SIGNUP_REQUIRED`, sin crear nada: la pantalla abre `TermsDialog` y reenvía la misma credencial con `acceptedTerms: true` |
   | Una cuenta con ese correo, sin `googleSub`, y Google es autoridad sobre el correo (punto 7) | La une (punto 9) y abre sesión. Si la contraseña no está probada, la borra y cierra las sesiones |
   | Una cuenta con contraseña, y Google no es autoridad sobre el correo | `GOOGLE_LINK_REQUIRED` (`reason: password`), sin tocar la cuenta: Google se conecta con la contraseña (punto 12) |
   | Invitada sin activar cuando Google no es autoridad | `GOOGLE_LINK_REQUIRED` (`reason: invited`): se activa desde el correo |
   | Una cuenta con ese correo y otro `googleSub` | `GOOGLE_LINK_REQUIRED` (`reason: otherGoogle`). Un `googleSub` nunca se pisa |

7. **Google es autoridad sobre un correo** sólo si termina en `@gmail.com` o si
   el token trae `hd` (cuenta de Workspace) y coincide con el dominio del correo.
   Para cualquier otro correo, el `email_verified` de Google no prueba que la
   persona controle hoy esa casilla: no alcanza para activar una cuenta que ya
   existe.
8. **Alta por Google**: un servicio de alta compartido con `register` (usuario,
   Empresa personal, inicio de la prueba y aceptación de Términos), sin
   contraseña. Si un alta quedó a medias, el reintento repara lo que falte
   (`startTrialFor` ya es idempotente). La cuenta nace verificada sólo si Google es
   autoridad sobre el correo; si no, se trata como un registro común y recibe el
   correo de verificación. En las dos pantallas la credencial queda en `useState`
   (nunca en storage ni en la URL) mientras se muestra `TermsDialog`.
   - **Cuenta duplicada.** Crear desde `/login` le abre la puerta a quien ya
     tiene cuenta con otro correo y no se acuerda: entraría con Google y se
     encontraría una cuenta nueva y vacía. Por eso el diálogo de alta muestra el
     correo de Google ("Vas a crear una cuenta nueva con ana@gmail.com") y un
     enlace "¿Ya tienes cuenta con otro correo? Entra con tu contraseña y conecta
     Google". Riesgo aceptado: si igual la crea, queda una cuenta vacía más.
9. **Unir Google a la cuenta del correo** (invitada o con contraseña) es una
   sola operación condicionada a que la cuenta siga sin `googleSub`: guarda
   `googleSub`, marca el correo verificado y limpia `activationLinkHeldBy` y
   `claimedViaLinkBy`. Si la contraseña **no está probada** (`passwordProvenAt`,
   que escriben `resetPassword`, `setPassword` con un enlace que sólo viajó por
   mail, `verifyEmail` y `confirmEmailChange`), además borra la contraseña y los
   tokens pendientes y sube `tokenVersion`. Si está probada, la conserva junto
   con las sesiones. El índice único frena una carrera con otra cuenta
   (`GOOGLE_ALREADY_LINKED`). Los Términos los pide `TermsGate`.
9 bis. **Activar desde `/activate` con el enlace** (2026-11-21): el botón de
   Google de esa pantalla manda la credencial junto con el token de activación
   (`activationToken`). La API activa **esa** cuenta invitada aunque el correo
   de Google sea otro (invitada como `ana@estudio.com`, entra con
   `ana.perez@gmail.com`): el token prueba la casilla y la credencial, el Google.
   Una sola escritura condicionada a que el token siga vigente, sin `googleSub`
   y sin enlace en mano. Si el enlace pasó por manos de quien invitó
   (`activationLinkHeldBy`), el token no prueba nada y no sirve para Google. Si
   ese Google ya es de otra cuenta, `GOOGLE_ALREADY_LINKED`, sin entrar a la
   otra. Una cuenta atada a un enlace en mano (con contraseña) se activa sin esa
   contraseña y con las sesiones cerradas.
10. **"Cuenta activada" pasa a ser "tiene contraseña o `googleSub`"**, en un
    helper único que usen `resendMemberInvitation`, `resendVerification` y el
    `pending` de Equipo. `setPassword` no acepta el token de una cuenta con
    `googleSub`, y lo comprueba en la misma operación en que escribe. Sin esto,
    el dueño de una Empresa puede reenviarle la invitación a una cuenta de Google
    y, si el correo no sale, recibir el enlace y elegirle la contraseña.
11. **Admins**: una cuenta `admin` no tiene `googleSub`. `/google` y
    `/google/link` la rechazan (`GOOGLE_NOT_ALLOWED`), y `seed-admin` quita
    `googleSub` al promover y sube `tokenVersion`, que cierra la sesión que esa
    cuenta hubiera abierto con Google.
12. **Conectar desde la cuenta**: `POST /api/auth/google/link`
    `{ credential, password }`, con sesión. La prueba es la contraseña actual; no
    mira el correo, así que sirve también para quien usa otro correo en Google.
    `GOOGLE_ALREADY_LINKED` si ese `googleSub` ya es de otra cuenta (también
    cuando lo dice el índice único). **Camino corto en `/login`**: tras un
    `GOOGLE_LINK_REQUIRED` con `reason: password` la credencial queda en
    memoria y, si la persona entra
    con su contraseña en ese momento, la misma pantalla conecta Google sin pasar
    por la cuenta.
13. **Desvincular**: `DELETE /api/auth/google/link`, con contraseña y
    `AlertDialog`. Una cuenta sin contraseña no puede
    (`GOOGLE_UNLINK_NEEDS_PASSWORD`).
14. **Recuperar la contraseña desconecta Google.** `resetPassword` quita
    `googleSub` y `googleEmail` y sube `tokenVersion`. Sin esto,
    quien conectó su Google con una contraseña robada sigue entrando después de
    que la dueña la recupere. Consecuencia aceptada: quien sólo entra con Google y
    se crea una contraseña por "Olvidé mi contraseña" tiene que volver a conectar
    Google; la pantalla lo avisa.
15. **Pantalla de cuenta**: `AuthUser` suma `has_password`, `google_linked`,
    `google_email` y `google_available` (falso para admins y cuando la entrega
    está deshabilitada), resueltos por la API como `terms_pending`. Orden de las
    cards: Idioma, Contraseña, Correo, Google, Calendario. Sin contraseña: la card
    de contraseña ofrece "Crear contraseña" (dispara el correo de "Olvidé mi
    contraseña"), y cambiar el correo y desvincular quedan apagados con su
    explicación. `changePassword` y `changeEmail` dejan de responder 404 "Usuario
    no encontrado" a una cuenta sin contraseña (`auth.controller.ts:438-441`,
    `:466-469`).
16. **Errores lanzados**, con `ApiErrorCode` nuevos: `GOOGLE_TOKEN_INVALID`,
    `GOOGLE_EMAIL_NOT_VERIFIED`, `GOOGLE_SIGNUP_REQUIRED`,
    `GOOGLE_LINK_REQUIRED`, `GOOGLE_ALREADY_LINKED`,
    `GOOGLE_UNLINK_NEEDS_PASSWORD`, `GOOGLE_NOT_ALLOWED` y el código genérico de
    "la contraseña no coincide", que nace con el arreglo de `changePassword` y
    `changeEmail` (ver "Visto de paso"). **Ninguno responde 401**, tampoco la contraseña
    incorrecta al conectar o desvincular: el cliente trata un 401 con sesión como
    sesión vencida, renueva, reintenta y la cierra (`api-client.ts:126-147`).
    Cada código lleva su fila en `STATUS_BY_ERROR_CODE` y en `KEY_BY_CODE` y
    `PREFER_OWN_MESSAGE` de la web, en el mismo PR. En `/login` el error de Google
    tiene su propio `role="alert"`, separado del banner de `useLogin`.
17. **Aviso por correo** cada vez que una cuenta queda conectada o desconectada,
    con el correo de Google: "si no fuiste tú, recupera tu contraseña: eso
    desconecta Google". Sale de `EmailService` con `void` y se suma a
    `email-preview.ts`.
18. **Límites**: `/google` comparte `authLimiter` (por IP, sólo en producción) y
    no lleva reCAPTCHA. Conectar y desvincular llevan un límite de intentos por
    cuenta.
19. **Cross-browsing**: si el script no carga, el botón no se dibuja y queda la
    contraseña. El botón de ID token no avisa cuando el popup se bloquea o se
    cierra: no hay nada que mostrar. En un navegador embebido (un enlace abierto
    desde WhatsApp o Instagram) o en una PWA instalada en iOS, Google no completa
    el flujo. En todos los casos el fallback es la contraseña. El modo redirect
    no entra en esta entrega: se suma si usuarios reales lo necesitan.
20. **Purga**: `googleSub` y `googleEmail` se quitan al purgar. No es sólo
    privacidad: la purga cambia el correo, y con el `googleSub` puesto la persona
    no podría volver a registrarse con Google.

### 2. Maps

1. **Autocompletado de dirección con Places API (New)**
   (`AutocompleteSuggestion.fetchAutocompleteSuggestions`), en el alta de obra y
   al editar la ubicación (punto 9). La lista de
   sugerencias es nuestra, sobre el `Input` que ya existe, con la atribución de
   Google que piden sus políticas (otro elemento ajeno para `DESIGN.md`). La
   versión legacy de Places ya no se puede habilitar en un proyecto nuevo.
2. **De Google se guarda sólo el `placeId`**, como campo opcional de `Project`,
   además del texto en `location`. **No se guardan `lat` ni `lng`**: las políticas
   de Places permiten conservarlas 30 días como máximo. El `placeId` se puede
   guardar sin límite, y la dirección que la persona eligió para su propia obra
   queda fuera de la restricción. Las listas de sugerencias no se guardan.
3. Reglas del campo: espera entre teclas y mínimo de caracteres; el texto libre
   siempre se puede enviar; si la persona cambia el texto después de elegir, se
   borra el `placeId` (si no, el mapa apuntaría a otro lado); `Enter` con la lista
   abierta elige y no avanza el paso; en iOS la lista va debajo del campo.
4. **El mapa de la ficha es un iframe de Maps Embed API** con `q=place_id:…`, y
   sólo cuando la obra tiene `placeId`. No tiene costo por uso. **Se carga cuando
   la persona toca "Ver en el mapa"**, no al abrir la ficha: así nada sale hacia
   Google sin una acción suya. Lleva
   `referrerPolicy="strict-origin-when-cross-origin"`, `title` por i18n, al menos
   200 px de lado y el radio un escalón debajo de la card. No se puede teñir con
   la paleta: se acepta, y es claro, que es lo que toca dentro de `.surface-light`.
5. **"Cómo llegar"** es un enlace a `https://www.google.com/maps/dir/?api=1` con
   `destination` y `destination_place_id`, armado con `encodeURIComponent` sobre
   un host fijo. No usa ninguna API.
6. Sin clave, o si el script no carga, el campo es el texto libre de hoy. Crear
   una obra nunca depende de Google.
7. Clave de navegador restringida por dominio y por API (Maps JavaScript, Places
   API (New) y Maps Embed), con su cuota diaria. No hay clave de servidor.
8. **Costo**: sólo se cobran los requests de autocompletado, 10.000 gratis por mes
   y después USD 2,83 por mil. No se llama a Place Details: el `placeId` ya viene
   en la sugerencia.
9. **Editar la ubicación de una obra existente** entra en esta entrega, y sólo la
   ubicación. `updateProjectSchema` suma `location` y `placeId`, que van juntos:
   un texto nuevo sin elegir una sugerencia borra el `placeId`. Lo gobierna
   `project.update`, la capacidad que ya tiene el PATCH de la obra
   (`routes/project.ts:52`), con un formulario en la ficha (`FormShell`). Es lo
   que les da mapa a las obras anteriores: no se completan en lote.
10. Un `placeId` puede quedar viejo con los años. Si pasa, se vuelve a elegir la
    dirección.

### 3. Calendar

1. **Feed ICS de sólo lectura, uno por persona**:
   `GET /api/public/calendar/:token.ics`, sin sesión, montado en `publicRouter`.
   Sirve para Google Calendar, Apple y Outlook, sin OAuth.
2. El token es un secreto de 32 bytes que **se muestra una sola vez, al
   generarlo**. En `User` se guarda su SHA-256 (`calendarFeedTokenHash`,
   `select: false`, índice único disperso) y el feed se busca por ese hash.
   Regenerarlo invalida la URL anterior. Un token inexistente y una cuenta
   inactiva, deshabilitada o purgada responden el mismo 404. El hash se borra al
   dar de baja la cuenta, no sólo al purgar.
3. **El contenido sale de la misma resolución de permisos que el panel.** Lo que
   hoy hace `listProjects` (`project.controller.ts:166-200`: rol con
   `resolveProjectRole`, capacidades con `projectCapabilitiesFor`, estado de la
   suscripción) se extrae a un servicio "mis obras con rol y capacidades" que
   usan el listado y el feed.
   - **Actividades**: sólo con `activity.read` (el `contador` no la tiene). Evento
     de día completo con `DTEND` exclusivo (`endDate` más un día). Las
     `cancelada` no salen.
   - **Reuniones** (`Milestone` de tipo `reunion`): el filtro de audiencia no es
     una capacidad sino parte de la consulta (`milestone.controller.ts:104-107`);
     se extrae a un helper que usen el controller y el feed. Sin asistentes: son
     nombres de terceros.
   - **Vencimientos de cuotas**: sólo con `payment.read` (que ya contempla
     `paymentsVisibleToClient`), sólo las no cobradas (estado calculado con
     `scheduleItemStatus`, nunca guardado) y con un título fijo. `concept` y
     `notes` son texto libre y pueden traer el monto: no se publican.
   - Sin `DESCRIPTION` ni `LOCATION`. Ventana de 30 días atrás a 365 adelante.
   - Las obras archivadas y las de la papelera no salen. Con la suscripción
     vencida el feed sigue: es lectura.
4. **Formato**: texto escapado según RFC 5545, sin retornos de carro ni
   caracteres de control, líneas plegadas a 75 octetos y `UID` estable por
   entidad, generado por el servidor. Un título de actividad con saltos de línea
   no puede meter un evento en el calendario de otra persona.
5. **Rutas con sesión**: `GET /api/calendar/feed` devuelve
   `{ enabled, createdAt }` (`QueryKeys.calendarFeed`); `POST` genera o regenera
   y devuelve la URL absoluta, armada por la API; `DELETE` lo apaga. El idioma de
   los textos fijos viaja en la URL.
6. **Card en la pantalla de cuenta**: la URL en un campo de sólo lectura con
   "Copiar" como clic aparte (copiar solo tras generar falla en Safari), enlaces
   `webcal://` y "Añadir a Google Calendar"; regenerar y apagar con
   `AlertDialog`. La card dice lo que el feed no puede prometer: quien tenga la
   URL lee el calendario, tarda horas en actualizarse, y apagarlo no borra lo que
   el calendario externo ya copió.
7. **Endpoint público**: `Cache-Control: private` con `max-age` y `ETag`, y un
   límite por token (los recolectores de Google comparten IP, así que un límite
   por IP los frena a todos). La defensa contra adivinar la URL es la entropía,
   no el límite. El token queda en los logs de acceso del proxy.
8. Limitación aceptada: Google refresca los feeds cada varias horas y es de una
   sola vía.

### 4. Drive: importar y exportar

Las dos direcciones usan el mismo scope, **`drive.file`**, que permite leer los
archivos que la persona elige y crear archivos nuevos en su Drive. Sigue siendo
un scope no sensible: no hay verificación de Google ni auditoría.

**Importar**

1. "Importar desde Google Drive" entra como una opción más del menú "Add New" del
   gestor de archivos de Documentación, que es el que conoce la carpeta destino.
   Usa el Picker con el scope **`drive.file`**: la app sólo ve el archivo que la
   persona eligió.
2. El token de acceso vive en memoria del navegador, minutos; si el popup falla,
   su `error_callback` termina en un toast. El navegador baja el archivo y lo sube
   como `File` por `documentsApi.create`: la API no cambia.
3. **Sólo entra lo que Documentación acepta hoy**: PDF, JPEG, PNG y WebP, hasta
   20 MB. El Picker se filtra a esos tipos más los documentos nativos de Google, y
   el tamaño se mira en los metadatos antes de bajar. DWG, DOCX y XLSX no entran:
   aceptarlos es ampliar Documentación, y se vuelve a mirar al llegar a esta
   entrega.
4. Los documentos nativos de Google se exportan a PDF. La exportación de Google
   tiene su propio tope, cerca de 10 MB, con su mensaje.
5. Un estado "Importando N de M" visible. Los errores de Drive no son `ApiError`:
   se mapean a claves `document.drive.errors.*` y no pasan por `errorMessage`.
6. Lo importado es una **copia**: un cambio posterior en Drive no llega a Luma.
7. Sigue rigiendo la grilla: importa quien hoy puede subir (`document.write`).
8. Necesita la Picker API habilitada, una clave de navegador que la incluya y el
   número de proyecto de GCP. La clave de Maps no sirve: está restringida a sus
   APIs.
9. El permiso `drive.file` queda en la cuenta de Google de la persona; la ayuda
   dice cómo revocarlo.

**Exportar** (sumado el 2026-11-18)

10. "Guardar en Google Drive" en el menú "…" de cada documento, y sobre una
    selección de varios. Primero el Picker en modo carpeta elige dónde guardar
    (por defecto, "Mi unidad").
11. **Exporta quien puede leer el documento** (`document.read`, la cliente
    incluida si la obra se lo muestra): es lo mismo que descargarlo, sólo que va
    a su Drive en vez de a su disco.
12. El navegador trae el archivo de Luma y lo sube a Drive con la API de
    subida (`www.googleapis.com/upload/drive/v3`, en partes si pasa de 5 MB),
    con el nombre original. A Drive no va nada más que el archivo y su nombre.
    La API de Luma no habla con Google. Si la URL firmada del `media-service` no
    permite leerla desde el navegador (CORS), hace falta un endpoint de la API
    que entregue el archivo con `document.read`: se mira al implementar.
13. Estado "Guardando N de M" y, al terminar, un toast con enlace al archivo en
    Drive. Los errores van a `document.drive.errors.*`, como al importar.
14. Lo exportado es una **copia de la persona**: vive en su Drive, Luma no lo
    sigue, y ni borrar el documento, ni eliminar la obra, ni la purga a los 90
    días lo alcanzan. La Política de Privacidad lo dice en el PR de esta entrega.
15. CSP: el `connect-src` de `www.googleapis.com` ya está en la lista de Drive.

## Opciones consideradas

### Login — cómo se une Google a una cuenta que ya tiene contraseña

**Opción A (elegida el 2026-11-14, reemplazada el 2026-11-21 por la B segura):
sólo con la contraseña.** Entrar con Google a un correo
que ya tiene cuenta con contraseña responde `GOOGLE_LINK_REQUIRED`; la persona
pone su contraseña una vez, en `/login` o en su cuenta, y queda conectada. Lo
único automático es activar una cuenta invitada que nunca tuvo contraseña.

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja: un código de error y el flujo de conectar, que hace falta igual |
| Seguridad | No depende de qué significa `email_verified` en Luma ni de `tokenVersion` |
| Fricción | Quien ya tenía cuenta pone su contraseña una vez |

**Opción B (descartada): vinculación automática por correo** (lo que este ADR
decía al aceptarse). Para que sea segura hace falta todo esto:

- `tokenVersion` (ADR-004) como requisito duro de la entrega 1, no como
  recomendación.
- Una prueba real de la casilla, distinta de `email_verified`: un hecho
  `emailVerifiedAt` que sólo escriben `verifyEmail`, `resetPassword`, el cambio de
  correo confirmado, `setPassword` sin enlace en mano y el propio login con
  Google.
- Sin esa prueba, vincular borra la contraseña, limpia los tokens de
  verificación, de reset y de cambio de correo (`pendingEmail`) y las marcas del
  enlace en mano, y sube `tokenVersion`.
- Sólo cuando Google es autoridad sobre el correo.
- Un hecho `googleAutoLinkBlocked` al desvincular: si no, el próximo "Entrar con
  Google" vuelve a vincular sola la cuenta que alguien desconectó porque le
  robaron el Google.
- Saber si producción corrió alguna vez con `REQUIRE_EMAIL_VERIFICATION=false`.
  Si corrió, toda cuenta existente cuenta como "sin prueba" y su primer login con
  Google le borra la contraseña y le cierra las sesiones.

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta: seis reglas, dos campos más en `User` y una dependencia dura del ADR-004 |
| Seguridad | Buena si se cumplen todas; cada una que falte abre una toma de cuenta |
| Fricción | Ninguna: un clic |

### Login — modo redirect

Con `ux_mode: 'redirect'` Google manda un POST de formulario a una URL del
servidor. Hace falta un endpoint aparte que verifique `g_csrf_token`, deje la
cookie de refresh y redirija; en producción `cors()` rechaza ese `Origin`
(`index.ts:171-179`), y agregar `accounts.google.com` a `ALLOWED_ORIGINS` abriría
CORS con credenciales para toda la API. El alta con Términos en ese modo pide su
propio diseño. Cubre navegadores embebidos y PWA instalada en iOS, donde el popup
no funciona. **No entra en la primera entrega.**

### Login — ID token (elegida) frente a flujo de código con refresh token

El flujo de código sólo hace falta si después se van a llamar APIs de Google
desde el servidor. Con la opción A de Calendar y de Drive no hace falta, y no
guardar tokens saca toda una clase de riesgo.

### Maps — qué mapa va en la ficha

- **Embebido (elegido)**: sin costo, sin JavaScript de Maps en la ficha y
  acepta `place_id`. No se puede teñir.
- **Dinámico**: sin coordenadas guardadas habría que pedirlas en cada apertura de
  ficha (un Place Details más una carga de mapa, los dos de pago pasado el tope
  gratis), y captura el scroll en móvil.
- **Estático**: es una imagen, pero Google recomienda firmar la URL y eso pide un
  secreto de servidor.

### Calendar — Opción A (elegida): feed ICS

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja: un endpoint público, tres rutas, un campo en `User`, una card en la cuenta |
| Verificación de Google | No aplica |
| Alcance | Cualquier calendario, no sólo Google |
| Frescura | Horas; una sola vía |

### Calendar — Opción B: sincronización con la API de Calendar

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta: OAuth con acceso sin conexión, refresh tokens cifrados, reintentos, desconexión, borrado de eventos al salir de una obra |
| Verificación de Google | Scope sensible: revisión de unos 10 días, y tope de 100 usuarios mientras no esté verificada |
| Modelo | Uno nuevo para la conexión (CLAUDE.md pide preguntar antes) |
| Frescura | Inmediata; permite invitar por correo |

**No se descarta**: es el paso siguiente si alguien pide ver los cambios al
instante. `Milestone.attendees` guarda nombres, así que invitar asistentes pide
además otro cambio de modelo.

### Calendar — Opción C: enlace "Añadir a Google Calendar" por evento

Sin API ni tokens, pero un evento a la vez y sin actualizaciones. Sirve como
complemento de A en una reunión, no como reemplazo.

### Drive — Opción A (elegida): importar y exportar con el Picker

Scope no sensible, sin tokens guardados, casi sin backend. La exportación se sumó
el 2026-11-18: cada archivo es una copia que se manda una vez, no una carpeta
sincronizada.

### Drive — Opción B: sincronizar una carpeta de la obra con Drive

Pide un scope restringido: verificación de varias semanas (Google habla de unas
6) más una auditoría de seguridad CASA con un tercero, que se repite cada 12 meses
y cuesta entre USD 500 y 4.500 según el nivel; además, refresh tokens guardados y
un estado de sincronización que mantener.
**Descartada** mientras no haya un pedido concreto que la justifique.

## Análisis de trade-offs

- **Sin tokens guardados.** Es el eje de la decisión: nada que cifrar, nada que
  revocar al dar de baja, nada que se filtre en un dump. El costo es resignar la
  sincronización en tiempo real.
- **Comodidad contra superficie en el login.** Vincular sola una cuenta por su
  correo ahorra poner la contraseña una vez y cuesta seis reglas que tienen que
  cumplirse todas. Con el camino corto de `/login` la diferencia de fricción es
  una contraseña, una sola vez.
- **Conectar pide sólo la contraseña.** Una contraseña robada alcanza para
  conectar un Google ajeno. Se compensa con el aviso por correo y con que
  recuperar la contraseña desconecta Google. La alternativa más fuerte, confirmar
  la conexión desde la casilla, queda para si hace falta.
- **Recuperar la contraseña desconecta Google.** Regla simple y segura a cambio
  de un paso más para quien sólo entraba con Google y quiso sumar una contraseña.
- **URL secreta en el feed.** Quien tiene la URL lee el calendario. Se compensa
  con el hash, la regeneración, y con no publicar montos, descripciones ni
  asistentes.
- **Maps casi no cuesta.** Con el mapa embebido y sin Place Details sólo se pagan
  los requests de autocompletado pasados los 10.000 gratis por mes. El tope real
  es la cuota diaria de la clave, no el presupuesto.
- **Dependencia.** Si Google no responde, login con contraseña, alta de obra y
  subida de archivos siguen andando.

## Consecuencias

- **Más fácil:** entrar sin recordar una contraseña; llegar a la obra; ver las
  fechas en el calendario que la persona ya usa; traer planos que ya están en
  Drive.
- **Más difícil:** un cuarto emisor de sesión, y una cuenta que puede no tener
  contraseña en un código que hoy asume que "sin contraseña" es "sin activar".
- **A revisar:**
  - **ADR-004.** De ese ADR, la entrega 1 necesita `tokenVersion`: lo usan
    `resetPassword` y `seed-admin`. Se hace antes del login, como pieza suelta,
    sin esperar al resto del segundo factor. Tiene que valer también para el
    access token, que hoy dura 7 días: o `isAuthenticated` compara la versión, o
    se acorta `JWT_ACCESS_TTL`. La lista blanca de `type: 'access'` en
    `verifyAccessToken` (hoy sólo rechaza `refresh`, `jwt.service.ts:86`) sigue
    siendo del ADR-004: este ADR no agrega ningún tipo de token propio.
  - **`account-purge.service.ts`.** `googleSub`, `googleEmail` y
    `calendarFeedTokenHash` no terminan en ninguno de los sufijos que el test
    vigila (`account-data.spec.ts:32`): se suman a mano al `$unset` y se agrega un
    caso al test. `placeId` es de la obra y se va con ella.
  - **Política de Privacidad.** Tres textos dejan de ser ciertos
    (`legal.page.sections`): "contraseña" como dato de toda cuenta, la lista de
    proveedores, y la promesa de borrado, que no alcanza a lo que ya se copió a un
    calendario externo. Cambian en el mismo PR que cada entrega. La frase de la
    landing sobre para qué se usan los datos se revisa junto con la Política.
  - **Condiciones de Maps Platform.** Leerlas completas antes de implementar la
    entrega de Maps: este ADR se apoya en la página de políticas de Places, no en el
    contrato.
  - **`DESIGN.md`.** Dos excepciones nuevas: el botón de Google y la atribución de
    Google junto a las sugerencias de dirección.
  - **E2E.** Las cuentas fijas siguen entrando con contraseña. El botón de Google
    es un iframe de otro origen y Playwright no lo recorre: se intercepta
    `https://accounts.google.com/gsi/client` con `page.route` y se devuelve un
    sustituto de `window.google.accounts.id`; lo mismo para Maps y el Picker, y
    `route.abort()` para el caso "el script no carga". Eso cubre la UI, **no** el
    popup real, ni COOP, ni la CSP: esos se prueban a mano en stage. El feed ICS
    se cubre con unit en la API.
  - **Evidencia de PR** (Chromium, con las cuentas fijas):

    | Pantalla | Cuenta o estado | Móvil |
    |---|---|---|
    | `/login` con el botón, el alta con `TermsDialog` y `GOOGLE_LINK_REQUIRED` | sin sesión | sí |
    | `/register` con el botón y `TermsDialog` | sin sesión | sí |
    | Cuenta: cards de Google y Calendario | `user`, `gerente`, `cliente`, y una cuenta sin contraseña simulada | no |
    | Alta de obra, paso 1, con sugerencias y con el fallback a texto | `gerente` | sí |
    | Ficha de obra con mapa y sin mapa | `gerente` y `cliente` | sí |
    | Documentación: importar (sólo quien sube) y "Guardar en Google Drive" | `gerente` y `cliente` | no |

  - **Landing.** Nada obliga a tocarla. Si se menciona el login con Google o el
    calendario, se actualiza a mano en `es` y `pt`.
  - **Números.** Precios y plazos se confirmaron contra la documentación de
    Google el 2026-11-10 (ver "Fuentes"). Cambian: se vuelven a mirar al
    implementar la entrega de Maps. La verificación de marca, que el login necesita
    para mostrar el nombre y el logo, tarda 2 o 3 días hábiles; `drive.file`
    figura como scope no sensible.

## Evaluación por los agentes del proyecto (2026-11-10)

Tres agentes revisaron el ADR ya aceptado, en sólo lectura: `backend`, `frontend`
y `revisor` (con foco en seguridad). Quien coordina verificó en el código y en la
documentación de Google los hallazgos que cambian el diseño. Lo objetivo ya está
corregido arriba; lo que cambiaba el alcance se decidió el 2026-11-14 (ver
"Decisiones tomadas").

**Fallas del texto anterior**

1. **Crítica — el pre-secuestro de cuenta no quedaba cerrado.** El ADR decía
   "hoy una cuenta sin verificar no puede iniciar sesión". Es falso: `login` no
   mira `email_verified`. Alguien registra el correo de la víctima, entra y se
   queda con una sesión que no vence; cuando la víctima entra con Google, la
   vinculación le borraba la contraseña al atacante pero no la sesión.
   (`revisor`, `backend`)
2. **Crítica — con `REQUIRE_EMAIL_VERIFICATION=false` el caso no desaparecía:
   empeoraba.** La cuenta del atacante nace verificada, la regla de borrar la
   contraseña no se dispara y el atacante la conserva. (`revisor`, `backend`)
3. **Alta — una cuenta de Google contaba como "sin activar".** Verificada y sin
   contraseña, el dueño de una Empresa podía reenviarle la invitación y, si el
   correo no salía, recibir el enlace (`utils/activation.ts:17-19`) y elegirle la
   contraseña con `setPassword`, que además la deja como dueño legítimo
   (`auth.controller.ts:333-338`). (`backend`)
4. **Alta — el `email_verified` de Google no prueba el control actual de un
   correo que no es de Gmail ni de Workspace**, y el texto no excluía vincular
   sobre una cuenta que ya tenía otro `googleSub`. (`revisor`)
5. **Alta — "los admins no entran con Google" se podía saltar**: vincular Google,
   ser promovido por `seed-admin` (que sólo cambia el rol,
   `scripts/seed-admin.ts:30-36`) y esperar al siguiente refresh, que lee el rol
   nuevo. (`revisor`)
6. **Alta — conectar con una contraseña robada dejaba una puerta que sobrevivía
   al reset**, y desvincular no se sostenía: el siguiente "Entrar con Google"
   volvía a vincular sola. (`revisor`)
7. **Alta — guardar `lat` y `lng` va contra las políticas de Places**, que
   limitan conservarlas a 30 días. (`backend`, `frontend`)
8. **Alta — la "edición de obra" que el texto daba por hecha no existe.**
   (`backend`, `frontend`)
9. **Alta — faltaban COOP y `Referrer-Policy`**: anda en local y falla en
   producción. Y "el mismo camino que la site key de reCAPTCHA" era un build arg
   que nunca corrió en producción. (`backend`, `frontend`, `revisor`)
10. **Alta — el botón no puede ser un `Button` nuestro**, y una contraseña
    incorrecta al conectar habría cerrado la sesión por responder 401.
    (`frontend`)
11. **Media — la regla de costo del autocompletado estaba mal planteada** (el
    descuento por sesión sólo corre desde el request 13), y **un presupuesto de
    GCP avisa pero no corta el gasto**. (coordinación, `revisor`)
12. **Media — el feed dejaba sin decidir** las actividades canceladas, las obras
    archivadas, las cuotas ya cobradas y el texto libre de las cuotas; "se
    muestra una vez" contradecía "copiar"; y faltaban el escape del ICS y un
    límite que no fuera por IP. (`backend`, `revisor`, `frontend`)
13. **Media — Drive**: el flujo de subida no tiene dónde colgar un botón de
    pantalla, sólo entran cuatro tipos de archivo, y el Picker necesita su propia
    clave. (`frontend`, `backend`)

**Bien resuelto, según los tres:** ID token sin guardar tokens de Google, con la
identidad en `googleSub`; desde `/login` no se crea ninguna cuenta (cambiado el
2026-11-18, ver "Decisiones tomadas"); token del feed
de 32 bytes guardado como hash; la papelera se respeta por el hook de `Project`;
`drive.file` con el token sólo en memoria; Maps sin clave de servidor; la
ubicación de la obra no revela nada nuevo, porque `location` ya la ve todo rol con
`project.read`.

**Lo que nadie pudo comprobar:** si producción o stage corrieron con
`REQUIRE_EMAIL_VERIFICATION=false`; si el proxy guarda logs de acceso con la
ruta; con qué cabeceras sirve los archivos el `media-service`; el comportamiento
real del popup y del Picker en Safari.

## Decisiones tomadas

**Primera ronda (2026-11-10)**

1. **Calendar:** feed ICS. La sincronización con OAuth queda como paso siguiente
   si alguien la pide.
2. **Drive:** sólo importar. *Reemplazado el 2026-11-18: importar y exportar.*
3. **Login:** los admins de plataforma quedan fuera del login con Google. Lo que
   se dijo entonces de cerrar antes todo el alcance del ADR-004 lo reemplaza el
   punto 3 de la segunda ronda.
4. **`LEGAL_VERSION`:** reemplazada por el punto 6 de la segunda ronda. El
   razonamiento de esta ronda estaba invertido.

**Segunda ronda, tras la evaluación de los agentes (2026-11-14)**

Se aprobaron las ocho recomendaciones de quien coordina.

1. **Login — cuenta que ya tiene contraseña:** opción A. Google se conecta
   poniendo la contraseña una vez. No hay vinculación automática, salvo activar
   una cuenta invitada que nunca tuvo contraseña.
2. **Login — modo redirect:** no entra en la primera entrega. Sale con popup y
   la contraseña como fallback; se suma si usuarios reales lo necesitan.
3. **`tokenVersion` antes de la entrega 1**, como pieza suelta del ADR-004, sin
   esperar al resto del segundo factor.
4. **Maps — editar la ubicación de una obra existente:** sí, y sólo la ubicación.
5. **Maps — mapa embebido**, cargado cuando la persona toca "Ver en el mapa".
6. **`LEGAL_VERSION`:** se evalúa en la entrega de Maps, no en la del feed: Maps
   manda a Google la dirección de la obra cuando el gerente la busca, y la IP de
   quien abre el mapa. El texto de la Política se actualiza en ese PR y, con el
   mapa cargado sólo a pedido, la versión no sube. Es un criterio legal: si hay
   asesor, se le consulta antes de ese PR.
7. **`GOOGLE_GCP_CLIENT_SECRET`:** fuera de `.env.example`. Este diseño no usa
   client secret.
8. **Drive — tipos de archivo:** sigue lo que Documentación acepta hoy (PDF e
   imágenes, más los documentos de Google exportados a PDF). Aceptar DWG, DOCX o
   XLSX es ampliar Documentación; se vuelve a mirar al llegar a la entrega de Drive.

**Tercera ronda (2026-11-18)**

1. **Drive:** se puede importar **y exportar**, con el mismo scope
   `drive.file`. Sincronizar sigue descartado.
2. **Login con Google:** el mismo botón entra y registra, también desde
   `/login`. Antes, desde `/login` no se creaba ninguna cuenta.
3. **Orden:** Drive va después del login y antes que Maps y calendario. Drive
   usa el mismo cliente OAuth que el login, así que no suma configuración nueva
   de Google Cloud salvo la Picker API.

**Cuarta ronda (2026-11-21), con el login ya en la demo**

1. **Login — cuenta que ya existe con ese correo: vinculación automática
   segura** (reemplaza la decisión 1 de la segunda ronda). Pedir la contraseña
   frenaba a casi todos los que ya tenían cuenta. Ahora:
   - Se une sola **sólo si Google es autoridad sobre el correo** (`@gmail.com`
     o Workspace del mismo dominio). Para cualquier otro correo, sigue
     `GOOGLE_LINK_REQUIRED` y la contraseña.
   - Al unirse, en una sola operación condicionada a que la cuenta siga sin
     Google, se marca el correo verificado. Si la contraseña **no está
     probada**, además se borran la contraseña, los tokens de reset,
     verificación y cambio de correo, `pendingEmail` y las marcas de enlace en
     mano, y se sube `tokenVersion`, que cierra todas las sesiones: quien
     hubiera registrado antes ese correo con una contraseña suya queda afuera.
   - **Contraseña probada** (`User.passwordProvenAt`, un hecho nuevo): la
     escriben los caminos que prueban la casilla con la contraseña puesta
     (recuperarla, activar con un enlace que sólo viajó por mail, confirmar el
     correo o un cambio de correo). Con ella, la contraseña y las sesiones se
     conservan. Sin este hecho, quien recuperaba la contraseña (que desconecta
     Google, §1.14) y volvía a entrar con Google la perdía otra vez: nunca podía
     tener las dos.
   - Correo de aviso; si se quitó la contraseña, lo dice.
   - Costo aceptado: la primera vez, quien tenía una contraseña sin probar la
     pierde y queda entrando con Google. La que cree después con «Olvidé mi
     contraseña» ya queda probada.
   - Lo que hizo segura esta opción, frente a la B descartada el 2026-11-14:
     `tokenVersion` ya existe (#83), y la prueba de la casilla (`passwordProvenAt`)
     se guarda desde ahora.
   - Avisos: `GOOGLE_LINK_REQUIRED` trae `reason` (`password`, `invited`,
     `otherGoogle`) y cada uno su texto; el de `password` suma «Olvidé mi
     contraseña» (salvo en `/login`, que ya lo tiene). En `/login`, una
     contraseña incorrecta suma "¿Entrabas con Google?", igual para todos para no
     delatar qué cuentas existen.

2. **Login — invitada con otro correo en Google:** desde `/activate`, Google
   activa la invitada del enlace aunque los correos no coincidan (§1.9 bis).
   Antes, una invitada como `ana@estudio.com` que entraba con su Gmail terminaba
   creando una cuenta nueva y vacía, con las obras en la invitada pendiente.

Queda sin saber, y ya no hace falta para este diseño, si producción corrió alguna
vez con `REQUIRE_EMAIL_VERIFICATION=false`. Le importa al ADR-004.

## Acciones

1. [x] Decidir los cuatro puntos iniciales; confirmar precios y plazos.
2. [x] Evaluación de `backend`, `frontend` y `revisor`; correcciones objetivas
   aplicadas a este texto.
3. [x] Cerrar las ocho decisiones que dejó la evaluación (2026-11-14);
   `GOOGLE_GCP_CLIENT_SECRET` fuera de `.env.example`.
4. [x] `tokenVersion` en `User`, con cierre de sesiones al recuperar la
   contraseña (pieza suelta del ADR-004). Va después del arreglo de
   `changePassword`, que toca las mismas funciones. *#83, apilado con el
   arreglo (#80).*
5. [ ] Base — GCP: proyectos, pantalla de consentimiento, dominio verificado,
   cuotas por API y presupuesto con alerta.
6. [x] Base — API: `GOOGLE_CONFIG` con `validateConfig()`,
   `GET /api/public/config`, COOP y `Referrer-Policy` en helmet; variables en
   Coolify. *Código en #84; las variables en Coolify, pendientes.*
7. [x] Login — `shared`: schema de `auth/google`, campos nuevos de
   `AuthUser`, `ApiErrorCode` nuevos con su fila en `STATUS_BY_ERROR_CODE`. *#85.*
8. [x] Login — API: `googleSub` y `googleEmail`, verificación del ID token con
   tests unit, servicio de alta compartido con `register`, `issueSession`,
   activación de invitadas, helper de "cuenta activada", conectar y desvincular
   con su límite, `resetPassword` desconecta Google, `seed-admin`, correo de aviso
   con su entrada en `email-preview.ts`, purga, CSP de login. *#85.*
9. [x] Login — web: `QueryKeys.publicConfig`, capa 1 y capa 2 con
   `skipAuth: true`, botón de Google en `/login`, `/register` y `/activate`,
   alta con `TermsDialog` en las dos pantallas, `GOOGLE_LINK_REQUIRED` con el camino
   corto, cards de la cuenta, `KEY_BY_CODE` y `PREFER_OWN_MESSAGE`, i18n en `es`,
   `es-ES` y `pt`, excepción en `DESIGN.md`, `pnpm bump:web minor`. *#85.*
10. [x] Maps — `shared` y API: `placeId` opcional en `Project` y sus schemas;
    `location` y `placeId` en `updateProjectSchema`; CSP de Maps. *#86.*
11. [x] Maps — web: `lib/google-places.ts` (en vez de `google-maps-js.ts`), autocompletado con lista propia y
    fallback a texto, formulario para editar la ubicación en la ficha, mapa
    embebido a pedido, "Cómo llegar", i18n. *#86.*
12. [x] Calendar — API: `calendarFeedTokenHash`, servicio "mis obras con rol y
    capacidades", helper de audiencia, generador de ICS con tests unit, endpoint
    público con su límite, rutas de estado, generar y apagar, purga y baja. *#87.*
13. [x] Calendar — web: card en la pantalla de cuenta, `QueryKeys.calendarFeed`,
    i18n. *#87.*
14. [x] Drive — base y web: Picker API, clave y número de proyecto; importar
    desde el menú del gestor de archivos, con filtro de tipos y tamaño y
    exportación a PDF; exportar desde el "…" de cada documento y de una
    selección, con el Picker en modo carpeta; estados, errores propios, i18n;
    CSP de Drive; el endpoint de descarga si la URL firmada no permite CORS.
    *#84. No hizo falta un endpoint nuevo: exportar lee los bytes por el de
    archivos de Documentación que ya existía.*
15. [x] Política de Privacidad en cada entrega; `LEGAL_VERSION` en la de Maps.
    *El texto se actualizó en #84, #85, #86 y #87. `LEGAL_VERSION` no subió en
    ninguna: Maps carga el mapa sólo a pedido (decisión 6 de la segunda ronda).
    Si hay asesor, conviene confirmarlo antes de mergear #86.*
16. [ ] Probar cada entrega en stage con build de producción, incluido un iPhone.
17. [x] Documentar en `docs/` y actualizar CLAUDE.md (Auth y Config). *En
    cada PR: `docs/DEPLOY.md`, `.env.example`, `DESIGN.md` y CLAUDE.md.*

## Implementación (2026-11-20)

Cada entrega es un PR contra `stage`. Están apilados porque comparten la
configuración pública, `User` y la pantalla de cuenta: **se mergean en orden**, y
mientras el de abajo no entre, el diff de cada uno incluye a los anteriores.

| Orden | PR | Qué entra | Web |
|---|---|---|---|
| 1 | #80 | Contraseña actual incorrecta: 403 `WRONG_PASSWORD`, sin cerrar la sesión | — |
| 2 | #83 | `tokenVersion`: recuperar la contraseña cierra todas las sesiones | — |
| 3 | #84 | Base común (`GOOGLE_CONFIG`, `/api/public/config`, cabeceras, CSP) y Drive (§4) | 0.38.0 |
| 4 | #85 | Login con Google (§1) | 0.39.0 |
| 5 | #86 | Maps (§2) | 0.40.0 |
| 6 | #87 | Feed de calendario (§3) | 0.41.0 |

Variables: `GOOGLE_GCP_CLIENT_ID` (login y Drive), `GOOGLE_GCP_PICKER_API_KEY` y
`GOOGLE_GCP_PROJECT_NUMBER` (Drive), `GOOGLE_GCP_MAPS_BROWSER_KEY` (Maps). Todas
públicas; sin la suya, cada entrega queda apagada. El feed no suma variables: su
URL sale de `PUBLIC_API_URL`, que en producción es el origen de `APP_URL`.

**Desvíos respecto del texto de arriba**

1. **Maps: REST descartado en la revisión.** La primera versión de #86 llamaba
   a la API REST de Places (New) desde el navegador. La revisión lo frenó: es un
   servicio web, Google pide restringir esas claves por IP, y con la clave
   restringida por dominio podía rechazar cada sugerencia. Quedó lo que decía el
   texto: `AutocompleteSuggestion` del SDK de Maps JS, en `lib/google-places.ts`,
   con el script cargado recién al escribir. La clave necesita Maps JavaScript
   API, Places API (New) y Maps Embed API.
2. **Un código más: `PASSWORD_NOT_SET` (409).** Es lo que responden
   `changePassword` y `changeEmail` a una cuenta que entra sólo con Google, en vez
   del 404 de antes (§1.15). El "la contraseña no coincide" genérico de §1.16 es
   `WRONG_PASSWORD`, que nació en #80.
3. **`GOOGLE_LINK_REQUIRED` trae `details.reason`.** `password`: entrar con la
   contraseña y conectar. `invited`: una invitada sin activar cuando Google no es
   autoridad sobre el correo, que se activa desde el correo de invitación. La UI
   elige el texto por `reason`, sin comparar el mensaje.
4. **Status de los códigos de Google**: `GOOGLE_TOKEN_INVALID` y
   `GOOGLE_EMAIL_NOT_VERIFIED` 400; `GOOGLE_NOT_ALLOWED` 403; los demás 409.
   Ninguno 401, y todos van después del genérico de su status, así
   `errorCodeForStatus` no cambia.
5. **Alta a medias.** En vez de que el reintento repare lo que falte (§1.8),
   `createAccount` (`signup.service.ts`, compartido con `register`) borra el
   usuario si fallan la Empresa o la prueba. El reintento arranca limpio.
6. **`setPassword` condicionado.** Escribe con un `updateOne` que exige
   `googleSub` ausente (§1.10), y además rechaza de entrada un token de una
   cuenta con Google.
7. **El feed se apaga al dar de baja desde el modelo**: los hooks `pre('save')` y
   `pre(update)` de `User` quitan el hash cuando la cuenta pasa a `inactive`, sea
   cual sea el camino que la da de baja. La purga también lo quita.
8. **Detalles del feed que el texto no fijaba**: idiomas `es-ES`, `es-AR` y `pt`
   en `?lang=`; caché privada de 15 minutos con `ETag` y 304; límite de 30 pedidos
   cada 15 minutos por token (por su hash), sólo en producción;
   `X-Robots-Tag: noindex`.
9. **Un solo cargador de scripts de Google** (`lib/google-scripts.ts`), que usan
   el login y Drive: `gsi/client` se pide una vez aunque lo carguen los dos.
10. **E2E**: `routing.spec.ts` responde `/api/public/config` cuando no hay API,
    porque login y registro ahora la piden. El job de E2E en CI quedó en
    `ubuntu-24.04`: `ubuntu-latest` pasó a 26.04 y Playwright no instala
    Chromium ahí (#84).

**Arreglos de la revisión (2026-11-20)**

- #84: cerrar sesión no olvidaba el permiso de Drive, que vive en memoria hasta
  una hora; quien entraba después en la misma pestaña usaba el Drive de la
  persona anterior. `clearSession` ahora llama a `clearDriveToken`.
- #86: el autocompletado pasó al SDK de Maps JS (desvío 1).

**Lo que falta**

- Acción 5: los proyectos de GCP, la pantalla de consentimiento, la Picker API,
  Maps JavaScript API, Places API (New) y Maps Embed habilitadas, las claves restringidas por dominio
  y por API, y las cuotas.
- Cargar las variables en Coolify y redesplegar.
- Acción 16: probar cada entrega en stage con build de producción, incluido un
  iPhone. Ningún flujo real de Google se probó todavía (popup del login, Picker,
  Places, Embed, suscribirse al feed). Se probaron contra una API local con
  credenciales falsas y las respuestas de Google simuladas.
- Con un client id falso, el botón de `/register` mostró "Acceder con Google"
  aunque se le pide `signup_with`: confirmarlo con el client id real.

## Visto de paso, fuera de este ADR

Los agentes encontraron esto en el código actual. No depende de Google.

- ~~**Una contraseña actual mal escrita cierra la sesión.**~~ Arreglado en #80:
  responden 403 `WRONG_PASSWORD`.
- **Se puede entrar sin verificar el correo.** Le importa al ADR-004. ~~Un reset
  de contraseña no cierra las sesiones abiertas~~: lo cierra desde #83.
- `change-password` y `change-email` no tienen límite de intentos
  (`routes/auth.ts:56-57`): con una sesión robada sirven para probar contraseñas.
- `recaptcha.service.ts:75` loguea los primeros 10 caracteres de la clave secreta
  cuando verifica en producción (hoy no corre, por `SKIP_RECAPTCHA=true`).
- `process.env` leído fuera de `config/app.config.ts`: `routes/auth.ts:30`,
  `routes/chat.ts:13`, `routes/advisor.ts:18`, `recaptcha.service.ts:48`.
- La subida de documentos confía en el tipo que declara el navegador, sin mirar
  los bytes (`document.controller.ts:111`).
- `PUBLIC_ROUTE_PREFIXES` incluye `/legal`, que la lista de rutas públicas de
  CLAUDE.md no nombra.

## Fuentes

- Precios de Maps Platform: <https://developers.google.com/maps/billing-and-pricing/overview>
  y <https://developers.google.com/maps/billing-and-pricing/pricing>
- Cambio de marzo de 2025: <https://developers.google.com/maps/billing-and-pricing/march-2025>
- Sesiones del autocompletado: <https://developers.google.com/maps/documentation/places/web-service/session-pricing>
- Políticas de Places (qué se puede guardar): <https://developers.google.com/maps/documentation/places/web-service/policies>
- Maps Embed API: <https://developers.google.com/maps/documentation/embed/embedding-map>
- Autocompletado legacy: <https://developers.google.com/maps/documentation/javascript/legacy/place-autocomplete>
- Google Identity Services, cabeceras y CSP: <https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid>
- Verificar el ID token y cuándo Google es autoridad sobre un correo: <https://developers.google.com/identity/gsi/web/guides/verify-google-id-token>
- Verificación de scopes sensibles: <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>
- Verificación de scopes restringidos y CASA: <https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification>
- Preguntas frecuentes de verificación: <https://support.google.com/cloud/answer/13463817>
- Scopes de Drive: <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
