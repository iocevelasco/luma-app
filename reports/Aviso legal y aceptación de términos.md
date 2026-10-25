# Aviso legal y aceptación de términos en Luma

Fecha: 2026-10-24. Basado en las cuatro notas de `research_notes/Aviso legal y aceptación de términos/` (auditoría del código, marco legal venezolano, patrones de aceptación, redacción de seguridad y privacidad).

> **Esto no es asesoría legal.** Es una síntesis de investigación y un plan técnico. Los textos legales finales (términos, privacidad, cláusulas de seguridad, foro y responsabilidad) y la vigencia de las normas citadas **deben ser revisados por un abogado venezolano** antes de publicarse. Varias fuentes del marco legal son secundarias y algunas citas están marcadas como no verificadas en las notas.

---

## 1. Resumen ejecutivo

**El pedido.** Un usuario señaló que la app no dice nada sobre la seguridad de sus datos y pidió un aviso de que están seguros y no se usarán "bajo ningún concepto" con fines comerciales.

**Hallazgos centrales.**

1. **Hoy Luma no tiene nada legal.** No hay términos, política de privacidad, consentimiento ni campo `terms*` en ningún paquete. Lo único cercano es la sección "Seguridad" de la landing (dos tarjetas de marketing) y un comentario en `packages/api/src/services/email-layout.ts:55-56` sobre la base legal de los mails. El registro (`packages/web/src/pages/register.tsx`) no tiene casilla de aceptación y los invitados activan la cuenta (`packages/web/src/pages/activate.tsx`) sin ver ningún texto legal.
2. **Venezuela no tiene ley integral de datos personales** (no se halló una vigente ni un proyecto activo a octubre de 2026; verificar). El estándar efectivo es la Constitución (arts. 28 y 60), los principios de la Sala Constitucional del TSJ (sentencia de 2011) y la Ley Especial contra los Delitos Informáticos, cuyo art. 20 hace del **consentimiento del titular** el eje penal. La Ley de Mensajes de Datos y Firmas Electrónicas (2001) respalda la contratación y la prueba por medios electrónicos.
3. **Cómo lo resuelve el mercado.** Las apps B2B (Slack, Stripe) aceptan por uso y avisan los cambios; las que necesitan exigibilidad fuerte o mueven dinero usan casilla afirmativa en el alta y un modal bloqueante para los cambios. Ninguna app seria promete "nunca, bajo ningún concepto": prometen conductas concretas y verificables ("no vendemos tus datos") con excepciones legales declaradas y la salvedad de que ningún sistema es infalible.
4. **Recomendación.** No prometer "seguridad absoluta" ni "bajo ningún concepto". Prometer lo que Luma controla y puede verificar: no vendemos ni alquilamos datos, no hay publicidad de terceros, los datos de la obra se usan solo para prestar el servicio, lista de proveedores, medidas razonables, aviso de incidentes. Y registrar la aceptación con un registro de evidencia versionado.
5. **Plan técnico.** Fases shared → API → capa 1 → capa 2 → UI → i18n → landing → tests → deploy (sección 7). Tres puntos de captura: casilla en el registro, casilla en la activación del invitado y un modal bloqueante para usuarios existentes y cambios de versión.
6. **Decisiones abiertas para el dueño**, empezando por una que bloquea: el modelo nuevo `ConsentRecord` exige preguntar según `CLAUDE.md` (sección 8).

---

## 2. Estado actual de Luma (auditoría del repo)

### 2.1 Qué existe y qué falta

| Hallazgo | Ruta |
|---|---|
| Ningún término, privacidad ni consentimiento en `packages/*/src`, `e2e`, `docs`, `scripts` | grep de la auditoría |
| `AuthUser` solo trae id, email, name, picture, role, email_verified, account_status | `packages/shared/src/types/index.ts:34-42` |
| `registerCredentialsSchema`: email, password, name, recaptchaToken | `packages/shared/src/schemas/index.ts` |
| `IUser` sin ningún campo de términos | `packages/api/src/models/User.ts` |
| Landing: sección Seguridad con "Confidencial" y "Backups todos los días" | `packages/landing/src/sections/Security.tsx`, clave i18n `security` |
| Footer de la landing sin links legales | `packages/landing/src/sections/Footer.tsx` |
| Registro web sin casilla | `packages/web/src/pages/register.tsx` |
| `UserMenu` sin acceso a documentos legales | `packages/web/src/components/dashboard/user-menu.tsx` |

### 2.2 Las tres puertas por donde nace una cuenta

1. **Autoregistro**: `POST /api/auth/register` (`packages/api/src/routes/auth.ts`, controller `register` en `packages/api/src/controllers/auth.controller.ts:109-164`). Crea `User` con `role:'user'`, `createPersonalOrganization`, `startTrialFor` y manda el mail de verificación. No abre sesión.
2. **Invitación a obra**: `inviteProjectMember` en `packages/api/src/controllers/project.controller.ts` (~l.280-370), ruta con `requireCapability('project.invite')` en `packages/api/src/routes/project.ts:35`. Si el email no tiene cuenta, crea el `User` con `email_verified:false` y token de activación de 72 h.
3. **Invitación a equipo de Empresa**: `inviteMember` en `packages/api/src/controllers/organization.controller.ts` (~l.190-250; `User.create` en l.213), ruta `organizationRouter.post('/me/members', ...)` en `packages/api/src/routes/organization.ts:36`.

Los invitados activan en `packages/web/src/pages/activate.tsx` (`PasswordForm` + `useSetPassword`) contra `setPassword` (`auth.controller.ts:275`), que fija la contraseña, marca el email verificado y **abre sesión**. Si el mail no salió, quien invita recibe el enlace en pantalla (`activationDelivery`), así que la persona real puede activar con un enlace entregado a mano.

