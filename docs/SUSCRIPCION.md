# Suscripción — guía y datos de prueba

Cómo cobra Luma, cómo levantarlo en local y cómo recorrer a mano los dos flujos
de pago: **tarjeta** (Stripe) y **bolívares** (Pago Móvil o transferencia, con
aprobación manual de un admin).

- Las reglas viven en código, con tests: `packages/shared/src/billing/index.ts`.
  Si algo de acá contradice ese archivo, manda el archivo.
- Despliegue y variables de producción: `docs/DEPLOY.md`.

> **Hoy la tarjeta está apagada.** Se ofrece sólo con la clave de producción
> de Stripe (`sk_live_`); hasta entonces se cobra sólo en bolívares. Al
> prenderla, volver a mencionar la tarjeta en la landing (`pricing.perks` y la
> primera pregunta de `faq`, en `es` y `pt`).

---

## 1. Los planes

| | Gratis | Pro |
|---|---|---|
| Precio | $0 durante 30 días | **$39 por mes** |
| Obras activas | hasta 3 | 3 incluidas + **$8 por mes** cada obra extra |
| Al terminar | la cuenta queda en sólo lectura | se renueva cada mes |

- **El plan Gratis arranca solo**: al registrarse, o —si la persona entró
  invitada a la obra de otro— cuando crea su primera obra propia. Sin tarjeta.
- **Paga el dueño de la Empresa.** Supervisores, contables y clientes
  invitados no pagan nada.
- **Pasar a Pro se puede en cualquier momento** desde *Mi cuenta → Suscripción*:
  - **Desde hoy**: Pro ya, sin límite de obras. Los días gratis que quedan se pierden.
  - **Cuando termine el plan Gratis**: deja el pago hecho y no pierde ningún día.
- **La cuarta obra durante el plan Gratis** abre el pase a Pro "desde hoy", y
  cobra el plan y esa cuarta obra juntos ($47), sin prorrateo.
- **Una obra extra creada a mitad de mes** se cobra por los días que quedaban,
  en la renovación siguiente. **Archivar una obra no devuelve días**, y el
  lugar que deja ya está pago: si en ese mismo mes se crea otra, no se cobra.
- **Vencida = sólo lectura** para todos los que entran a esas obras. Nunca se
  borra nada; al pagar se vuelve a editar.
- **Un pago en Bs pendiente o un cobro de tarjeta fallido** mantienen el acceso
  completo **72 horas**.

### Estados

| Estado (código) | Se muestra como | Puede editar |
|---|---|---|
| `sin_iniciar` | — (todavía sin obras propias) | sí |
| `prueba` | **Gratis** | sí, hasta 3 obras |
| `activa` | **Pro** | sí |
| `en_revision` | Pago en revisión | sí, 72 h |
| `pago_fallido` | Cobro fallido | sí, 72 h |
| `vencida` | Vencida | **no**, sólo lectura |

El estado **no se guarda**: se calcula siempre de los hechos (cuándo empezó la
prueba, qué pagos se aprobaron, qué informó Stripe).

---

## 2. Preparar el entorno local

### 2.1 Variables en `packages/api/.env`

Pegá esto (son **datos de prueba**, no cuentas reales):

