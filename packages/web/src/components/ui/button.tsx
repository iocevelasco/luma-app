import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { buttonVariants as heroButtonVariants } from "@heroui/styles";

import { cn } from "@/lib/utils";

// Adaptador sobre HeroUI v3 (ADR-003, fase 1). La API es la de siempre —los
// nombres de variante y de tamaño de shadcn, `asChild`, `onClick`, `disabled`—,
// el aspecto sale de las clases de HeroUI (`.button--primary`…) y sus colores,
// de los tokens de Luma vía `styles/heroui.css`. No usa el componente de React
// Aria: es un <button> nativo, así que ningún call-site cambia de comportamiento.

type Variant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  // Nombres de HeroUI, para pantallas nuevas.
  | "primary"
  | "tertiary"
  | "danger"
  | "danger-soft";

type Size = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

const HERO_VARIANT = {
  default: "primary",
  primary: "primary",
  destructive: "danger",
  danger: "danger",
  "danger-soft": "danger-soft",
  outline: "outline",
  secondary: "secondary",
  tertiary: "tertiary",
  ghost: "ghost",
} as const;

const HERO_SIZE = {
  default: { size: "md", isIconOnly: false },
  sm: { size: "sm", isIconOnly: false },
  lg: { size: "lg", isIconOnly: false },
  icon: { size: "md", isIconOnly: true },
  "icon-sm": { size: "sm", isIconOnly: true },
  "icon-lg": { size: "lg", isIconOnly: true },
} as const;

// `link` no existe en HeroUI: es texto subrayado, sin la caja del botón.
const LINK =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0";

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: { variant?: Variant | null; size?: Size | null; className?: string } = {}) {
  const v = variant ?? "default";
  if (v === "link") return cn(LINK, className);
  const { size: heroSize, isIconOnly } = HERO_SIZE[size ?? "default"];
  return cn(
    heroButtonVariants({ variant: HERO_VARIANT[v], size: heroSize, isIconOnly }),
    // `shrink-0` y `pointer-events-none` eran de Luma; HeroUI sólo marca el
    // deshabilitado con opacidad y cursor.
    "shrink-0 disabled:pointer-events-none",
    className,
  );
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: Variant | null;
  size?: Size | null;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