Otros creadores de `User`: `packages/api/src/scripts/seed-admin.ts:39`, `seed-roles.ts:72`, `seed-e2e-users.ts`, `seed-demo-modules.ts:116`, `seed-subscription-demo.ts:208`.

### 2.3 Cómo conoce la SPA al usuario

- `packages/web/src/providers/auth-provider.tsx` guarda `user`, `token` en estado y en localStorage (`auth_user`, `auth_token`). En `restore()` **no llama a `/me`** y, al renovar el token con `apiClient.refreshSession()`, solo toma el token: el `user` guardado puede estar desactualizado. Existe también `useUserStore` (`packages/web/src/stores/user-store.ts`).
- Consecuencia: si se publica una versión nueva de los términos, el modal **no aparecería** hasta el próximo login salvo que se sincronice el usuario al cargar el panel.
- Guards: `packages/web/src/components/route-layouts.tsx` (`PublicOnlyLayout`, `AuthenticatedLayout`, `AdminLayout`) y `packages/web/src/routes.tsx` (`AuthenticatedLayout` → `DashboardLayout` → rutas). `DashboardLayout` (`packages/web/src/components/dashboard-layout.tsx`) ya monta `SubscriptionNotice` encima del `Outlet`.
- `isAuthenticated` (`packages/api/src/middleware/auth.middleware.ts`) solo verifica el JWT y no toca la base. Un gate de términos en la API implica una consulta por request o un claim en el JWT (el access token dura 7 días, así que quedaría desactualizado).

### 2.4 Lo que el sistema hace con los datos (insumo para la política)

A verificar con el dueño antes de publicar:

- Proveedores: Resend (mail, `EMAIL_CONFIG`), Google reCAPTCHA (`RECAPTCHA_CONFIG`), Stripe (`STRIPE_CONFIG`, la tarjeta no pasa por el servidor), `media-service` externo para evidencia y documentos (`STORAGE_CONFIG`, URLs firmadas de 3600 s), Anthropic para el Consultor IA (`packages/api/src/services/project-advisor.service.ts`), tasa BCV scrapeada (`BCV_CONFIG`) y el VPS vía Coolify. Config en `packages/api/src/config/app.config.ts`.
- Controles reales: bcrypt (10 rondas), JWT HS256/RS256, refresh en cookie httpOnly `secure` `sameSite: lax` de 90 días (`auth.controller.ts:24-49`), rate limit de 10 intentos por 15 minutos en producción (`packages/api/src/routes/auth.ts`), helmet con CSP solo en producción (`packages/api/src/index.ts:~105-140`), aislamiento entre obras devolviendo 404 en vez de 403.
- Datos financieros: `SubscriptionPayment` guarda banco, referencia, cédula/ID del pagador y comprobante (`packages/api/src/models/SubscriptionPayment.ts`). Además hay datos de terceros que no son usuarios (`CrewMember`, `Provider`, `ProjectClient`): ahí la Empresa es la responsable y Luma la encargada (observación para el abogado, no derivada del código).
- Backups: existen `scripts/mongo-backup.sh` y `scripts/mongo-backup.env.example`, pero **no se verificó frecuencia, retención ni cifrado en reposo**. La landing ya afirma "Backups todos los días": es una promesa contractual implícita que hay que confirmar o suavizar.

---

## 3. Marco legal venezolano

> Distinción usada en las notas: [LEY] norma citada con artículo; [JURIS] criterio del TSJ; [PRÁCTICA] referencia comparada, no obligatoria en Venezuela.

### 3.1 Constitución y jurisprudencia

- **[LEY] Art. 60 CRBV**: derecho a la protección del honor, vida privada, intimidad, imagen, confidencialidad y reputación. **Art. 48**: secreto e inviolabilidad de las comunicaciones privadas. **Art. 28** (habeas data): acceso a la información sobre uno mismo en registros públicos o privados, conocer su uso y finalidad, y pedir actualización, rectificación o destrucción. El texto literal del art. 28 **no se verificó** (ver sección 10).
- **[JURIS] Sentencia de la Sala Constitucional del 4/8/2011** (citada como n.º 1318; el número no se verificó en fuente primaria). Fija principios: consentimiento previo, libre, informado, inequívoco y revocable; legalidad; finalidad y calidad (datos no excesivos); seguridad y confidencialidad; conservación limitada; exactitud; tutela (acceso, rectificación, supresión); responsabilidad; datos sensibles solo con consentimiento. Es el esqueleto más defendible para un aviso de privacidad "a la venezolana".
- **Estado práctico**: sin autoridad de protección de datos, sin registro de bases, sin DPO obligatorio y sin deber legal claro de notificar brechas (DLA Piper, revisión de 2022; IAPP, agosto 2025). Hubo filtraciones relevantes: Movistar Venezuela (2025, más de 3,25 millones de personas) y Cashea (febrero 2026), lo que vuelve la desconfianza del usuario razonable y las promesas absolutas más peligrosas.

### 3.2 Mensajes de datos y firma electrónica (Decreto-Ley 1.204, G.O. 37.148, 28/2/2001)

- **Art. 4**: los mensajes de datos tienen la misma eficacia probatoria que los documentos escritos. **Art. 15**: las partes pueden acordar que oferta y aceptación se hagan por mensajes de datos (fundamento directo del contrato por clic). **Arts. 7-8**: el requisito de original y de escrito se cumple si se conserva la integridad y la información es accesible, con origen, destino, fecha y hora determinables.
- **Arts. 16-18**: la firma electrónica con valor de firma autógrafa exige requisitos o certificación (SUSCERTE). Un simple clic **no** tiene ese valor, pero según el art. 17 puede ser **elemento de convicción por sana crítica**.
- **Consecuencia práctica**: la fuerza de la prueba depende de la calidad del registro. Conviene que sea inmutable, con fecha y hora, versión y hash del texto aceptado, y conservado. La ley no regula expresamente el "clickwrap"; es aplicación por analogía de los arts. 4, 15 y 17. No se halló jurisprudencia venezolana sobre T&C en línea.

