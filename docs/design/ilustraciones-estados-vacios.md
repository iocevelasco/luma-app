# Ilustraciones de estados vacíos

Reemplazan el círculo con ícono de Lucide en los vacíos y errores de carga
(`components/common/empty-state.tsx`). Salen de `media-gen` (Gemini) y viven en
`packages/web/public/empty-states/<nombre>.webp`, 320×320, ≤ 20 KB.

## Estilo gráfico (referencia: set de ilustraciones "soft UI")

- **Objetos planos y redondeados**, armados con formas geométricas simples y radios grandes.
  Aspecto de plástico mate, sin contornos, sin degradés, sin texturas, sin perspectiva.
- **Casi monocromo**: cuerpo en gris muy claro (`#F4F4F5` / `#E4E4E7`) y un segundo gris
  azulado más oscuro (`#D4D4D8`) sólo en el plano lateral o trasero que da una
  profundidad 2.5D leve (el objeto "extruido" unos píxeles hacia abajo y a la derecha).
- **Objetos secundarios** más claros, apilados o asomando por detrás del principal.
- **Un solo color de acento**, en 1 a 3 elementos chicos: una insignia redonda con un
  glifo (+, ✓, ↑), rayitas en forma de píldora y un punto. En la referencia es azul; acá es
  el verde de la marca `#00D992`, con el glifo en `#101010` (nunca blanco). No pasa del ~8 %
  de la figura.
- **Un detalle de personalidad**: una sonrisa mínima o dos puntos sobre el objeto principal.
- **Composición**: un objeto centrado, fondo blanco puro, mucho aire (la figura ocupa ~55 %
  del cuadro). Sin texto, sin logos, sin sombra de piso.

## Prompt base

Vive en `ilustraciones-estados-vacios.style.txt` y se pasa con `--style-file`; la imagen de
referencia del set, con `--ref … --ref-role style`. Cada ilustración suma sólo el objeto:

```bash
python3 .claude/skills/media-gen/scripts/generate.py image \
  "A friendly construction safety hard hat resting on a rolled-up blueprint, with a small green round badge with a dark plus sign in front" \
  --width 320 --height 320 --single --name obras --out packages/web/public/empty-states \
  --max-kb 20 --ref <referencia.jpg> --ref-role style \
  --style-file docs/design/ilustraciones-estados-vacios.style.txt --no-text --alt "Una obra por empezar"
```

Costo: ≈ USD 0,037 por imagen. Para una ilustración nueva, repetir con otro `--name` y
sumar el ícono a `ILLUSTRATION_BY_ICON`.

## Dónde va cada una

El componente elige la ilustración por el ícono que ya pasa cada pantalla; ningún
call-site cambió. Un ícono sin ilustración sigue con el círculo.

| Ilustración | Ícono Lucide | Vistas |
|---|---|---|
| `obras` | `HardHat` | Inicio sin obras (`admin-home`), cuadrilla vacía (`team-directory`) |
| `presupuesto` | `Calculator` | Presupuesto de la obra |
| `gastos` | `Receipt` | Gastos de la obra |
| `cobros` | `Wallet` | Cobros de la obra |
| `materiales` | `Package` | Materiales |
| `deposito` | `Warehouse` | Depósito, inventario de la obra |
| `proveedores` | `Wrench` | Proveedores (libreta y obra) |
| `hitos` | `Flag` | Hitos |
| `actividades` | `CalendarRange` | Tablero y Cronograma sin tareas |
| `papelera` | `Trash2` | Papelera de obras |
| `equipo` | `Briefcase`, `Users` | Equipo de la Empresa, usuarios de plataforma |
| `sin-resultados` | `SearchX` | Filtros sin coincidencias (gastos, cobros) |
| `error` | `AlertTriangle` | Error de carga (`responsive-table`) |
| `vacio` | `Inbox`, `Mail`, `ListChecks` | Genérico: pagos de plataforma, campañas, seguimiento |

## Notas

- **El fondo es blanco, no transparente** (el modelo no genera alfa). En superficie clara el
  `<img>` lleva `mix-blend-multiply`, que funde el blanco con el lienzo gris. En superficie
  oscura (`dark:`) no funde: ahí se muestra el círculo con el ícono de siempre.
- Son decorativas: `alt=""`. El título y la descripción dicen lo que pasa.
