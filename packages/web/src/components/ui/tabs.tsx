"use client";

import * as React from "react";
import { Tabs as HeroTabs } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ADR-003, lote B. Tabs de HeroUI (React Aria) con la API de siempre —`value`,
// `defaultValue`, `onValueChange(string)`, `TabsTrigger value`, `TabsContent
// value`, `icon`— traducida a `selectedKey`/`onSelectionChange`/`id`. El fondo
// que se desliza ahora es el `Tabs.Indicator` de HeroUI: se acabó el
// MutationObserver/ResizeObserver que lo medía a mano.
//
// Qué cambia para quien lo usa:
//   · `TabsContent forceMount` ya no existe (sólo se monta el panel activo);
//   · `data-state="active"` pasa a `data-selected` (y `aria-selected`, igual);
//   · `TabsTrigger disabled` es `isDisabled`: el adaptador traduce `disabled`.

type TabsProps = Omit<
  React.ComponentProps<typeof HeroTabs>,
  "selectedKey" | "defaultSelectedKey" | "onSelectionChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

function Tabs({ className, value, defaultValue, onValueChange, ...props }: TabsProps) {
  return (
    <HeroTabs
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={onValueChange ? (key) => onValueChange(String(key)) : undefined}
      {...props}
    />
  );
}

/**
 * Los tabs de la app: un contenedor blanco y suave, y cada pestaña un cuadrado
 * de esquinas redondeadas (no una píldora) con su ícono. La activa se marca con
 * un gris apenas más oscuro que el lienzo. El hijo va un escalón abajo del
 * padre: `rounded-md` adentro de `rounded-lg`.
 */
function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof HeroTabs.List>) {
  return (
    <HeroTabs.ListContainer
      data-slot="tabs-list"
      className="bg-card shadow-surface relative w-fit rounded-lg p-1.5"
    >
      <HeroTabs.List
        className={cn("text-muted-foreground inline-flex w-fit items-center gap-1 bg-transparent p-0", className)}
        {...props}
      >
        {children}
      </HeroTabs.List>
    </HeroTabs.ListContainer>
  );
}

/**
 * Siempre lleva ícono: es obligatorio en el tipo. Una pestaña sin él se lee
 * distinto a las demás de la app.
 */
function TabsTrigger({
  className,
  icon: Icon,
  children,
  value,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof HeroTabs.Tab>, "id" | "children"> & {
  children?: React.ReactNode;
  icon: LucideIcon;
  value: string;
  disabled?: boolean;
}) {
  return (
    <HeroTabs.Tab
      data-slot="tabs-trigger"
      id={value}
      isDisabled={disabled}
      className={cn(
        "text-muted-foreground hover:text-foreground data-[selected=true]:text-foreground relative inline-flex h-9 flex-1 items-center justify-center gap-2.5 rounded-md px-4 text-sm font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
        className as string,
      )}
      {...props}
    >
      <Icon aria-hidden />
      {children}
      <HeroTabs.Indicator className="bg-secondary rounded-md" />
    </HeroTabs.Tab>
  );
}

function TabsContent({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<typeof HeroTabs.Panel>, "id"> & { value: string }) {
  return (
    <HeroTabs.Panel
      data-slot="tabs-content"
      id={value}
      className={cn("flex-1 outline-none", className as string)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