### 3.3 Delitos informáticos

Ley Especial contra los Delitos Informáticos (G.O. 37.313, 30/10/2001): art. 6 (acceso indebido), art. 11 (espionaje informático), **art. 20** (apoderarse, utilizar, modificar o eliminar data personal ajena sin consentimiento de su dueño, 2 a 6 años) y art. 22 (revelación indebida, con agravante por lucro). El eje es el consentimiento: documentarlo en los términos y en el aviso es una protección real, no solo formal. Ley sobre Protección a la Privacidad de las Comunicaciones (G.O. 34.863, 1991) complementa.

### 3.4 Consumo, adhesión, foro

- No se pudo verificar el texto vigente sobre contratos de adhesión (Ley Orgánica de Precios Justos y Ley para la Defensa de las Personas en el Acceso a los Bienes y Servicios son las referidas). El cliente de Luma es mayormente profesional o empresa, lo que reduce la aplicabilidad de normas de consumidor, pero no la elimina para usuarios individuales.
- Buena práctica comparada: lenguaje claro, sin cláusulas que eximan por completo de responsabilidad, sin renuncia de derechos ni cambios unilaterales sin aviso.
- **Ley de Derecho Internacional Privado (1998)**: las partes pueden elegir la ley aplicable (art. 29), y la sumisión expresa a tribunales debe constar por escrito (art. 44), con límite de orden público (art. 8). Sugerencia: ley venezolana y foro local; evitar foro extranjero lejano. La aceptación electrónica cumpliría "por escrito" vía el art. 8 de la Ley de Mensajes de Datos (inferencia de las notas).

### 3.5 Estándar de referencia sugerido

Base: principios del TSJ 2011. Estructura y derechos: LGPD (Brasil) o Ley 25.326 (Argentina), más simples; GDPR solo si hay usuarios en España (existe el locale `es-ES`; es una afirmación general no verificada en las notas). Las fuentes primarias de esas leyes no se consultaron.

---

## 4. Cómo lo resuelven otras aplicaciones

### 4.1 Formatos de aceptación y exigibilidad (referencia EE.UU., no ley venezolana)

| Formato | Qué es | Exigibilidad |
|---|---|---|
| **Clickwrap** | Casilla o botón explícito "acepto" con enlaces a los textos | La más sólida |
| **Sign-in-wrap** | "Al registrarte aceptás..." junto al botón | Zona gris; depende del diseño |
| **Browsewrap** | Enlace al pie sin acción del usuario | Rechazado por los tribunales |

Casos: *Berman v. Freedom Financial* (9th Cir. 2022) no halló contrato por aviso en letra gris diminuta con un botón que no decía que obligaba; *Nguyen v. Barnes & Noble* (2014) rechazó el enlace al pie; *Meyer v. Uber* (2d Cir. 2017) lo hizo valer por pantalla limpia con enlace azul y subrayado cerca del botón. Las citas provienen de resúmenes secundarios y deben verificarse contra la sentencia antes de usarse.

Lecciones de diseño: casilla propia no premarcada, enlaces con color distinto y subrayado, texto del botón que diga que acepta, nada de letra diminuta. En Argentina (referencia regional) la autoridad de consumo de Buenos Aires investiga a Mercado Libre por cláusulas de modificación unilateral con aceptación tácita por uso; sin resolución final.

### 4.2 Apps reales

- **Slack**: aceptación por uso; cambios materiales con aviso razonable por mail o in-app; el uso continuado es aceptación. Los invitados son "Authorized Users" bajo los términos del Cliente, que es responsable de informar y obtener consentimientos.
- **Stripe**: vigente al acceder o usar; quien acepta por una entidad declara tener autoridad; en Australia, 30 días de aviso para cambios materiales con derecho a terminar; uso continuado es aceptación.
- **Mercado Libre / Pago**: plazos de aviso de 10 días (Argentina) y 3 días (México) según fuentes secundarias; en Colombia un banco bloquea retiros hasta aceptar los nuevos términos en la app.
- **Bumble (caso Alkutkar)**: mail más "blocker card" con casilla al abrir la app; el tribunal dio peso a los registros de cuándo se mostró y aceptó la tarjeta.
- No se pudo verificar Notion, Procore, Buildertrend, Airbnb, Linear, Basecamp ni WhatsApp en su flujo de alta.

**Patrón**: B2B de bajo riesgo = aceptación implícita más aviso. Fintech o con dinero de por medio = bloqueo con aceptación explícita para cambios materiales. Luma maneja plata de obras y suscripciones, así que el patrón fintech es el apropiado.

### 4.3 Qué se guarda como evidencia

Estándar de facto: un registro por aceptación, inmutable (append-only), con tipo de documento, versión, hash SHA-256 del texto, fecha y hora UTC, IP, user agent, método (alta, invitación, modal) y, a veces, locale. Se separan los documentos (términos, privacidad, marketing opcional) con versión propia. LGPD art. 8 §2 pone la carga de la prueba en el controlador (interpretación de un vendor). IP y user agent son datos personales: hay que mencionarlos en la política y definir retención.

### 4.4 Re-aceptación por cambio de versión y usuarios existentes

- Los avisos pasivos (mail, banner) pueden no dar conocimiento; los tribunales favorecen el bloqueo con clic afirmativo (*Alkutkar v. Bumble*, citando *Wilson v. Huuuge*).
- SAP y Auth0 describen el mismo gate: si no aceptó la versión vigente, se muestra la pantalla de re-consentimiento y se bloquea hasta aceptar.
- Esquema recomendado en las notas: cambio material = mail más aviso in-app con 15 a 30 días y luego modal bloqueante; cambio menor = publicar con changelog. Los plazos son práctica, no obligación venezolana.
- **No backfillear** aceptaciones que no ocurrieron: los usuarios existentes quedan sin registro y ven el modal en su próximo ingreso. Fabricar una aceptación solo es legítimo en los seeds de pruebas.

