# ADR-004: Segundo factor por correo (código de un solo uso, OTP)

**Estado:** Propuesto
**Fecha:** 2026-11-10
**Decide:** Producto + quien mantiene `packages/api`

## Contexto

Se pidió sumar autenticación OTP —una contraseña de un solo uso— enviada por
correo, como **segundo factor**: contraseña correcta *y además* un código.

Lo que hay hoy (leído del código):

- `POST /api/auth/login` valida email + contraseña (bcrypt) y emite el par de
  tokens (`generateTokens` + cookie `refresh_token`). Tiene reCAPTCHA y
  `authLimiter` (10 intentos / 15 min **por IP**, sólo en producción).
- Sólo hay **tres** lugares que emiten sesión en `auth.controller.ts`: `login`,
  `refreshToken` (renueva una sesión que ya existe) y `setPassword` (activación
  de cuenta por enlace del correo).
- Los flujos de "esta casilla es tuya" (reset, verificación, cambio de correo)
  guardan un token de 32 bytes en campos `select: false` de `User`, en claro.
- `forgotPassword` responde igual exista o no la cuenta, pero **espera** el envío:
  el tiempo de respuesta delata si la cuenta existe.
- Todos los E2E entran con cuentas fijas (`loginAs`, y `globalSetup` guarda una
  sesión por cuenta). Un segundo factor por correo, que Playwright no puede leer,
  los rompe a todos si se exige a todos.

**Qué protege y qué no.** El código por correo frena el robo de contraseñas *sin*
acceso a la casilla (relleno de credenciales, contraseñas filtradas de otro
sitio). **No** frena a quien controla la casilla: con "Olvidé mi contraseña" el
correo ya es la llave de reset. Es una mejora real pero acotada; si el objetivo es
un factor independiente del correo, es TOTP o passkeys (ver opciones).

## Decisión

**Segundo factor por correo, opcional por cuenta, sin tocar el login de quien no
lo activó.**

1. **Campo `twoFactorEmail: boolean` en `User`** (default `false`). Lo activa cada
   persona desde su cuenta. Nadie queda forzado en esta primera entrega (ver
   "Decisión pendiente" sobre admins).
2. **Login en dos pasos, sin sesión a medias.** Si la contraseña es correcta y la
   cuenta tiene `twoFactorEmail`, `login` **no emite tokens**: responde
   `{ otpRequired: true, challengeToken }` y manda el código por correo.
   - `challengeToken` es un JWT firmado, de 10 min y con `type: 'otp'`, **sin
     `role`**. Hoy `verifyAccessToken` (`jwt.service.ts:86`) sólo rechaza
     `type === 'refresh'` y acepta todo lo demás con la misma clave: un token `otp`
     serviría como access token. Por eso el rechazo va **en `JWTService`, por
     lista blanca** (`verifyAccessToken` exige `type: 'access'`), no en
     `isAuthenticated`. Costo aceptado: invalida los access tokens vivos al
     desplegar. Lleva un `nonce` igual al `otpChallengeId` guardado, así que pedir
     un código nuevo mata el desafío anterior.
3. **Dos endpoints nuevos**, públicos, con `authLimiter`:
   - `POST /api/auth/otp/verify` `{ challengeToken, code }` → mismo cuerpo que
     `login` (`accessToken`, `user`, cookie de refresh).
   - `POST /api/auth/otp/resend` `{ challengeToken }` → código nuevo.
4. **Código de 6 dígitos** (`crypto.randomInt`), **vence a los 10 min**, de un
   solo uso, guardado como **HMAC-SHA256 con secreto del servidor** y comparado con
   `timingSafeEqual`.
5. **Límites**: **5 intentos por código** (al quinto se invalida y hay que volver a
   poner la contraseña), reenvío cada 60 s y **máximo 5 códigos por hora por
   cuenta**, además del límite por IP. Un código de 6 dígitos sólo es seguro con
   pocos intentos: ese tope es la defensa, no el hash. **El contador es atómico**:
   un `findOneAndUpdate` con `{ otpChallengeId: nonce, otpAttempts: { $lt: 5 },
   otpExpiresAt: { $gt: now } }` + `$inc` *antes* de comparar, y el consumo es un
   `$unset` condicionado al hash. El patrón del controller (leer, modificar,
   `save()`) deja pasar N `verify` en paralelo por encima del tope. Esto importa
   porque `authLimiter` sólo corre en producción: fuera de ahí el tope por cuenta
   en la base es la única defensa.
6. **Sólo se pide el código después de validar la contraseña.** Así `login` no
   convierte al correo en un oráculo ni permite spamear casillas ajenas con sólo
   conocer el email. El envío va con `void`: un correo que falla no voltea el login
   ni cambia el tiempo de respuesta.