```bash
# Pago en bolívares: dónde "se recibe". Sin estas variables la opción de
# pagar en Bs NO aparece en la app.
PAGO_MOVIL_BANK=Banesco
PAGO_MOVIL_PHONE=0414-1234567
PAGO_MOVIL_ID=J-50000000-1
TRANSFER_BANK=Banco de Venezuela
TRANSFER_ACCOUNT=0102-0000-11-2222222222
TRANSFER_HOLDER=Luma Pruebas C.A.
TRANSFER_ID=J-50000000-1

# Pago con tarjeta: las claves del sandbox de Stripe (Developers → API keys).
STRIPE_SECRET_KEY=sk_test_...
# Con una clave de prueba la tarjeta está apagada (sólo se ofrece con sk_live_).
# Esto la prende para probar en local. Nunca en producción.
STRIPE_TEST_MODE=true
# Con la publishable el pago se abre en un modal; sin ella, va a la página de Stripe.
STRIPE_PUBLISHABLE_KEY=pk_test_...
# Lo imprime `stripe listen` (ver 2.4). Sin él, el pago con tarjeta se hace
# en Stripe pero la app no se entera.
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Reiniciá la API después de tocar el `.env`.** `tsx watch` recarga cuando
> cambia el código, no cuando cambia el `.env`.

Con `MEDIA_SERVICE_URL` y `MEDIA_SERVICE_API_KEY` configurados, el
**comprobante es obligatorio** en el pago en Bs y se sube al media-service de
verdad. Sin ellos se puede mandar sin comprobante (sólo para probar en local).

### 2.2 Tasa BCV

La API scrapea la home del BCV al arrancar y cada hora, y guarda la tasa con
su fecha valor. El pago lee siempre esa fila: si la página o el scrap fallan,
sigue la última guardada. El error "No tenemos una tasa BCV actualizada" sólo
aparece si nunca se guardó ninguna y el BCV tampoco respondió ahora. Para
cargarla a mano:

```bash
pnpm --filter @luma/api rates:refresh     # lee el BCV real
```

o, con el admin: *menú de usuario → Administración de la plataforma → Pagos → Tasa BCV →
Leer el BCV ahora* (o cargarla a mano si el BCV no responde).

### 2.3 Cuentas

**Admin de la plataforma** (el que aprueba los pagos en Bs): el de
`ADMIN_EMAIL` / `ADMIN_PASSWORD`, creado con `pnpm seed:admin`.

**Cuentas de demostración**, una por estado:

```bash
pnpm --filter @luma/api seed:subscription-demo
```

Todas con la contraseña **`Demo12345!`**:

| Cuenta | Estado | Sirve para probar |
|---|---|---|
| `demo-gratis@luma.test` | Gratis, 20 días, 2 obras | pasar a Pro desde hoy o al terminar |
| `demo-por-vencer@luma.test` | Gratis, 3 días, 3 obras | el aviso de la última semana y el pase a Pro con la 4ª obra |
| `demo-pro@luma.test` | Pro pagado en Bs, 4 obras (1 extra) | próximo cobro con extra ($47), crear una 5ª |
| `demo-en-revision@luma.test` | prueba vencida + pago en Bs pendiente | aviso "en revisión" y, del lado del admin, la cola con "no coincide" |
| `demo-vencida@luma.test` | vencida, con un pago rechazado | sólo lectura, el motivo del rechazo y pagar para volver |

El script también deja una tasa BCV (la real, o una de 880 Bs/USD si el BCV no
responde). Cada corrida deja esas cinco cuentas como nuevas, con fechas
relativas a hoy, y no toca ninguna otra. Se niega a correr contra una base que
no sea local.

### 2.4 Stripe en local (sólo para tarjeta)

Una vez por sandbox, crea el producto y los dos precios:

```bash
pnpm --filter @luma/api stripe:setup
```

Los webhooks de Stripe no llegan a `localhost` solos: los reenvía el
[Stripe CLI](https://docs.stripe.com/stripe-cli).

```bash
stripe login                    # una vez; o agregá --api-key sk_test_… a cada comando
stripe listen --forward-to localhost:8081/api/billing/stripe/webhook \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed
```

Copiá el `whsec_…` que imprime a `STRIPE_WEBHOOK_SECRET` y reiniciá la API.
Dejá `stripe listen` corriendo mientras probás: ahí se ven los eventos y si la
API contestó 200.

En el dashboard de Stripe (modo prueba): *Settings → Billing → Customer portal*,
activá cambiar tarjeta, ver facturas y cancelar suscripción. Sin eso,
"Administrar tarjeta" da error.

---

## 3. Flujo: pago en bolívares con aprobación manual

1. Entrá con `demo-gratis@luma.test` (o tu cuenta) → *menú de usuario → Suscripción*.
2. En **Pasar a Pro** elegí *Desde hoy* o *Cuando termine el plan Gratis* →
   **Pagar en bolívares**.
3. El panel muestra el **monto en Bs** (USD × tasa BCV del día) y las cuentas
   de 2.1. Completá con estos datos de prueba:

   | Campo | Valor de prueba |
   |---|---|
   | ¿Cómo pagaste? | Pago Móvil |
   | Banco desde el que pagaste | `Mercantil` |
   | Número de referencia | `12345678` (sólo números, 4 a 30; **no se puede repetir** con el mismo banco en otro pago pendiente o aprobado) |
   | Cédula o RIF de quien pagó | `V-12345678` |
   | Fecha del pago | hoy |
   | Monto que pagaste | el que viene puesto (cambialo para ver el aviso de "no coincide") |
   | Comprobante | cualquier `.jpg`, `.png`, `.webp` o `.pdf` de hasta 20 MB |

4. **Enviar pago** → queda *En revisión*. Mientras tanto la cuenta sigue con
   acceso completo 72 h, y no se puede mandar otro pago.
5. Entrá con el **admin** → *menú de usuario → Administración de la plataforma →
   Pagos → Pendientes*. Cada pago muestra lo **cotizado** contra lo **declarado** (con
   aviso si difieren más de 1%), banco, referencia, cédula, fecha y el
   comprobante.
6. **Aprobar** → la cuenta pasa a **Pro**. **Rechazar** pide un motivo, que el
   usuario ve en su historial.
7. De vuelta en la cuenta del usuario: estado **Pro**, el pago en el historial
   y el próximo cobro.

Para ver el lado del admin sin hacer el pago: `demo-en-revision@luma.test` ya
dejó uno pendiente (con monto que no coincide).

## 4. Flujo: pago con tarjeta (Stripe sandbox)

Requiere 2.4 funcionando (`stripe listen` corriendo).

1. *Suscripción → Pasar a Pro → Pagar con tarjeta* → se abre el formulario de
   Stripe en un modal (en el celular, un panel desde abajo). Sin
   `STRIPE_PUBLISHABLE_KEY` te lleva a la página de Stripe.
2. Tarjetas de prueba de Stripe (vencimiento: cualquier fecha futura; CVC:
   cualquiera; código postal: cualquiera):

   | Tarjeta | Qué pasa |
   |---|---|
   | `4242 4242 4242 4242` | pago aprobado |
   | `4000 0025 0000 3155` | pide autenticación 3D Secure (aprobala en la ventana de prueba, que se abre dentro del modal) |
   | `4000 0000 0000 9995` | rechazada por fondos insuficientes |
   | `4000 0000 0000 0341` | la guarda bien pero **falla al cobrar**: sirve para ver *Cobro fallido* en una renovación |

3. Al terminar se cierra el modal (o volvés de Stripe), la pantalla dice
   "Stripe confirmó el pago" y en unos segundos
   (cuando llega el webhook) queda en **Pro**, con la factura en el historial.
4. **Administrar tarjeta** abre el portal de Stripe en otra ventana: cambiar tarjeta, ver
   facturas, cancelar.

- *Cuando termine el plan Gratis* con tarjeta: Stripe guarda la tarjeta y **no
  cobra hoy** (el Checkout dice $0); cobra el día que termina la prueba. Stripe
  no permite diferir menos de 48 h: a menos de 2 días del final, arranca hoy.
- Para ver una renovación sin esperar un mes, usá los *test clocks* de Stripe
  (Billing → Test clocks) sobre el cliente.

## 4b. Mails

| Mail | A quién | Cuándo |
|---|---|---|
| Hay un pago para revisar | admins de plataforma | al mandar un pago en Bs (avisa si el monto no coincide) |
| Aprobamos tu pago / No pudimos aprobarlo (con motivo) | dueño | al revisar el pago |
| No pudimos cobrar tu tarjeta | dueño | primer intento fallido de Stripe (no en cada reintento) |
| Tu plan Gratis termina en 7 / 3 / 1 días | dueño | tarea diaria, si no dejó pago lo que sigue |
| Tu suscripción venció | dueño | tarea diaria, una vez por vencimiento |

En local: sin `RESEND_API_KEY` no sale ningún mail (la app sigue andando y lo
loguea). Con la clave pero sin dominio verificado, Resend sólo entrega a la
casilla dueña de la cuenta de Resend. Para disparar los recordatorios a mano:

```bash
pnpm --filter @luma/api subscription:reminders
```

Con `seed:subscription-demo`, `demo-por-vencer` recibe el de 3 días y
`demo-vencida` el de vencida (si el mail sale, no se repite en la siguiente corrida).

## 5. Escenarios para recorrer

- [ ] Registrarse → *Gratis, 30 días*. Crear una obra y que la pantalla lo refleje al instante.
- [ ] Con 3 obras en Gratis, *Nueva obra* abre el pase a Pro por $47.
- [ ] Pasar a Pro *desde hoy* en Bs → aprobar → Pro; la cuarta obra se crea.
- [ ] Pasar a Pro *al terminar el plan Gratis* → sigue Gratis con su límite hasta esa fecha.
- [ ] Con Pro, crear una obra extra → el alta avisa "suma $8"; con tarjeta, Stripe la prorratea.
- [ ] `demo-vencida`: todo en sólo lectura (sin botones de crear), aviso rojo, pagar desde Suscripción.
- [ ] Rechazar un pago → el usuario ve el motivo y puede mandarlo de nuevo con la misma referencia.
- [ ] Mandar dos pagos seguidos → el segundo se rechaza (ya hay uno en revisión).
- [ ] Un invitado (supervisor) entra a una obra de `demo-vencida` → la ve en sólo lectura con el aviso "venció la suscripción de quien la gestiona".

## 6. Si algo no aparece

| Síntoma | Causa | Qué hacer |
|---|---|---|
| No está la opción de pagar en bolívares | faltan `PAGO_MOVIL_*` y/o `TRANSFER_*` | 2.1 y reiniciar la API |
| "No tenemos una tasa BCV actualizada" | no hay ninguna tasa guardada y el BCV no respondió | 2.2 |
| No está la opción de tarjeta | falta `STRIPE_SECRET_KEY`, o es `sk_test_` sin `STRIPE_TEST_MODE=true` (la API lo avisa al arrancar) | 2.1 |
| Pagar con tarjeta va a la página de Stripe y no abre el modal | falta `STRIPE_PUBLISHABLE_KEY`, o es de otro modo que la secret (`pk_live_` con `sk_test_`; la API lo avisa al arrancar) | 2.1 y reiniciar la API |
| El modal queda en "No pudimos cargar el formulario" | el navegador no llega a `js.stripe.com` (bloqueador de anuncios, red) | probar sin el bloqueador |
| "Faltan los precios en Stripe" | no se corrió `stripe:setup` en ese sandbox | 2.4 |
| Checkout dice "the product tax code is missing" | la cuenta tiene Managed Payments y el producto no tiene código de impuesto | volver a correr `stripe:setup` (lo completa) |
| Pagué con tarjeta y sigue en Gratis | no llegó el webhook | `stripe listen` corriendo y `STRIPE_WEBHOOK_SECRET` igual al que imprime |
| "Administrar tarjeta" da error | el portal de clientes no está configurado en Stripe | 2.4, último párrafo |
| No aparece "Administración de la plataforma" | la cuenta no es admin | entrar con la de `ADMIN_EMAIL` |
| Una cuenta vieja con obras decía que la prueba arranca con la primera obra | era anterior a la suscripción | ya no pasa: al abrir Suscripción recibe el mes gratis desde ese día (en producción lo hace `migrate-subscriptions`) |

## 7. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Reglas (estado, límite, cobro, prorrateo) | `packages/shared/src/billing/index.ts` (+ `index.spec.ts`) |
| Modelos | `packages/api/src/models/Subscription.ts`, `SubscriptionPayment.ts`, `ExchangeRate.ts`, `StripeEvent.ts` |
| Pagos en Bs y revisión | `packages/api/src/services/subscription-payment.service.ts` |
| Mails y recordatorios | `packages/api/src/services/subscription-notify.service.ts`, `email.service.ts` |
| Stripe (Checkout, portal, webhook) | `packages/api/src/services/stripe.service.ts`, `stripe.client.ts` |
| Tasa BCV (y su certificado) | `packages/api/src/services/bcv.service.ts`, `src/certs/sectigo-dv-r36.ts` |
| Sólo lectura al vencer | `packages/api/src/middleware/project.middleware.ts`, `subscription.middleware.ts` |
| Pantallas | `packages/web/src/pages/subscription.tsx`, `pages/platform/platform-billing.tsx`, `components/subscription/` |

**Endpoints** (todos con sesión salvo el webhook):

| Método y ruta | Para qué |
|---|---|
| `GET /api/subscription/me` | estado, próximo cobro, medios de pago habilitados |
| `GET /api/subscription/quote?activateNow=&includeNextProject=` | cuánto pagar en Bs y dónde |
| `GET /api/subscription/rate` | tasa BCV vigente |
| `GET` / `POST /api/subscription/payments` | historial / mandar un pago en Bs (multipart, campo `receipt`) |
| `POST /api/subscription/stripe/checkout` | `{ activateNow?, includeNextProject? }` → `{ mode: 'embedded', clientSecret, publishableKey }` para el modal, o `{ mode: 'hosted', url }` |
| `POST /api/subscription/stripe/portal` | URL del portal de Stripe |
| `POST /api/billing/stripe/webhook` | lo llama Stripe; autentica la firma |
| `GET /api/admin/subscription-payments?status=` | cola del admin (`pendiente`, `aprobado`, `rechazado`) |
| `POST /api/admin/subscription-payments/:id/review` | `{ decision: 'aprobar' }` o `{ decision: 'rechazar', reason }` |
| `GET` / `POST /api/admin/exchange-rates`, `POST …/refresh` | tasas: listar, cargar a mano, leer el BCV ya |

**Scripts** (`pnpm --filter @luma/api <script>`): `seed:subscription-demo`,
`rates:refresh`, `stripe:setup`, `migrate:subscriptions`,
`subscription:reminders`.
