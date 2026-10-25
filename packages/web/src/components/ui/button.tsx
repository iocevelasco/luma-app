import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Píldora con relieve: la forma la comparte con el badge, así que lo que dice
// "esto se toca" es el volumen. El foco es un anillo verde separado del botón
// por 2px de aire — sobre un relleno verde, un anillo pegado no se vería.
// `outline` y no `ring`: el ring es box-shadow y pisaría el relieve.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // El CTA primario es el verde de marca (#00d992). Texto on-primary
        // (#101010) da ~10.3:1 — pasa AA con margen de sobra, así que no hace
        // falta que --primary cambie de hex por tema. Ver DESIGN.md.
        default:
          "border border-primary-pressed bg-primary text-primary-foreground shadow-cta hover:bg-primary-pressed active:shadow-cta-pressed",
        destructive:
          "bg-destructive text-white shadow-cta hover:bg-destructive/90 active:shadow-cta-pressed focus-visible:outline-destructive dark:bg-destructive/60",
        // Superficie blanca (`card`) con la sombra suave de los tabs y sin
        // borde: no hay variante "de contorno". Sobre el lienzo gris se lee
        // como un botón por el relleno y la sombra, no por un marco. Va en
        // `foreground` y no en verde — son los "Cancelar" y "Volver" del
        // panel, y el verde se reserva para la acción principal. En una
        // superficie oscura `card` es el oscuro del tema.
        outline:
          "bg-card text-foreground shadow-surface hover:bg-accent active:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground shadow-raised hover:brightness-125 active:shadow-cta-pressed",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