7. **Activar y desactivar exigen prueba de que el código llega.** Activar: se manda
   un código y sólo al verificarlo queda `twoFactorEmail: true` (evita dejar a
   alguien fuera por un correo que no recibe). Desactivar: contraseña actual +
   código.
8. **`refreshToken` no cambia**: renueva una sesión que ya pasó el segundo factor.
   **`setPassword` (activación por enlace)** hoy da sesión con sólo la casilla. Eso
   equivale a pasar por el reset, pero **no es cierto que una cuenta así no pueda
   tener el factor**: una con `claimedViaLinkBy` ya tiene contraseña y
   `resendVerification` le manda un token de activación. Decisión: si
   `twoFactorEmail` está activo, `setPassword` **no emite sesión** y manda a
   `/login`.
9. **Cambiar o resetear la contraseña** no desactiva el factor. Revisar
   `resetPassword`: hoy no emite sesión, y debe seguir sin hacerlo.
10. **Errores**: se **lanzan** con códigos nuevos de `ApiErrorCode`
    (`OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`); el frontend ramifica
    por `code`. Como `verify` ya exige un desafío firmado tras validar la
    contraseña, distinguir los errores no enumera nada: `OTP_INVALID` (código
    malo), `OTP_EXPIRED` (venció o se consumió) y `OTP_TOO_MANY_ATTEMPTS`. Al
    tocar `login` se pasa a `throw` (hoy devuelve `errMsg(error)` en el 500,
    `auth.controller.ts:112`, y no manda `code` en el 403, `:100`).
11. **Campos en `User`** (`select: false`): `otpCodeHash`, `otpExpiresAt`,
    `otpAttempts`, `otpLastSentAt`, `otpChallengeId`, más el contador de envíos por
    hora. Una fila viva por persona. Ver "Decisión pendiente".

## Opciones consideradas

### Opción A: código por correo como alternativa al login (sin contraseña)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja-media |
| Seguridad | Igual a "Olvidé mi contraseña"; no agrega un factor |
| Fricción | Baja: entra quien no recuerda su contraseña |

**Pros:** ayuda a clientes poco técnicos; sin pre-token.
**Cons:** no es un segundo factor; **descartada** por el pedido.

### Opción B (elegida): segundo factor por correo, opcional por cuenta

| Dimensión | Evaluación |
|---|---|
| Complejidad | Media: login de dos pasos, pre-token, activar/desactivar |
| Costo | Un correo por login, sólo de quien lo activó (Resend, ya integrado) |
| Seguridad | Frena contraseña robada sin acceso a la casilla; no a quien controla la casilla |
| Familiaridad | Alta: patrón de `resetToken` + JWT ya existente |

**Pros:** endurece sin dependencias nuevas; el costo y la fricción los paga quien
lo elige; no cambia nada para el resto.
**Cons:** cambia el contrato de `login` (hay que tocarlo en `shared` y en la UI);
da una seguridad menor a la que parece si la casilla es el eslabón débil;
perder el acceso al correo bloquea la entrada.

### Opción C: TOTP (app autenticadora) o passkeys

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta: alta del secreto, QR, códigos de respaldo, recuperación |
| Seguridad | Alta: independiente de la casilla |
| Fricción | Alta para clientes |

**Pros:** el segundo factor de verdad.
**Cons:** no es "por correo"; la recuperación termina de nuevo en el correo.
**No se descarta como paso siguiente.**

## Análisis de trade-offs

- **Opcional vs obligatorio.** Obligatorio para todos rompe los E2E de todas las
  cuentas fijas y le suma un correo a cada entrada de clientes que entran poco.
  Opcional entrega la mejora a quien la quiere y se puede forzar después donde más
  duele (admins de plataforma, que ven cobros de suscripción).
- **Pre-token vs sesión parcial.** Un JWT de propósito único evita una sesión "a
  medias" que algún middleware confunda con una completa. El costo: hay que
  asegurarse de que `isAuthenticated` rechace ese `purpose`.
- **Hash vs claro.** Un hash de 6 dígitos se rompe offline al instante si la base
  se filtra: no es la defensa. Se hashea igual para no dejar un código usable a la
  vista en un dump o un log.
- **Campos en `User` vs colección nueva.** Campos, por coherencia con `resetToken`
  y porque no hay una entidad de negocio nueva. El costo: `User` crece.

## Consecuencias

- **Más fácil:** cerrar el relleno de credenciales para quien lo activa.
- **Más difícil:** `login` ya no siempre devuelve una sesión; la UI debe manejar el
  paso del código. Sin códigos de respaldo en esta entrega, quien pierde la casilla
  no entra (la recuperación hoy ya depende del correo).