### 4.5 Invitados y OAuth

El invitado debe aceptar él mismo (casilla en la pantalla de alta), y los términos deben decir que el dueño de la Empresa es responsable de informar a sus colaboradores. Luma no tiene login social hoy; si se agrega, necesita su propio paso de aceptación con el mismo gate.

### 4.6 Cómo formulan la seguridad y el "no uso comercial"

| App | Qué promete | Cómo lo acota |
|---|---|---|
| 37signals | "We never sell your data" | Admite anuncios en terceros con hash de email, subprocesadores, y que en reposo los datos no están cifrados campo a campo |
| Signal | No vende, alquila ni monetiza "ever" | Reserva el cumplimiento de la ley y pedidos legales |
| Stripe | No transfiere datos a terceros a cambio de pago | Admite socios de analítica; "no data transmission or storage system can be guaranteed to be 100% secure" |
| Slack | No vende información personal | Actúa como procesador; "no puede garantizar" ausencia total de intrusión |
| Linear | Medidas apropiadas | Admite que ciertas divulgaciones "may constitute a sale"; conserva datos anonimizados |
| WhatsApp | Cifrado extremo a extremo | Comparte con empresas Meta; cede ante procesos legales |

**Conclusión de la comparación**: nadie serio promete "nunca, bajo ningún concepto, uso comercial". Incluso Signal limita el "nunca" a verbos precisos (vender, alquilar, monetizar) y conserva excepciones legales.

**Riesgo de prometer de más.** En EE.UU. la FTC trata como práctica engañosa afirmar controles que no son ciertos: Zoom (2020, "cifrado extremo a extremo" cuando tenía las claves) quedó bajo orden con programa de seguridad obligatorio; Drizly y LifeLock son otros ejemplos (el detalle de Drizly viene de una fuente secundaria). No se hallaron sanciones equivalentes en LatAm, pero un reclamo por incumplimiento contractual o publicidad engañosa tras una brecha es plausible aun sin FTC.

---

## 5. Qué prometer y qué no

### 5.1 El "bajo ningún concepto" absoluto es riesgoso

Tres razones concretas:

1. **Hay excepciones legítimas que lo contradicen.** Subprocesadores (Stripe, Resend, hosting, `media-service`, Anthropic), requerimientos de autoridad por vía legal válida, y las personas de la obra que ven los datos según su rol. Una promesa absoluta convierte cualquiera de estas en incumplimiento.
2. **"Fines comerciales" es demasiado amplio.** Luma es un negocio: cobra suscripción, puede querer estadísticas agregadas o mejorar el producto con los datos. Prometer "nada comercial" choca con eso. Conviene definir el "nunca" **por verbo**: vender, alquilar, ceder para publicidad.
3. **"Seguro" es un resultado, no una conducta.** Ante una brecha, "tus datos están seguros" queda como promesa incumplida. Y la landing ya afirma "Nadie entra si no lo invitás" y "Backups todos los días" sin respaldo verificado en el repo.

### 5.2 Sí se puede prometer (si es técnicamente cierto)

- No vendemos ni alquilamos tus datos.
- No mostramos publicidad de terceros ni cedemos datos para ello.
- Usamos los datos de tu obra solo para prestar Luma.
- Listamos los proveedores que procesan datos (hosting, correo, pagos, IA, almacenamiento) con su propósito.
- Cifrado en tránsito (TLS) y copias de respaldo, solo si se verifica; **no** afirmar cifrado en reposo sin comprobarlo.
- Acceso por rol (la grilla de capacidades de `packages/shared/src/permissions/index.ts`) y aislamiento entre obras.
- Medidas de seguridad razonables y apropiadas al riesgo, y "ningún sistema es infalible".
- Aviso de incidentes sin demora injustificada, o un plazo que Luma pueda cumplir (la práctica GDPR de 72 h es referencia, no obligación local).
- Acceso, rectificación y baja, con canal de contacto y plazo fijo.

### 5.3 Evitar

"100% seguro", "nadie accede", "bajo ningún concepto", "eliminamos todo para siempre" (ver tensión con la baja lógica, sección 8), y cualquier control concreto que no tenga un responsable técnico que lo verifique.

### 5.4 Redacción sugerida (borrador para el abogado)

> No vendemos ni alquilamos tus datos y no los usamos para publicidad. Los usamos para prestar Luma. Solo los compartimos (a) con los proveedores que listamos, para operar el servicio, (b) con las personas de tu obra, según el rol que les diste, y (c) si una autoridad competente nos obliga por un medio legal válido. Podemos calcular estadísticas agregadas, sin identificar a nadie, para mejorar el producto. Aplicamos medidas de seguridad razonables, pero ningún sistema es infalible: si ocurre un incidente que te afecte, te avisamos.

Punto a decidir: si "estadísticas agregadas" cuenta como "fin comercial" a ojos del usuario (decisión de producto y redacción).

### 5.5 Estructura de la página pública

Dos capas: resumen en lenguaje llano arriba (patrón "Resumen" de Mercado Pago) y texto completo debajo. Orden: (1) lo esencial en 6 líneas; (2) qué datos y para qué; (3) con quién se comparten (tabla de proveedores); (4) cuándo debemos divulgar; (5) seguridad: controles reales más "ningún sistema es infalible"; (6) incidentes; (7) retención y baja; (8) tus derechos y cómo ejercerlos; (9) cambios y versión; (10) contacto. Los términos deben aclarar que el contenido subido es responsabilidad de quien lo sube y que el dueño de la Empresa responde por informar a su equipo. Exoneraciones y compromisos de seguridad deben enunciarse como obligaciones de medios para no contradecirse; la validez local de topes de responsabilidad es tema del abogado.

