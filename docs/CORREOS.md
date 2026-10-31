# Correos

Luma manda sus correos con [Resend](https://resend.com). Todo pasa por
`packages/api/src/services/email.service.ts`, con una sola plantilla
(`email-layout.ts`) que sigue los colores del sistema: la franja negra con el
nombre, como el header de la app; la tarjeta blanca y el botón verde
`#00d992` con texto `#101010`.

Sin `RESEND_API_KEY` no se envía nada y la app sigue andando: ningún correo
que falla puede voltear la acción que lo disparó (un registro, una invitación,
un aviso).

---

## 1. Qué correos hay

| Correo | A quién | Cuándo |
|---|---|---|
| Confirmá tu correo | quien se registra | al registrarse (si `REQUIRE_EMAIL_VERIFICATION` no es `false`) o al pedir que se reenvíe |
| Activá tu cuenta | alguien que no tenía cuenta | lo invitan a una obra o al equipo de una Empresa. Dice quién invitó, a qué y con qué rol |
| Te sumaron a una obra | alguien que ya tenía cuenta | lo invitan a una obra |
| Te sumaron a un equipo | alguien que ya tenía cuenta | lo suman al equipo de una Empresa |
| Hay una actividad para revisar | el gerente | alguien reporta terminada una actividad |
| Se reportó una eventualidad | el gerente | un supervisor reporta una eventualidad |
| Hay novedades de tu obra | el cliente | se publica un hito para el cliente |
| Restablecé tu contraseña | quien la olvidó | «Olvidé mi contraseña» |
| Confirmá tu nuevo correo | la dirección nueva | cambio de correo desde el perfil |
| Avisos de la suscripción | el dueño de la Empresa (y el admin de la plataforma, para revisar pagos) | ver `docs/SUSCRIPCION.md`, sección de mails |
| Campaña | las cuentas activas, con el correo confirmado y sin baja | el admin la envía desde `/plataforma/campanas`. Es el único correo con enlace de baja (`marketing_opt_out`); la imagen la sirve la API en `/api/public/campaigns/:id/image` |

Los avisos de obra (actividad para revisar, eventualidad, hito) son además
avisos de la campanita. Sólo esos tres van por mail: el resto (actividad
iniciada o cumplida) queda en la app, porque un correo por cada cambio de
estado enseña a mandarlos a spam. Quién recibe cada uno está en
`EMAIL_AUDIENCE` (`notification-email.service.ts`). Sólo se manda a cuentas
activas y con el correo confirmado, y nunca a quien hizo la acción.

## 2. Configurar Resend (producción)

1. Crear la cuenta en resend.com.
2. **Domains → Add domain** con el dominio desde el que salen los correos
   (por ejemplo `luma.app`, o un subdominio como `mail.luma.app`). Cargar en
   el DNS los registros que muestra Resend (SPF y DKIM, y opcionalmente
   DMARC) y esperar a que quede **Verified**.
3. **API Keys → Create API key** con permiso *Sending access*.
4. Variables de la API:

   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=Luma <no-responder@luma.app>
   APP_NAME=Luma
   ```

   `EMAIL_FROM` tiene que ser de ese dominio verificado. Sin dominio propio
   (`onboarding@resend.dev`, el valor por defecto) Resend **sólo entrega a la
   casilla del dueño de la cuenta**: sirve para probar, no para usuarios.

5. Reiniciar la API. Al arrancar dice `Cliente de Resend inicializado` cuando
   manda el primero; si un correo no sale, el error de Resend queda en el log
   (`Resend rechazó el …`).

## 3. En local

- **Sin `RESEND_API_KEY`**: los correos no salen, pero la consola de la API
  los muestra (asunto y texto, con el enlace). Así se confirma una cuenta o
  se acepta una invitación en local: copiar el enlace de la consola.
- **Con `RESEND_API_KEY` y `EMAIL_FROM=onboarding@resend.dev`**: llegan de
  verdad, pero sólo a la casilla con la que creaste la cuenta de Resend.
- **Ver el diseño de todos los correos**:

  ```bash
  pnpm --filter @luma/api email:preview
  ```

  Guarda cada correo, con datos de ejemplo, como `.html` en
  `packages/api/email-previews/` (ignorada por git). No toca la base ni
  manda nada.

## 4. Agregar un correo nuevo

1. Un método en `EmailService` que use `layout()`: `heading`, `preheader`
   (lo que se ve en la bandeja al lado del asunto), `bodyHtml`, y si hace
   falta `details` (la caja gris de datos), `cta`, `note` y
   `showFallbackLink` (el enlace escrito, para correos con token).
2. Todo texto que viene de la base va con `escapeHtml()`.
3. Devuelve `boolean` y nunca lanza. Quien lo llama no lo espera si no
   necesita saber si salió (`void EmailService.…`).
4. Sumarlo a `src/scripts/email-preview.ts` y a la tabla de arriba.