- **A revisar:**
  - `account-purge.service.ts`: el test (`account-data.spec.ts:32`) sólo atrapa
    nombres que terminan en `email|phone|picture|bank|…`; **ni `otp*` ni
    `twoFactorEmail` lo disparan**, así que no va a avisar. El borrado se suma a
    mano al `$unset` (`account-purge.service.ts:275-287`) y se agrega un caso al
    test. Los `otp*` también se borran al verificar con éxito.
  - **E2E**: Playwright no lee casillas. Con el factor opcional, las cuentas fijas
    no lo tienen y nada cambia. Para cubrir el flujo hace falta un mecanismo de
    captura de correo en no-producción; **no** un código fijo en la config ni una
    excepción por dominio `@luma.test` (cualquiera podría registrarse con él).
  - Un E2E del flujo completo necesita una cuenta fija nueva (`twofactor`) en
    `e2e/fixtures/users.json` y `E2EUserKey`.
  - `LEGAL_VERSION` **no** sube: no cambia derechos ni obligaciones.

## Evaluación por los agentes del proyecto (2026-11-10)

Tres agentes revisaron este ADR: `criterio` (producto), `revisor` (diseño técnico
contra el código) y `frontend` (diseño de la UI). Lo objetivo ya está corregido
arriba. Lo que sigue son hallazgos que **cambian el alcance** y esperan decisión.

**Producto (`criterio`)** — veredicto: implementarlo **recortado**.
- **El agujero mayor son las sesiones, no el login.** El refresh dura 90 días, no
  tiene estado y `logout` sólo borra la cookie (`auth.controller.ts:202`); no hay
  `tokenVersion` ni `passwordChangedAt`. Quien ya robó una sesión sigue adentro
  aunque la víctima cambie la contraseña y active el factor. El `revisor` lo
  confirma y suma que `changeEmail` (`:457`) sólo pide la contraseña: desde esa
  sesión se lleva el correo y con él el factor. Sin `tokenVersion` (sube al
  cambiar/resetear contraseña, respalda "cerrar sesión en todos los dispositivos")
  el factor protege la puerta y deja la ventana abierta.
- **Opcional casi no se adopta.** Se espera un dígito bajo de adopción en B2B;
  clientes y supervisores, cero. El costo (contrato de `login` bifurcado, campos
  en `User`, pantalla, tres idiomas) es permanente.
- **Más barato contra relleno de credenciales:** un límite de intentos **por
  cuenta** en `login`; `authLimiter` es por IP y rota.
- **Admins sí y ya:** pocas cuentas, por seed, aprueban pagos en bolívares y USDT.
  Propuesta: `OTP_REQUIRED_FOR_ADMIN` en `app.config.ts` (prendido en producción,
  apagado donde corren los E2E; es config de entorno, no excepción por dominio).
  Al ser forzado desaparecen activar/desactivar y su UI.
- **Salida de soporte:** quién apaga el factor de alguien. Para admins alcanza un
  script, como `seed:admin`.
- **Menor:** enviar con `void` en `forgotPassword` (tiempo de respuesta) estaba en
  el Contexto pero no en las Acciones.

**Frontend (`frontend`)**
- HeroUI v3 no tiene InputOTP. `components/ui/input-otp.tsx` (shadcn) existe sin
  importadores y el doc de migración lo marca "borrar antes de migrar": **no
  revivirlo**. Un único `<Input>` con `inputMode="numeric"`,
  `autoComplete="one-time-code"`, `maxLength=6`, `font-mono tracking-widest` y
  `font-size >= 16px` (sin zoom en iOS) es más simple y robusto.
- Va **dentro de `/login`** (`AuthSplitLayout`), sin ruta nueva: `LoginPage` usa su
  propio `<form>` con banner inline, no `FormShell`; se sigue esa convención.
  Título "Revisa tu correo" con el correo enmascarado, `aria-live="polite"`,
  `autoFocus`, foco devuelto al campo tras un error.
- Estados: enviando; `OTP_INVALID` (banner `role="alert"`, campo limpio);
  `OTP_EXPIRED` (ofrece reenviar); `OTP_TOO_MANY_ATTEMPTS` (vuelve a la
  contraseña); reenvío con cuenta regresiva de 60 s calculada con timestamp y
  `Date.now()`, no con un contador de `setInterval` (Safari en segundo plano lo
  desfasa).
- Capas: `login` devuelve `AuthResponse | OtpChallenge` discriminado por
  `otpRequired` (tipo en `shared`); `useLogin.onSuccess` ramifica con un type
  guard y **no** llama a `login()` ni navega si hay desafío; `verifyOtp` y
  `resendOtp` con `skipAuth: true`. El `challengeToken` vive en `useState`, nunca
  en storage ni URL. La API debe responder los `OTP_*` con 400, no 401, para no
  disparar el redirect.
