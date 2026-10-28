"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

/**
 * Los tabs de la app: un contenedor blanco y suave, y cada pestaña un cuadrado
 * de esquinas redondeadas (no una píldora) con su ícono. La activa se marca con
 * un gris apenas más oscuro que el lienzo, no con un color: la pestaña elegida
 * se lee por el relleno y el resto queda atenuado. El relleno se desliza de una
 * pestaña a la otra al cambiar.
 *
 * Es un cambio del sistema y por eso vive acá y no en cada pantalla (ver
 * "shadcn/ui" en CLAUDE.md). El hijo va un escalón abajo del padre:
 * `rounded-md` adentro de `rounded-lg`.
 */
function TabsList({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // La transición se enciende después de la primera medición: si no, el fondo
  // "viajaría" desde la esquina al montar la pantalla.
  const [animate, setAnimate] = React.useState(false);

  // El fondo de la pestaña activa es un solo elemento que se desliza de una a
  // otra, en vez de apagarse en una y encenderse en la siguiente. Se mide la
  // pestaña activa (`data-state="active"`, que es de Radix) cada vez que cambia
  // o que algo cambia de tamaño.
  const measure = React.useCallback(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      '[data-slot="tabs-trigger"][data-state="active"]',
    );
    setBox(
      active
        ? { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight }
        : null,
    );
  }, []);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure();
    const mutations = new MutationObserver(measure);
    mutations.observe(list, {
      attributes: true,
      attributeFilter: ["data-state"],
      childList: true,
      subtree: true,
    });
    // `ResizeObserver` falta en Safari anterior al 13.1: leerlo como identificador suelto
    // tira `ReferenceError` y voltea toda pantalla con tabs. Sin él, el fondo se mide con
    // los cambios de pestaña y al montar, que es lo que importa; sólo no sigue un cambio
    // de tamaño de la ventana.
    const sizes =
      typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(measure) : null;
    if (sizes) {
      sizes.observe(list);
      list.querySelectorAll('[data-slot="tabs-trigger"]').forEach((trigger) => sizes.observe(trigger));
    }
    const timer = window.setTimeout(() => setAnimate(true), 0);
    return () => {
      mutations.disconnect();
      sizes?.disconnect();
      window.clearTimeout(timer);
    };
  }, [measure]);

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      ref={(node) => {
        listRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={cn(
        "bg-card text-muted-foreground shadow-surface relative inline-flex w-fit items-center gap-1 rounded-lg p-1.5",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        data-slot="tabs-indicator"
        className={cn(
          "bg-muted pointer-events-none absolute top-0 left-0 rounded-md",
          animate &&
            "transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
        )}
        style={
          box
            ? { width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }
            : { display: "none" }
        }
      />
      {children}
    </TabsPrimitive.List>
  );
}

/**
 * Siempre lleva ícono: es obligatorio en el tipo. Una pestaña sin él se lee
 * distinto a las demás de la app, y el ícono es lo que se reconoce de un
 * vistazo cuando hay varias.
 */
function TabsTrigger({
  className,
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { icon: LucideIcon }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 data-[state=active]:text-foreground relative inline-flex h-9 flex-1 items-center justify-center gap-2.5 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden />
      {children}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
