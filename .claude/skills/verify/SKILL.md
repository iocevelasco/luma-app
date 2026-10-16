---
name: verify
description: Corre la secuencia de cierre de una feature en Luma — typecheck, lint, unit y e2e en Chromium. Usalo cuando el usuario dice que terminó algo, pide verificar, quiere saber si está listo para commitear o mergear, o antes de abrir un PR.
---

# Verificar una feature

"Terminé" no es un estado observable. Esta secuencia lo convierte en uno.

Corré los pasos **en orden** y no sigas al siguiente si el anterior falló: un
error de tipos hace que el lint y los tests reporten ruido derivado, y vas a
perder tiempo persiguiendo síntomas.

## 0. Qué cambió

```bash
git status --short && git diff --stat
```

Necesitás el diff para decidir el paso 5. Si el diff está vacío, no hay nada que
verificar — decilo y frená acá.

## 1. shared primero

Si el diff toca `packages/shared/`:

```bash
pnpm --filter @luma/shared build
```

`api` y `web` importan `@luma/shared` por nombre de paquete contra su `dist`. Sin
este build vas a ver errores de tipo que no existen.

## 2. Tipos

```bash
pnpm typecheck
```

Los cuatro paquetes.

## 3. Lint

```bash
pnpm lint
```

Si falla por algo mecánico (orden de imports, comillas), `pnpm lint:fix` y volvé
a correr. Si falla por una regla real, arreglá el código — no silencies la regla
con un `eslint-disable` salvo que puedas justificar en una línea por qué ese caso
es la excepción.

## 4. Unit

```bash
pnpm test
```

Cubre `api`, `web` y `shared`. **`landing` no tiene script de `test`**, así que
`pnpm -r test` lo saltea en silencio: si tu cambio fue en la landing, este paso
no probó nada tuyo y tenés que decirlo explícitamente al reportar.

Mirá especialmente si corrió `i18n-parity.spec.ts` cuando tocaste traducciones.

## 5. E2E

```bash
pnpm test:e2e:ci
```

Chromium. Es lo mismo que corre CI, así que un verde acá predice el verde del PR.

Sólo Chromium: no se testea en otros motores ni se instalan. Lo de Safari se cuida al
escribir el código (ver "Cross-browsing" en CLAUDE.md).

### Revisión a ojo de lo que rompe en Safari

Si el diff toca cualquiera de estas cosas, leé ese código buscando el fallback:

- Un global del browser (`requestIdleCallback`, `IntersectionObserver`,
  `structuredClone`, `navigator.*`, `crypto.*`, `ResizeObserver`, `Notification`).
- Parseo o construcción de fechas. Safari es estricto: `new Date('2026-08-13 10:00')`
  es `Invalid Date` ahí y funciona en Chrome. Tiene que ser ISO 8601 con `T`.
- CSS de viewport (`100vh` → `100dvh`), `:has()`, `backdrop-filter`, scroll
  snapping, o cualquier cosa con prefijo.
- Cookies, storage o el flujo de refresh token — el ITP de Safari cambia el
  comportamiento de las cookies de tercera parte.

Mientras revisás el diff, chequeá a ojo la regla que más se rompe: **un global
del browser leído como identificador suelto**. `requestIdleCallback?.(fn)` tira
`ReferenceError` en Safari — `?.` protege contra `null`, no contra un binding que
no existe. Tiene que ser `typeof window.requestIdleCallback === 'function'`.

## 6. Reportar

Decí qué corrió, qué pasó y qué **no** se verificó. Un reporte honesto se parece
a esto:

> typecheck ✅ · lint ✅ · unit ✅ (34) · e2e chromium ✅ (12)
> Revisé a ojo el uso de `ResizeObserver`: tiene fallback.
> Sin cubrir: el caso de refresh token expirado no tiene test — el cambio lo toca.

No digas "todo listo" si algo se salteó. Si un paso falló y lo arreglaste, volvé
a correr **desde el paso 2**, no sólo el que falló.
