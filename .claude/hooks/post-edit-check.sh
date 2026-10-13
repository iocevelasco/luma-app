#!/usr/bin/env bash
# Verificación inmediata después de cada Edit/Write.
#
# Por qué existe: CLAUDE.md y DESIGN.md tienen reglas que se cumplen al principio
# de una sesión y se aflojan cuarenta herramientas después — tokens semánticos,
# radios de la escala, i18n en los dos idiomas. Una regla escrita se olvida; un
# hook no.
#
# Sale con código 2 cuando encuentra algo: eso devuelve el texto al modelo como
# feedback y lo obliga a corregir antes de seguir, en vez de dejarlo para CI.
set -uo pipefail

PAYLOAD=$(cat)
FILE=$(printf '%s' "$PAYLOAD" | node -e \
  'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path||"")}catch{}})')

[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

REPO=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REL=${FILE#"$REPO"/}
FINDINGS=""

add() { FINDINGS="${FINDINGS}$1"$'\n'; }
lines() { printf '%s' "$1" | sed 's/^/  /'; }

# ── 1. i18n: paridad es ↔ pt ────────────────────────────────────────────────
# Vale para web y para landing. El test de paridad sólo cubre web; acá cubrimos
# los dos y sin esperar a `pnpm test`.
case "$REL" in
  */i18n/locales/*/translation.json)
    PKG_I18N=$(printf '%s' "$REL" | sed 's#/locales/.*##')
    ES="$REPO/$PKG_I18N/locales/es/translation.json"
    PT="$REPO/$PKG_I18N/locales/pt/translation.json"
    if [ -f "$ES" ] && [ -f "$PT" ]; then
      DIFF=$(node -e '
        const fs=require("fs");
        const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>{
          const q=p?p+"."+k:k;
          return v&&typeof v==="object"&&!Array.isArray(v)?flat(v,q):[q];
        });
        const [a,b]=process.argv.slice(1).map(f=>new Set(flat(JSON.parse(fs.readFileSync(f,"utf8")))));
        const soloEs=[...a].filter(k=>!b.has(k));
        const soloPt=[...b].filter(k=>!a.has(k));
        if(soloEs.length) console.log("  faltan en pt: "+soloEs.join(", "));
        if(soloPt.length) console.log("  faltan en es: "+soloPt.join(", "));
      ' "$ES" "$PT")
      [ -n "$DIFF" ] && add "i18n — las claves no están en los dos idiomas:"$'\n'"$DIFF"$'\n'"  Toda clave nueva va a es y a pt en el mismo cambio (hay un test de paridad en CI)."
    fi
    ;;
esac

# ── 2. Estilos: tokens semánticos y escala de radio ─────────────────────────
case "$REL" in
  *.tsx|*.jsx)
    RAW=$(grep -nE '(bg|text|border|ring|fill|stroke|from|to|via)-\[#[0-9A-Fa-f]' "$FILE" || true)
    [ -n "$RAW" ] && add "Color crudo — saltea el tema. Usá tokens semánticos (bg-background, bg-card, text-muted-foreground, bg-primary):"$'\n'"$(lines "$RAW")"

    ARB=$(grep -nE 'rounded(-[a-z0-9]+)?-\[' "$FILE" || true)
    [ -n "$ARB" ] && add "Radio arbitrario — el redondeo sale de la escala: rounded-md (8px) en botones, rounded-sm (6px) en inputs, rounded-3xl (28px) en cards. Ver DESIGN.md:"$'\n'"$(lines "$ARB")"

    # La píldora no es la forma de los controles. rounded-full queda para lo
    # que es un ESTADO — badge, avatar, switch, slider, progress — no para una
    # acción.
    PILL=$(grep -nE '<(Button|button)[^>]*rounded-full' "$FILE" || true)
    [ -n "$PILL" ] && add "Botón píldora — este sistema no usa botones píldora. Los botones van rounded-md (8px); rounded-full queda para badges y avatares. Ver DESIGN.md:"$'\n'"$(lines "$PILL")"

    BTN=$(grep -nE '<Button[^>]*className="[^"]*rounded-' "$FILE" || true)
    [ -n "$BTN" ] && add "Button con rounded-* propio — Button ya trae el radio del sistema; el override lo saca de la escala:"$'\n'"$(lines "$BTN")"
    ;;
esac

# ── 3. i18n: strings visibles inline en el JSX ──────────────────────────────
# Heurística conservadora: sólo texto entre tags, dos palabras o más, sin llaves.
case "$REL" in
  packages/web/src/*.tsx|packages/landing/src/*.tsx)
    INLINE=$(grep -nE '>[[:space:]]*[A-ZÁÉÍÓÚÑa-záéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ]+([[:space:]]+[A-Za-zÁÉÍÓÚÑáéíóúñ,.]+)+[[:space:]]*<' "$FILE" \
      | grep -v '{' | grep -vE '(className|import|from)' || true)
    [ -n "$INLINE" ] && add "Posible string visible inline — ningún texto visible se escribe en el JSX, va por t('clave'). Verificá estas líneas:"$'\n'"$(lines "$INLINE")"
    ;;
esac

# ── 4. Componentes de shadcn: no se editan ──────────────────────────────────
case "$REL" in
  packages/web/src/components/ui/*)
    add "Estás editando un componente de components/ui/. Esos no se editan: se extienden por className o se envuelven. La excepción es un cambio del sistema de diseño que DEBE vivir en el componente (el radio o el color del Button, por ejemplo) — si es eso, seguí; si no, envolvelo."
    ;;
esac

# ── 5. shared cambió: api y web compilan contra su dist ─────────────────────
case "$REL" in
  packages/shared/src/*)
    add "Tocaste @luma/shared. api y web importan su dist, no su fuente: corré \`pnpm --filter @luma/shared build\` antes de typecheckear o vas a ver errores de tipo que no son reales."
    ;;
esac

# ── 6. El pipeline de index.ts tiene un orden deliberado ────────────────────
case "$REL" in
  packages/api/src/index.ts)
    add "index.ts: el orden del pipeline no es arbitrario — trust proxy antes del rate limit, el handler manual de OPTIONS * antes de cors(), errorHandler al final. Si moviste algo, confirmá que sigue en su lugar."
    ;;
esac

# ── 7. Permisos de obra: la grilla es el único lugar donde se compara un rol ─
# `role === 'supervisor'` repartido por controllers y componentes es exactamente
# la duplicación que la grilla vino a evitar: la copia que se desincroniza es
# siempre la que decide qué botón se muestra.
case "$REL" in
  packages/shared/src/permissions/*|packages/api/src/middleware/project.middleware.ts)
    ;;
  packages/api/src/*|packages/web/src/*)
    ROLECMP=$(grep -nE "(projectRole|\.role|role)[[:space:]]*[!=]==[[:space:]]*'(gerente|supervisor|cliente)'" "$FILE" || true)
    [ -n "$ROLECMP" ] && add "Comparación directa contra un rol de obra — quién puede qué vive en la grilla de packages/shared/src/permissions/. En la API preguntá con req.can('la.capacidad'), en la UI con project.capabilities. Si falta la capacidad, agregala a la grilla:"$'\n'"$(lines "$ROLECMP")"

    FLAGS=$(grep -nE "isProjectOwner|isProjectEditor|\.isOwner|\.isEditor" "$FILE" || true)
    [ -n "$FLAGS" ] && add "isProjectOwner/isProjectEditor están deprecados — son azúcar derivada de la grilla y no distinguen supervisor de cliente. En código nuevo usá req.can(...) o project.capabilities:"$'\n'"$(lines "$FLAGS")"
    ;;
esac

# ── 8. Plata: cobros y gastos no comparten gate ─────────────────────────────
# Una ruta de gastos gateada con `payment.*` deja que el cliente calcule el
# margen del ejecutante con un curl. Es la regla 13, y es el error de una sola
# palabra que no se ve leyendo el diff.
case "$REL" in
  packages/api/src/routes/*)
    LEAK=$(grep -nE "(expenses|summary|payroll)[^)]*requireCapability\('payment\." "$FILE" || true)
    [ -n "$LEAK" ] && add "Ruta de gastos gateada con una capacidad de cobros — el cliente tiene payment.read y con cobros+gastos despeja tu margen restando. Usá requireCapability('expense.read') o ('expense.write'):"$'\n'"$(lines "$LEAK")"

    # Un cobro es un hecho con fecha: se borra y se carga de nuevo, no se edita.
    PATCHPAY=$(grep -nE "\.patch\(\s*'/payments" "$FILE" || true)
    [ -n "$PATCHPAY" ] && add "PATCH sobre un cobro — los cobros no se editan: corregir el monto in situ deja el saldo cuadrando con una historia que nadie vivió. Se borra y se carga de nuevo (ver CLAUDE.md, sección Plata):"$'\n'"$(lines "$PATCHPAY")"
    ;;
esac

# ── 9. Errores: un solo canal y un solo traductor ───────────────────────────
case "$REL" in
  packages/web/src/lib/error-message.ts)
    ;;
  packages/web/src/hooks/*)
    DUP=$(grep -nE "^function errorMessage" "$FILE" || true)
    [ -n "$DUP" ] && add "errorMessage local en un hook — hay uno solo, en lib/error-message.ts. Un helper por hook hace que la misma falla diga cosas distintas en cada pantalla:"$'\n'"$(lines "$DUP")"
    ;;
esac

if [ -n "$FINDINGS" ]; then
  printf 'Revisión automática de %s:\n\n%s' "$REL" "$FINDINGS" >&2
  exit 2
fi
exit 0
