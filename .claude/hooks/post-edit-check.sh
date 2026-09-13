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
    [ -n "$RAW" ] && add "Color crudo — saltea el tema. Usá tokens semánticos (bg-background, text-muted-foreground, bg-primary, bg-cream):"$'\n'"$(lines "$RAW")"

    ARB=$(grep -nE 'rounded(-[a-z0-9]+)?-\[' "$FILE" || true)
    [ -n "$ARB" ] && add "Radio arbitrario — el redondeo sale de la escala: rounded-md (8px) en botones e inputs, rounded-lg (12px) en cards y paneles. Ver DESIGN.md:"$'\n'"$(lines "$ARB")"

    # La píldora dejó de ser la forma de los controles: este sistema es
    # editorial. rounded-full queda para lo que es un ESTADO — badge, avatar,
    # switch, slider, progress — no para una acción.
    PILL=$(grep -nE '<(Button|button)[^>]*rounded-full' "$FILE" || true)
    [ -n "$PILL" ] && add "Botón píldora — este sistema no usa botones píldora. Los botones van rounded-md (8px); rounded-full queda para badges y avatares. Ver DESIGN.md:"$'\n'"$(lines "$PILL")"

    BTN=$(grep -nE '<Button[^>]*className="[^"]*rounded-' "$FILE" || true)
    [ -n "$BTN" ] && add "Button con rounded-* propio — Button ya trae el radio del sistema; el override lo saca de la escala:"$'\n'"$(lines "$BTN")"

    # #fa520f con blanco encima da 3.34:1 y no pasa AA. Para relleno va
    # bg-primary, que ya resuelve el contraste por tema.
    BRANDFILL=$(grep -nE 'bg-brand\b' "$FILE" || true)
    [ -n "$BRANDFILL" ] && add "bg-brand como relleno — el naranja de marca con texto encima no pasa contraste AA (3.34:1). Para rellenar usá bg-primary; bg-brand es para tinta, bordes e íconos:"$'\n'"$(lines "$BRANDFILL")"
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

if [ -n "$FINDINGS" ]; then
  printf 'Revisión automática de %s:\n\n%s' "$REL" "$FINDINGS" >&2
  exit 2
fi
exit 0
