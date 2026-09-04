# Luma

Plataforma de gestión y ejecución de obras y remodelaciones.

El problema que resuelve no es la falta de herramientas de planificación: es la
**fricción en la comunicación**. Los imprevistos se comunican tarde, sin
justificación clara y sin contexto presupuestal, y eso genera desconfianza del
cliente hacia el ejecutante. Luma es una capa de comunicación estructurada sobre
la operación diaria de la obra.

## Estado

Esqueleto del MVP (Fase 1 + el módulo de imprevistos, que es el diferenciador).
Compila y corre; falta la suite de tests y el pipeline de deploy.

## Arquitectura

Monorepo con pnpm workspaces. La estructura y la infraestructura vienen de
[`pantera-negra-wep-app`](https://github.com/iocevelasco/pantera-negra-wep-app);
el dominio es nuevo. El contraste completo está en
[`docs/ANALISIS-PANTERA.md`](docs/ANALISIS-PANTERA.md).

```
packages/
├── shared/   Tipos + schemas Zod + utilidades puras (importado por api y web)
├── api/      Node 18+ · Express 4 · TypeScript ESM · Mongoose 8 · Zod
└── web/      Vite 6 · React 19 · TypeScript · Tailwind v4 · TanStack Query
```

**Multi-tenant por proyecto.** `project_id` es el filtro implícito de cada
query, igual que `dojo_id` en Pantera. El rol vive en `ProjectMember` y no en el
usuario: la misma persona es ejecutante en su obra y cliente en la de otro.

**Los permisos son una matriz, no una jerarquía.** `ROLE_PERMISSIONS` vive en
`packages/shared`, el backend la usa en `requirePermission()` y el frontend en
`can()`. Una pantalla nunca puede ofrecer una acción que la API va a rechazar.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env          # editá MONGODB_URI y JWT_SECRET
pnpm --filter @luma/shared build
pnpm seed:demo                # proyecto de ejemplo con las 4 cuentas
pnpm dev                      # API en :8080, web en :5173
```

El seed crea el proyecto *Remodelación Depto Belgrano* con cuatro cuentas
(contraseña `luma1234`), una por rol:

| Cuenta | Rol |
|---|---|
| `ejecutante@luma.demo` | Ejecutante — ve y decide todo |
| `encargado@luma.demo` | Arquitecto/ingeniero — aprueba imprevistos |
| `asistente@luma.demo` | Asistente de obra — carga avance, no aprueba |
| `cliente@luma.demo` | Cliente — vista simplificada, aprueba sobrecostos |

Sin `RESEND_API_KEY` los emails se loguean por consola con su link, así que el
flujo de verificación e invitación se puede probar sin credenciales. Sin
`ANTHROPIC_API_KEY` el asistente responde 503 y el resto de la app funciona
igual.

## Requisitos funcionales implementados

| RF | Qué | Dónde |
|---|---|---|
| RF-01 | Planificación semanal, navegación entre semanas, indicador de atraso | `pages/planning.tsx`, `routes/activities.ts` |
| RF-02 | Materiales con estado, alerta de bloqueo, lista consolidada de compras | `pages/materials.tsx`, `routes/materials.ts` |
| RF-03 | Personal esperado vs presente por día, quién está en qué actividad | `pages/personnel.tsx`, `routes/personnel.ts` |
| RF-04 | Estados de actividad a un toque, % de avance ponderado | `pages/planning.tsx` |
| RF-05 | Importación de planilla con vista previa, línea base versionada, semáforo, margen de maniobra | `services/budget.service.ts`, `pages/budget.tsx` |
| RF-06 | Asistente conversacional con contexto recortado por rol y enlaces de verificación | `services/assistant.service.ts`, `pages/assistant.tsx` |
| RF-07 | Registro estructurado del imprevisto, causa obligatoria | `models/Contingency.ts`, `pages/contingencies.tsx` |
| RF-08 | Flujo de 6 pasos con aprobación interna y decisión del cliente | `services/contingency.service.ts` |
| RF-09 | Agrupación, contexto presupuestal siempre presente, ventana horaria | `services/notification.service.ts`, `services/email.service.ts` |
| RF-10 | Cierre proyectado del presupuesto, fecha de fin proyectada, alertas | `services/dashboard.service.ts` → `buildForecast()` |

## Fuera de alcance, a propósito

- **Pagos y anticipos.** El control financiero se limita al presupuesto:
  inicial, comprometido, ejecutado y saldo disponible. Recaudo, flujo de caja y
  facturación quedan en las herramientas contables del ejecutante.
- **WhatsApp.** Se descartó por decisión de diseño (RF-06) y se reemplazó por el
  asistente dentro de la plataforma.
- **Nómina, contabilidad formal, BIM, marketplace de materiales, licitaciones.**

## Comandos

```bash
pnpm dev          # todo
pnpm dev:api      # sólo la API
pnpm dev:web      # sólo el frontend
pnpm build        # build de los tres paquetes
pnpm typecheck    # tsc --noEmit en todos
pnpm seed:demo    # datos de ejemplo
```

## Preguntas abiertas

Las siete del §13 del documento funcional siguen abiertas y algunas afectan el
modelo de datos. La más urgente es la 7: **qué tan estandarizadas están las
planillas reales de los ejecutantes.** El importador de `budget.service.ts`
detecta columnas por encabezado y deja corregir el mapeo, pero sin muestras
reales no se sabe si eso alcanza.