---

## 6. Diseño técnico recomendado

### 6.1 Dónde guardar la aceptación

| Criterio | A: campos en `User` (`termsVersion`, `termsAcceptedAt`) | B: `ConsentRecord` append-only |
|---|---|---|
| Regla "modelo nuevo se pregunta" | No la dispara | **La dispara: hay que preguntar** |
| Historial v1 → v2 → v3 | Se pierde, cada aceptación pisa la anterior | Completo |
| Evidencia (hash, IP, UA, método) | Infla `User` | Natural |
| Varios documentos con versión propia | Crece mal | Una fila por documento |
| "Nada derivado se guarda" | Guarda el último hecho, aceptable | Guarda hechos puros; el estado se calcula |
| Costo de lectura | Ya viene en el `User` | Una consulta indexada extra |
| Existentes | `updateMany` o dejar nulo | No insertar nada: el modal los alcanza |

**Recomendación: B.** `ConsentRecord` es un hecho con fecha, como un cobro: se crea, no se edita, sin PUT/PATCH/DELETE y **sin TTL** (es evidencia). El estado "al día" es derivado y se calcula, no se guarda (coherente con `CLAUDE.md`, secciones Plata y Suscripción). Esquema mínimo:

```
ConsentRecord {
  user: ObjectId ref User,
  document: 'terms' | 'privacy',
  version: string,
  contentHash: string,      // SHA-256 del texto mostrado
  acceptedAt: Date,         // UTC, default now
  ip?: string,              // dato personal, decidir
  userAgent?: string,       // dato personal, decidir
  method: 'register' | 'activate' | 'reaccept',
  locale?: string
}
índice { user: 1, document: 1, acceptedAt: -1 }
```

Notas de las notas de apoyo: la baja lógica de `User` no deja huérfano al registro (el `ref` sobrevive); `req.ip` ya es la IP real porque `trust proxy` está en `packages/api/src/index.ts:42`; hoy ningún código usa `req.ip` ni user-agent. Un híbrido (B más campos cacheados en `User`) viola "nada derivado se guarda" y no se recomienda.

**Plan B alternativo (A mínimo)**: `termsAcceptedVersion` y `termsAcceptedAt` en `User`, sin IP/UA. Es defendible como primer paso y migrable después a B.

### 6.2 Versión vigente: constante en shared

La versión de cada documento no es config de entorno. Va como constante en `@luma/shared` (patrón `PLAN` en `billing`), por ejemplo `LEGAL_DOCS = { terms: { version }, privacy: { version } }`, más una función pura `needsReacceptance(accepted, current)` con tests. API y web comparten la misma versión sin env vars. El hash solo es útil si el texto legal queda versionado como archivo fijo; si vive en i18n hay que decidir qué se hashea (sección 8).

### 6.3 La API resuelve, la UI muestra

Como con `project.capabilities`: la API agrega a `AuthUser` un bloque `legal: { upToDate: boolean, pending: ('terms'|'privacy')[] }` calculado en `toAuthUser` (`auth.controller.ts:51`), y la UI no lo vuelve a derivar.

### 6.4 Obligatoriedad: solo UI o también API

- **Solo modal (UX)**: más barato, no toca el pipeline de middlewares, deja constancia. Se puede saltear con `curl`.
- **Con gate de API**: código nuevo `TERMS_REQUIRED` que bloquea escrituras hasta aceptar. Es obligatoriedad real, pero cuesta una consulta por request o un claim desactualizado en el JWT (7 días). Si se hace, mejor que sea un gate de escrituras (lecturas siguen) y que el orden del pipeline en `index.ts` se respete.

Sugerencia de las notas: bloquear con modal y permitir lectura/exportación de datos mientras no acepte es menos hostil que bloquear todo (opinión sin fuente).

---

## 7. Plan de ejecución por fases

Orden del stack de Luma: shared → api → capa 1 → capa 2 → UI → i18n → landing → tests → deploy. Se trabaja en rama de feature y PR (no hay push a main: `pre-push-check.sh`). Las fases 1 a 2 dependen de la decisión A/B de la sección 8.

### Fase 1. shared (`packages/shared`)

1. Módulo `packages/shared/src/legal/index.ts` con `LEGAL_DOCS`, tipos `LegalDocument`/`ConsentMethod` y `needsReacceptance`, más `index.spec.ts`; re-exportar en `packages/shared/src/index.ts`. La landing **no** depende de shared (ver fase 7), no se importa allí.
2. `AuthUser` (`types/index.ts:34-42`): agregar `legal: { upToDate, pending }`.
3. `registerCredentialsSchema`: `acceptedTerms: z.literal(true)` con mensaje en castellano, consistente con el resto del archivo. Alternativa de transición: opcional por una ventana si hay riesgo con SPA vieja abierta (el deploy sirve API y web juntos, y `UpdateNotification` avisa de versiones nuevas). Spec nuevo `schemas/auth.spec.ts`.
4. Schema para `POST /api/auth/accept-terms` (documentos y versiones) y flag `acceptedTerms` para `set-password`.
5. Código de error `TERMS_REQUIRED` (solo si hay gate de API) en `ApiErrorCode` y `STATUS_BY_ERROR_CODE` (`packages/shared/src/types/errors.ts`); el compilador fuerza ambos `Record`.
6. `pnpm --filter @luma/shared build` antes de seguir.

### Fase 2. api (`packages/api`)

