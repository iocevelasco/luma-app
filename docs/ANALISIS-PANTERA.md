# Qué se toma de Pantera Negra y qué no

Este documento es el contraste que motivó el repo: Luma no arranca de cero,
arranca del esqueleto de `pantera-negra-wep-app`, pero se queda con la
infraestructura y descarta el dominio.

La distinción que ordena todo: **Pantera resuelve "cómo se construye una
aplicación multi-tenant con usuarios, roles y notificaciones". Eso vale y se
reusa. Pantera también resuelve "cómo se gestiona una academia de artes
marciales". Eso no aplica y se descarta entero.**

---

## 1. Se reutiliza — la arquitectura

### Estructura del monorepo

Idéntica, cambiando el scope de `@pantera-negra/*` a `@luma/*`:

```
packages/
├── shared/   tipos TypeScript + schemas Zod — importado por api y web
├── api/      Node + Express + TypeScript (ESM) + Mongoose
└── web/      Vite + React 19 + TypeScript + Tailwind v4
```

Lo que hace que esto valga la pena es `shared`: un solo lugar define la forma de
cada payload, y el formulario de React valida con el mismo objeto Zod con el que
valida el controlador de Express. Cuando un campo se vuelve obligatorio, las dos
puntas se enteran a la vez o no compila.

### Backend

| Pieza de Pantera | Qué hace | En Luma |
|---|---|---|
| `config/app.config.ts` | Fuente única de env vars + `validateConfig()` al arranque | Igual, con las variables de Luma |
| `config/database.ts` | Conexión a Mongo con reintentos, servidor arriba aunque la base no responda | Igual |
| `services/jwt.service.ts` | HS256 o RS256 según config; access + refresh | Igual |
| `middleware/auth.middleware.ts` | `isAuthenticated` + guards de rol | Igual, con `requirePermission()` en vez de `requireAdmin`/`requireProfessor` |
| `middleware/errorHandler.ts` | Traductor único de Zod / Mongoose / status a respuesta | Igual |
| `services/email.service.ts` | Resend con carga perezosa; sin API key loguea por consola | Igual |
| Rate limiting en auth, sólo en producción | Evita que los E2E se coman la cuota | Igual |
| Patrón multi-tenant | `dojo_id` del JWT como filtro implícito de cada query | `project_id`, mismo mecanismo |
| Refresh token en cookie httpOnly, access en el body | Lo que JS no toca no se lo lleva un XSS | Igual |
| `trust proxy = 1` | Un solo proxy, no la cadena entera | Igual |
| Servir el SPA desde el mismo Express en producción | Un solo deploy | Igual |

**El flujo de auth completo se conserva**, que es lo que más costaba rehacer:
registro, verificación de email, login, refresh, logout, olvidé/restablecer
contraseña, cambio de contraseña, y el alta por invitación (cuenta sin
contraseña + token de activación por email). La regla de contraseña vive en
`shared/schemas` como `passwordSchema` y la usan el formulario y el backend.

Dos detalles heredados que no son obvios y valen:

- **Comparación de contraseña en tiempo constante aun cuando el usuario no
  existe.** Sin eso, la diferencia de tiempo entre "no existe" y "contraseña
  mala" permite enumerar cuentas.
- **`forgot-password` responde lo mismo exista o no la cuenta.** Si no, el
  endpoint es un verificador gratuito de qué emails están registrados.

### Frontend

| Pieza | En Luma |
|---|---|
| `lib/api-client.ts` con interceptor de 401 | Igual, **mejorado**: Pantera desloguea en el 401; Luma intenta renovar con la cookie de refresh y reintenta una vez antes de echar a nadie |
| `lib/routes.ts` — todas las rutas como constantes | Igual. En Pantera esta constante existía y aun así se desincronizó (`/oauth-callback` contra `/oauth/callback`, un 401 en el callback deslogueaba). Acá links, guards y la lista de rutas públicas salen del mismo objeto |
| TanStack Query v5 + `query-keys.ts` centralizado | Igual |
| Zustand con `persist` para la sesión | Igual |
| Tailwind v4 CSS-first, sin `tailwind.config.js` | Igual, con la paleta de Luma |
| `cn()` = clsx + tailwind-merge | Igual |
| Composición `Guard → Shell → páginas` | Igual: el shell monta providers y chrome una sola vez |
| Escala única de redondeo, píldora = se toca | Igual |
| Área segura del notch (`pb-safe`) | Igual — la barra inferior no puede quedar bajo el gesto de home |

---

## 2. Se descarta

### Integración con WhatsApp — **decisión explícita del documento (RF-06)**

Pantera tiene `services/whatsapp.service.ts`, `routes/whatsapp.ts` y un bot con
`claude-bot.service.ts` colgado de la API de WhatsApp Business. Luma no.

El motivo está escrito en el documento funcional: la API de Meta impone
aprobación previa de plantillas de mensaje, verificación del negocio, costo por
conversación y la restricción de la ventana de 24 horas para responder. Es una
dependencia externa que agrega fricción operativa y riesgo de bloqueo sin
aportar valor propio al producto.

**Reemplazo:** el asistente conversacional dentro de la plataforma
(`services/assistant.service.ts`). Se queda el uso del SDK de Anthropic, se va
el canal.

### Capacitor y las apps nativas