- `KEY_BY_CODE` en `lib/error-message.ts` es `Record<ApiErrorCode, string>`: los
  tres códigos nuevos rompen el typecheck hasta agregarlos, con sus claves
  `errors.otp*` (y a `PREFER_OWN_MESSAGE`).
- Activar/desactivar (sólo si sigue opcional): card en
  `pages/account-settings.tsx` con `FormShell variant="embedded"`, como cambiar
  contraseña; desactivar es destructivo y lleva `AlertDialog`.
- Los textos que prometen algo ("vence en 10 min", "5 intentos") tienen su valor en
  la API: o la respuesta los trae, o la UI los hardcodea y se desincroniza.
- i18n en `es`, `es-ES` y `pt`: `auth.otp.*`, `errors.otp*` y, si hay opt-in,
  `auth.account.twoFactor.*`.
- Evidencia de PR (Chromium; móvil para `/login`): `/login` paso del código con un
  estado de error y uno de reenvío; `/login` sin factor con `user` para mostrar
  que no cambió; la cuenta con `user`, `gerente` y `cliente` si hay opt-in.
  Mientras no haya captura de correo, el E2E mockea con `page.route` (cubre la UI,
  no la API).

## Decisión pendiente (necesito tu OK antes de implementar)

0. **Alcance.** Elegiste opcional por cuenta; `criterio` recomienda recortar a
   **`tokenVersion` + cierre global de sesiones + límite por cuenta en `login` +
   OTP obligatorio sólo para `admin` por config**, y dejar el opt-in para cuando
   alguien lo pida. Los puntos 1 a 3 de abajo dependen de esto. Si se recorta, el
   ADR se reescribe: desaparecen activar/desactivar y su UI.
   **2026-11-14:** de este punto ya está aprobada una pieza, por el ADR-005
   (segunda ronda, punto 3): `tokenVersion` se hace antes del login con Google,
   sin esperar al resto. El resto del alcance sigue pendiente.
2. **¿Códigos de respaldo?** Recomiendo no en v1: es más superficie, y la
   recuperación ya pasa por el correo.
3. **¿Campos en `User` o colección propia (`LoginCode`)?** Recomiendo campos; una
   colección nueva es un modelo nuevo y CLAUDE.md pide preguntar antes.

## Acciones

1. [ ] Decidir los tres puntos pendientes; pasar el ADR a *Aceptado*.
2. [ ] `packages/shared`: nueva forma de respuesta de `login`
   (`otpRequired` + `challengeToken`), schemas Zod de `otp/verify` y `otp/resend`,
   `ApiErrorCode` nuevos; buildear shared.
3. [ ] API: campos en `User`; `otp.service.ts` (generar, hashear, verificar,
   invalidar, topes) con tests unit; `login` bifurca según `twoFactorEmail`;
   `isAuthenticated` rechaza el `purpose: 'otp'`; controller que **lanza**;
   config en `app.config.ts` (`OTP_SECRET`, TTL, topes) validada por
   `validateConfig()`.
4. [ ] `EmailService.sendLoginCodeEmail` con `email-layout.ts` (código grande,
   vence en 10 min, "si no fuiste tú, cambia tu contraseña") y entrada en
   `email-preview.ts`.
5. [ ] Activar/desactivar: endpoints autenticados, en la pantalla de cuenta.
6. [ ] Purga: `otp*` y `twoFactorEmail` en `account-purge.service.ts`.
7. [ ] Web: capa 1 (`src/api/auth.ts`), capa 2 (`useMutation`), paso del código en
   `/login` (sin ruta nueva), pantalla de activación en cuenta, i18n en `es`,
   `es-ES` y `pt`, `pnpm bump:web minor`.
8. [ ] Cuenta fija `twofactor` y E2E del flujo, cuando haya captura de correo.
9. [ ] Documentar el flujo en `docs/` y actualizar CLAUDE.md (sección Auth).
10. [ ] `JWTService.verifyAccessToken` por lista blanca (`type: 'access'`).
11. [ ] `tokenVersion` en `User` + cierre de sesión global, y decidir si
    `changeEmail` exige el código cuando el factor está activo.
12. [ ] Contador de intentos atómico (`findOneAndUpdate`) y consumo atómico.
13. [ ] `forgotPassword` envía con `void`; `login` pasa a `throw`.
14. [ ] `KEY_BY_CODE` y claves `errors.otp*` en la web.
15. [ ] Salida de soporte para apagar el factor de una cuenta (script).