1. Modelo `ConsentRecord` (`packages/api/src/models/ConsentRecord.ts`) si se aprueba B; sin rutas de edición ni borrado.
2. `consent.service.ts`: `recordAcceptance(user, doc, version, method, req)` (toma IP y UA de `req`), `getLegalStatus(userId)` (último registro por usuario y documento contra `LEGAL_DOCS`). Test en `__tests__/services/consent.service.spec.ts`.
3. `register` (`auth.controller.ts:109`): exigir `acceptedTerms` y registrar con `method:'register'`. La aceptación se registra al crear la cuenta, aunque el correo aún no esté verificado.
4. `setPassword` (`auth.controller.ts:275`): recibir `acceptTerms` y registrar con `method:'activate'`. Es el punto que cubre a los invitados por obra y por equipo, incluido el enlace entregado a mano.
5. `login`, `refreshToken` (l.166) y `getCurrentUser` (l.199): devolver `legal` vía `toAuthUser`.
6. Ruta nueva `POST /api/auth/accept-terms` en `packages/api/src/routes/auth.ts` con `isAuthenticated`; crea los registros y devuelve el `AuthUser` actualizado. Es el endpoint del modal, `method:'reaccept'`.
7. Si hay gate: middleware de escrituras que lanza `TERMS_REQUIRED`, ubicado con cuidado en el pipeline (`index.ts`).
8. Estilo de errores: código nuevo con `throw` de `utils/errors.ts`, mensajes en castellano; no empeorar el `errMsg(error)` que filtra mensajes internos en 500. **Verificar antes** cómo capturan el `throw` los handlers `async` en Express 4 (asyncHandler, `express-async-errors` o try/catch con `next`); las notas no lo comprobaron.
9. Seeds: `seed-e2e-users.ts` (`upsertUser`) debe dejar aceptación vigente para todas las cuentas fijas; revisar `seed-admin.ts`, `seed-roles.ts`, `seed-demo-modules.ts`, `seed-subscription-demo.ts`.
10. Opcional: `EmailService.sendLegalUpdate` en `packages/api/src/services/email.service.ts`, con la plantilla de `email-layout.ts` (sin baja: es un comunicado contractual), `escapeHtml()`, sin `await` en quien lo dispara, y entrada en `src/scripts/email-preview.ts`. Script `send-legal-update.ts` con `--dry-run`, registrado en `package.json` (`notify:legal`), modelado sobre `send-subscription-reminders.ts`. Filtro `email_verified: true, enabled: {$ne:false}`; los invitados sin activar quedan fuera porque aceptan al activar. Un envío masivo idempotente necesitaría persistir envíos (otro modelo): correrlo una vez con control manual.

### Fase 3. capa 1 (`packages/web/src/api`)

- `packages/web/src/api/auth.ts`: `acceptTerms` con `unwrap<{ user: AuthUser }>`, y ajustar `register` y `setPassword`. Nada de `apiClient` en componentes. Las pantallas públicas llevan `skipAuth: true`.

### Fase 4. capa 2 (`packages/web/src/hooks`)

- `useAcceptTerms()` como `useMutation` en `hooks/auth/use-auth-queries.ts` (o `hooks/legal/`). Sin `onError` con toast: el error sale como banner en el formulario (`FormShell`). Al éxito, sincronizar el usuario con `AuthProvider`/`useUserStore.updateUser`.
- Resolver el problema de usuario desactualizado: al montar el panel llamar `/me` (`useCurrentUser`, con `enabled: isAuthenticated`) y actualizar el `user` guardado; o que el api-client reaccione a `TERMS_REQUIRED`. Clave nueva en `QueryKeys` (`packages/web/src/lib/query-keys.ts`) si corresponde.
- Lógica pura en `packages/web/src/lib/legal.ts` con `legal.spec.ts`.

### Fase 5. UI (`packages/web`)

1. **`register.tsx`**: casilla propia `#acceptTerms`, no premarcada, con enlaces a términos y privacidad en nueva pestaña (`target=_blank rel=noopener`) para no perder el estado del formulario. Etiqueta asociada y `aria-invalid` ante error (regla 12 del hook). Redacción sugerida: "Leí y acepto los Términos y la Política de Privacidad".
2. **`activate.tsx`**: casilla equivalente junto a `PasswordForm`. Es el punto que cubre a los invitados, que nunca ven el registro.
3. **`ConsentGate`**: modal no descartable montado en `DashboardLayout` (o como layout anidado entre `AuthenticatedLayout` y `DashboardLayout` en `routes.tsx`) mientras `user.legal.pending.length > 0`. Construirlo envolviendo componentes sin editar `components/ui/`: `ResponsiveDialog` ya bloquea el clic fuera pero **no** el Escape ni la X, por lo que hay que cerrar `onEscapeKeyDown` (como en `form-panel.tsx:107`) o usar `AlertDialog`. Casilla, enlaces, botón "Aceptar y continuar" y `FormShell` embebido para el error. Alternativa suave para consulta: permitir solo cerrar sesión o exportar mientras no acepte.
4. **Acceso permanente**: enlaces a términos y privacidad desde `UserMenu` (`packages/web/src/components/dashboard/user-menu.tsx`) o ajustes, y fecha de aceptación mostrada con `hooks/use-date-locale.ts`.
5. Los textos legales largos **no** van en JSX (regla 3 del hook): enlazar a la landing, que es la fuente única. Para la SPA, derivar la URL de la landing (en producción `APP_URL` termina en `/app` y la landing está en `/home` del mismo origen; en desarrollo son puertos distintos, 6173 y 5174) con una constante análoga a `packages/landing/src/lib/app-url.ts`.
6. Estilos: tokens semánticos, `cn()`, sin colores crudos ni px, Card `rounded-3xl` y el hijo un escalón abajo; en superficie clara usar `brand` (`#047857`) para enlaces, no `text-primary`; íconos de Lucide (`ShieldCheck`, `FileText`).
7. Si la SPA llegara a servir una ruta pública de legales: agregarla a `ROUTES`, a `PUBLIC_ROUTE_PREFIXES` (`packages/web/src/lib/api-client.ts:57-66`) y, si se enlaza desde mails, a `rootSpaRoutes` (`packages/api/src/index.ts:~255`).
8. Cross-browser: fechas ISO 8601 con `T`, `100dvh`, sin globales sueltos; en iOS el `ResponsiveDialog` ya usa Drawer.