Pantera empaqueta iOS y Android con Capacitor (`packages/mobile`,
`packages/web/android`, `packages/web/ios`, biometría, splash screen, plugin de
red). Luma no.

El §8 pide que "la operación diaria en obra funcione completa desde el celular",
no que haya una app en las tiendas. Una web responsive mobile-first cumple el
requisito sin sumar dos pipelines de build, dos revisiones de tienda y el
problema de versiones desactualizadas en el campo. Si más adelante hace falta
(notificaciones push nativas, cámara integrada), Capacitor se agrega encima de
este mismo `packages/web` — es exactamente lo que hizo Pantera.

### Todo el subsistema de pagos

Se descarta `mercadopago.service.ts`, `payments`, `memberships`,
`membership-plans`, `platform-billing`, `platform-subscription`, `cashflow`,
`expenses` y el middleware `billing-enforcement`.

El documento lo excluye de forma explícita: "la plataforma no registra pagos ni
anticipos del cliente. El seguimiento financiero se limita al presupuesto:
inicial, comprometido, ejecutado y saldo disponible. La gestión de flujo de
caja, recaudo y facturación permanece fuera del producto".

Esto no es una simplificación de MVP: es una decisión de alcance. Meter pagos
después sería una decisión de producto nueva, no una deuda pendiente.

### El dominio de artes marciales

`Dojo`, `Member`, `Class`, `Attendance` (de clases), `Activity` (de disciplina),
`Enrollment`, `TrainingRoutine`, `Team`, `MARTIAL_ART_RANKS`, cinturones,
grados, check-in del alumno con período de gracia, área del alumno con su barra
de cinco destinos. Nada de esto sobrevive; sí sobrevive **la forma**: la barra
inferior de cinco destinos del área del alumno es el patrón que usa el
`AppShell` de Luma.

### Google OAuth

Pantera lo tiene (`google-auth-library`, whitelist de admins por tenant, alta
por OAuth con selección de academia). Luma arranca con email + contraseña y
alta por invitación.

No es que no sirva: es que el MVP se define por §10 y ahí no aparece, y el flujo
de OAuth de Pantera trae adosada una máquina de estados propia (cuenta creada
sin academia, `complete-registration`, whitelist) que sólo tiene sentido con su
modelo de auto-registro público. Luma no tiene auto-registro a un proyecto: al
proyecto se entra invitado.

### Otros

- **Cloudinary** — el registro fotográfico del RF-04 guarda URLs; el servicio de
  storage se enchufa cuando haga falta.
- **`packages/landing` y el proxy `/home`** — Luma todavía no tiene landing.
- **reCAPTCHA** — protege el registro público, que acá no existe.
- **Playwright / E2E** — la estructura queda lista; los tests no son parte de
  este esqueleto.

---

## 3. Se transforma

| Pantera | Luma | Por qué |
|---|---|---|
| `dojo_id` | `project_id` | Mismo mecanismo de tenant, otra entidad raíz |
| `Member` con rol embebido | `User` + `ProjectMember` | La misma persona es ejecutante en su obra y cliente en la de otro. Con el rol en el usuario haría falta una cuenta por sombrero |
| `requireAdmin` / `requireProfessorOrAdmin` | `requirePermission(permission)` | El §2.5 es una matriz, no una jerarquía. Se pide el permiso, nunca el rol, y la matriz vive en `shared` para que el `can()` del frontend y el guard del backend lean la misma tabla |
| `Enrollment` (alumno ↔ academia) | `ProjectMember` (persona ↔ proyecto) | Misma relación N:M, sin el estado de solicitud pendiente |
| Notificaciones por WhatsApp + email | Notificaciones in-app + email, con ventana horaria y agrupación | RF-09: agrupar lo no urgente y no mandar nada en momentos inoportunos |
| `SchedulerService` con node-cron | Igual, con otras tareas | Despachar lo que esperaba la ventana, alertas tempranas, resumen semanal |

---

## 4. Lo que Luma agrega y Pantera no tiene

- **Importador de planilla con vista previa** (RF-05). Dos pasos: se sube, se
  muestra qué se entendió con totales, filas incompletas, unidades no
  reconocidas y duplicados, y recién ahí se confirma. Lo que se carga queda como
  línea base, y una línea base mal cargada hace que todas las previsiones
  mientan (§12).
- **Máquina de estados del imprevisto** (RF-08). Explícita, con transiciones
  validadas, porque el orden *es* el producto: ninguno llega al cliente sin
  curaduría interna.
- **Historial inmutable** de cada imprevisto (regla 5) y **auditoría** de toda
  acción que toque presupuesto o cronograma (regla 7).
- **Reacomodo automático del cronograma** al aprobarse un imprevisto con impacto
  en días (RF-08 paso 5) — y corre todo lo posterior, no sólo lo afectado, o el
  cronograma queda mintiendo.
- **Cálculo de margen de maniobra** (glosario): el saldo menos la tajada de
  rentabilidad del ejecutante. Es el número que el ejecutante mira.
- **Endpoint propio para la vista del cliente**, no un dashboard filtrado. La
  diferencia importa: cuando se agregue un campo al dashboard interno, no hay
  forma de que se filtre al cliente por omisión.
- **Recorte del contexto del asistente por rol**: si quien pregunta no puede ver
  el presupuesto, los números no entran en el prompt. No alcanza con pedirle al
  modelo que no los diga.
