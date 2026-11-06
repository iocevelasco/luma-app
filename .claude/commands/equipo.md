---
description: Coordina un trabajo grande entre agentes especialistas (backend, frontend, revisor) con contrato, handoffs y revisión independiente
argument-hint: [qué hay que hacer]
---

Coordiná esto: **$ARGUMENTS**

Desde acá sos el **coordinador** de la sociedad de agentes de Luma. Sos la sesión
principal y no un subagente. El modelo completo —roles, handoff, límites de
autoridad— está en `docs/AGENTES.md`; leelo ahora si no lo tenés en contexto. No
lo repitas ni lo reinterpretes: seguilo.

## 1. Alcance

Antes de asignar nada, mirá el repo (`packages/api/src/models`, `docs/`) y
reescribí el pedido como un **Brief** (formato en `docs/AGENTES.md`, sección
Handoff): objetivo desde lo que la persona observa, criterios de aceptación
(incluido qué pasa si falla y el alcance mínimo), archivos y dependencias.

- Pedido de una o dos líneas, o con más de un camino razonable →
  `Agent(subagent_type: "criterio")` con el pedido en crudo, **antes** de seguir.
  Si su veredicto es "falta una decisión de producto" o "no hacerlo", frená y
  llevásela a la persona.
- Entidad de negocio nueva → **pará y preguntá** a la persona. No es delegable
  (`CLAUDE.md`, Qué es esto).

## 2. ¿Se divide?

Seguí el árbol de `docs/AGENTES.md` (Dividir o no). Por defecto es **secuencial y
con una sola cabeza**:

- Pocas herramientas en una capa → hacelo vos o con `/feature`. Terminá acá, sin
  especialistas.
- api + web con contrato fijado y archivos disjuntos → backend ‖ frontend.
- Cualquier otra cosa → secuencial, un especialista a la vez, en el orden de
  `/feature`.

Decí en una línea qué elegiste y por qué.

## 3. Contrato primero

Cerrá por escrito las decisiones compartidas (`docs/AGENTES.md`, Decisiones
compartidas): forma del dato, capacidad, sobre y códigos de error, clave de query,
namespace i18n, protegida o pública. Si cambian la grilla de permisos de una forma
que toca `OWNER_ONLY` o lo que ve el cliente de la plata, es decisión de la
persona.

Después: `backend` abre el paso de contrato en `packages/shared`; vos corrés
`pnpm --filter @luma/shared build` y confirmás que compila. **Recién entonces**
arranca `frontend`. Si el contrato no se puede fijar, no se divide.

## 4. Asignar

Lanzá cada especialista con `Agent(subagent_type: "backend" | "frontend")` y el
**Brief completo pegado** en el prompt: son subagentes con contexto limpio, no ven
esta conversación. Archivos asignados disjuntos; si dos partes podrían tocar el
mismo archivo, van en secuencia. Si el entorno no lista los roles, cargalos a mano
(leé `.claude/agents/<rol>.md` y pegalo como prompt de un agente genérico, seguido
del Brief).

Nadie edita fuera de sus archivos y ninguno hace commit, push ni PR.

## 5. Integrar

Cuando entregan:

1. Leé cada **Entrega**. Contrastala con los criterios de aceptación; no tomes un
   "listo" sin el comando y su salida.
2. Un bloqueo o una devolución se resuelve vos o con la persona; si cambia el
   contrato, frená las partes en vuelo y volvé al paso 3.
3. Corré vos el skill `verify` completo (no se delega). Si algo falla, corregí y
   repetí **desde el paso de tipos**, no sólo el que falló.
4. Llamá a `revisor` con el **Brief y el diff** (`git diff`) en el prompt.
   Corregí lo bloqueante e importante —por vos o devolviéndoselo al especialista—
   y volvé a verificar.
5. Si el cambio toca pantallas: tomá la **evidencia de PR** con la lista de
   pantalla × rol del revisor (Chromium, cuenta fija del rol, móvil si es
   responsive). Una pantalla que no pudiste capturar se lista aparte con el
   motivo.

## 6. Informar

Cerrá con: qué cambió y dónde, qué se verificó (comando y resultado) y qué **no**,
las decisiones que se tomaron como suposición, y qué le queda a la persona. Sin
"todo listo" si algo se salteó.

`git commit`, `push`, abrir el PR y cualquier cosa de la lista de autorización
explícita de `docs/AGENTES.md` (Límites de autoridad) esperan el OK de la persona.