### Fase 6. i18n

- **Web**: claves nuevas a la vez en `es`, `es-ES` y `pt` (`packages/web/src/i18n/locales/*/translation.json`); el test `i18n-parity.spec.ts` lo exige. Namespace propio `legal.*`; textos de error en `errors.*` y `KEY_BY_CODE` de `packages/web/src/lib/error-message.ts` si hay `TERMS_REQUIRED`. Tono: es con voseo, es-ES con tuteo peninsular, pt.
- **Landing**: `packages/landing/src/i18n/locales/{es,pt}/translation.json`. El test de paridad **no cubre la landing**; solo la regla 1 del hook al editar.
- El contenido jurídico en es-ES y pt debe tener revisión de abogado en cada idioma; el test de paridad no verifica equivalencia de contenido. Definir qué idioma prevalece (típicamente es-AR / el contractual).

### Fase 7. landing (`packages/landing`)

1. **Páginas legales** `/home/terminos` y `/home/privacidad` (más una de seguridad, o ancla). La landing es SPA sin router y nginx ya devuelve `index.html` para cualquier `/home/*` (`try_files $uri @spa`), así que funcionan sin tocar nginx ni el proxy de la API. Opciones de menor a mayor costo: (1) leer `location.pathname` en `App.tsx` y renderizar `<LegalPage>`; (2) entradas HTML múltiples de Vite con `<title>` y canonical propios (mejor para SEO y para enlaces desde mails, requiere ajustar nginx); (3) `react-router-dom` (dependencia nueva). Las notas recomiendan (1) como la menos invasiva y (2) como mejor para SEO.
2. **Footer**: links legales (hoy no hay) en `packages/landing/src/sections/Footer.tsx`. **Nav**: las anclas (`#pricing`...) se rompen en rutas legales; prefijarlas con `/home/` o esconderlas.
3. **Sección Seguridad** (`Security.tsx`, claves `security.*`): reescribir con las promesas de la sección 5 y un enlace "Más información". Confirmar o suavizar "Backups todos los días" antes de publicar.
4. **Versión**: la landing no depende de `@luma/shared`; su Dockerfile solo copia el `package.json` de shared por el lockfile. O se agrega la dependencia (y se buildea shared en el Dockerfile) o la fecha de vigencia se duplica en i18n ("se cambian juntos", como `pricing.*` con `PLAN`). Decisión abierta.
5. Cada versión debería quedar archivada e inmutable (por ejemplo `/home/legal/terminos/v2026-11`) con la vigente apuntando a la última, para poder reconstruir qué leyó cada usuario. `<title>`, canonical y `<html lang>` fijos hoy en `index.html`: considerar el skill `seo-geo-consultant`. Evitar soft-404: hoy cualquier `/home/lo-que-sea` da 200.

### Fase 8. tests

| Tipo | Qué | Dónde |
|---|---|---|
| Unit shared | `needsReacceptance`, schema con `acceptedTerms` | `packages/shared/src/legal/index.spec.ts`, `schemas/auth.spec.ts` |
| Unit API | `register` con/sin aceptación, `setPassword` con aceptación, `accept-terms`, servicio de consentimiento; sumar el mock de `ConsentRecord` | `packages/api/src/__tests__/controllers/auth.controller.spec.ts`, `__tests__/services/consent.service.spec.ts` |
| Unit web | Lógica pura del gate | `packages/web/src/lib/legal.spec.ts` |
| E2E | Helper, registro, activación, modal | `/e2e` |

E2E (mayor riesgo de regresión):

- **`registerWith`** en `e2e/helpers/auth.ts` debe marcar `#acceptTerms`; lo usan al menos 10 specs y sin ese cambio se rompen todos.
- **`seed-e2e-users.ts`** debe dejar aceptación vigente en todas las cuentas fijas; si no, el modal bloquea todos los specs con sesión.
- `e2e/auth.spec.ts`: sin aceptar no se envía el registro (sin API, no necesita `requiresApi()`).
- Spec nuevo con `requiresApi()` para el modal de re-aceptación: usuario con aceptación vencida ve el diálogo, Escape no lo cierra, acepta y entra. Requiere una cuenta pendiente (entrada nueva en `e2e/fixtures/users.json`, por ejemplo `legalPending`, y su clave en `E2EUserKey`) o dejar caducar la aceptación por API. Nunca credenciales a mano (regla 11 del hook).
- La landing no tiene `test` ni E2E: verificar a mano con `pnpm dev:landing` y revisar la consola. Los E2E corren solo en Chromium (no instalar WebKit).
- Cierre con el skill `verify`: typecheck, lint, unit, e2e.

### Fase 9. deploy

- `pnpm bump:web minor` (feature nueva en `packages/web`, versión actual 0.16.0); sube `version.json` y activa `UpdateNotification`. Ojo: `initializeVersionManager()` limpia localStorage al cambiar la versión (no se verificó qué borra exactamente).
- Desplegar API y web juntos (la imagen de la app sirve ambos), y luego la landing. Si hay cambios de configuración (env vars, dominios, redirects), usar primero el skill `coolify-deploy` y el MCP de Coolify, inspeccionando antes de modificar.
- **Orden de salida de la re-aceptación**: publicar primero los textos en la landing, después activar el modal. Para existentes, no hay migración: sin registro, ven el modal al próximo ingreso. Si se elige gate de API, considerar una ventana previa con modal y aviso por mail antes de empezar a bloquear escrituras.
- Verificar que la consola cargue sin errores en Chromium. Antes de publicar las promesas, confirmar el job real de backups (`scripts/mongo-backup.sh`) y la retención.

---

## 8. Decisiones abiertas para el dueño

Marcadas con (BLOQUEA) las que impiden avanzar sin respuesta.

1. **(BLOQUEA) ¿Se crea el modelo nuevo `ConsentRecord` (B) o se empieza con campos en `User` (A)?** `CLAUDE.md` dice textualmente: "No inventes entidades de negocio. Si una tarea necesita un modelo nuevo, preguntá antes de crearlo". Es infraestructura de cuenta y no una entidad de obra, pero la regla es literal y debe consultarse. Recomendación: B.
2. **Baja lógica vs promesa de eliminación (conflicto con CLAUDE.md).** Hoy `account_status:'inactive'` + `enabled:false` y "nunca se borra el documento". Eso contradice prometer "eliminamos tus datos". Opciones: (a) prometer solo "desactivamos tu cuenta y dejamos de usar tus datos", sin decir "eliminar"; (b) definir una purga real con plazo (por ejemplo 60 a 90 días, como 37signals) con borrado efectivo, lo que cambia la regla de baja lógica y exige un job; (c) distinguir lo que se debe conservar (cobros, gastos, comprobantes: hechos con fecha, regla de Plata) de lo que se puede anonimizar. **No prometer eliminación antes de resolver esto.** Los datos de una obra compartida pertenecen a la obra (decide el gerente), no solo a un usuario.
3. **¿Obligatoriedad solo por UI o también por API (`TERMS_REQUIRED`)?** Costo de consulta o claim desactualizado frente a obligatoriedad real.
4. **¿Términos y privacidad se aceptan juntos o por separado?** Separados dan versiones independientes; el consentimiento opcional (marketing) no debe atarse al acceso.
5. **¿Se guardan IP y user agent?** Son datos personales: si se guardan, mencionarlos en la política, definir retención y limitar acceso. Se puede truncar o hashear la IP si el abogado lo pide.
6. **¿Dónde viven los textos legales y quién los redacta?** Propuesta: landing como fuente única y enlaces desde la SPA. Falta definir qué se hashea si el texto está en i18n (por idioma) y qué idioma prevalece.
7. **¿Cómo se versiona el texto en la landing?** Dependencia de `@luma/shared` en la landing o duplicar la fecha en i18n.
8. **¿Aviso por mail ante cambios de versión?** Y con qué preaviso (15 a 30 días propuestos, práctica y no obligación) y cuál es el criterio de "cambio material".
9. **Invitados**: ¿aceptan al activar (propuesta) o en el primer ingreso? ¿Qué dicen los términos sobre la responsabilidad del dueño de la Empresa de informar a su equipo?
10. **Ruta pública de la landing**: por `pathname` (simple) o entradas HTML múltiples (mejor SEO).
11. **Identidad legal**: persona jurídica titular de Luma, jurisdicción, domicilio y correo de contacto legal. No están en el repo (el footer solo acredita "Ido Arquitectura e Ioce Velasco").
12. **Alcance de la promesa**: ¿entran las "estadísticas agregadas"? ¿Qué se dice del Consultor IA (Anthropic procesa texto de la obra)? ¿Y de los datos de pago de la suscripción?
13. **Verificaciones técnicas previas a publicar**: frecuencia y retención reales de backups, cifrado en reposo, país de alojamiento del servidor, quién es el proveedor del `media-service`.
14. **Redirect de pantallas y E2E**: crear la cuenta fija `legalPending` en `e2e/fixtures/users.json` (CLAUDE.md pide una entrada por tipo de usuario).

---

## 9. Riesgos principales

- **Regresión E2E**: `registerWith` (~10 specs) y el seed; sin tocarlos se rompe toda la suite con sesión.
- **Sesión desactualizada**: el `AuthUser` en localStorage no se refresca; sin sincronizar con `/me` el modal no aparece al publicar una versión nueva.
- **Contrato público de `/api/auth/register`**: un campo requerido nuevo devuelve 400 a una SPA vieja abierta hasta que recargue; mitigar con deploy conjunto y `UpdateNotification`, o campo opcional por una ventana.
- **Promesas no respaldadas**: "Backups todos los días" y "Nadie entra si no lo invitás" ya están publicados sin verificación.
- **Datos personales nuevos**: IP y user agent exigen política y retención.
- **Landing sin tests** y con anclas que se rompen en rutas legales.
- **Estilo de `auth.controller.ts`**: usa `return res.status(...)` y `errMsg(error)`; el código nuevo debe lanzar errores y no filtrar mensajes internos.

---

## 10. Límites de esta investigación

- **No es asesoría legal.** Todo el marco normativo debe ser validado por un abogado venezolano, incluidos: vigencia 2026 de las leyes citadas y ausencia de proyecto de datos personales; texto literal del art. 28 CRBV (el PDF consultado no correspondía de forma fiable); número exacto de la sentencia del TSJ de 2011; normativa de consumo sobre contratos de adhesión; cláusula de foro o arbitraje; límites de cláusulas de exoneración en derecho venezolano; reformas posteriores a la Ley de Mensajes de Datos y su reglamento.
- Las fuentes de jurisprudencia estadounidense y de apps (Berman, Meyer, Alkutkar, Zoom, Drizly, etc.) son mayormente secundarias; verificar contra la sentencia o el comunicado antes de citar. Drizly, Notion y varias políticas (Procore, Mercado Pago) no se pudieron leer directamente.
- No hay referencias de políticas de apps venezolanas (Reserve, Zinli, Yummy, Airtm); no se evaluó el riesgo político o cambiario con fuentes.
- No se verificó en el código: dónde se inyecta `recaptchaToken`, cómo capturan el `throw` los handlers `async`, qué borra `initializeVersionManager()`, si `useCurrentUser` se usa en algún componente, `playwright.config.ts`, `docs/CORREOS.md` ni si los mails tienen versión pt/es-ES.
- Los números de línea provienen de la auditoría y pueden haber cambiado; re-verificar al implementar.
