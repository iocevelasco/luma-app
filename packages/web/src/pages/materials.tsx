import { useState } from 'react';
import { PlusIcon, ShoppingCartIcon } from 'lucide-react';
import {
  MATERIAL_STATUSES,
  MATERIAL_STATUS_LABELS,
  formatCurrency,
  type MaterialStatus,
} from '@luma/shared';
import { useActivities, useCreateMaterial, useMaterials, useShoppingList } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { useUpdateMaterial } from '@/hooks';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from '@/components/ui';

/**
 * RF-02.
 *
 * Dos vistas: el listado por estado y la lista consolidada de compras. El alta
 * rápida pide sólo nombre y cantidad — el §8 fija el techo en 3 minutos para
 * todo el registro diario, y cada campo obligatorio de más es riesgo de
 * abandono.
 */
export function MaterialsPage() {
  const [filter, setFilter] = useState<MaterialStatus | 'all'>('all');
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: materials, isLoading } = useMaterials(filter === 'all' ? undefined : filter);
  const { data: shoppingList } = useShoppingList();
  const update = useUpdateMaterial();
  const { can } = useAuth();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Materiales</h1>
          <p className="text-sm text-muted-foreground">Faltantes, compras y lo que ya está en obra</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowShoppingList((v) => !v)}>
            <ShoppingCartIcon className="h-4 w-4" aria-hidden />
            Lista de compras
          </Button>
          {can('materials.manage') && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Faltante
            </Button>
          )}
        </div>
      </header>

      {showForm && can('materials.manage') && <QuickAddForm onDone={() => setShowForm(false)} />}

      {showShoppingList && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-3 text-sm font-medium">Lista consolidada</p>
            {!shoppingList || shoppingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay compras pendientes.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {shoppingList.map((row) => (
                  <li key={`${row.name}-${row.unit}`} className="flex justify-between gap-3 py-2">
                    <span>
                      {row.name}
                      {row.requests > 1 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({row.requests} pedidos)
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.quantity} {row.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onSelect={() => setFilter('all')} label="Todos" />
        {MATERIAL_STATUSES.map((status) => (
          <FilterChip
            key={status}
            active={filter === status}
            onSelect={() => setFilter(status)}
            label={MATERIAL_STATUS_LABELS[status]}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : !materials || materials.length === 0 ? (
        <EmptyState
          title="Sin materiales registrados"
          description="Registrá un faltante apenas lo detectes: así el sistema puede avisar qué actividad queda bloqueada."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {materials.map((material) => (
            <li key={material.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{material.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {material.quantity} {material.unit}
                      {material.activity && ` · para ${material.activity}`}
                      {material.estimated_cost > 0 &&
                        ` · ${formatCurrency(material.estimated_cost)}`}
                    </p>
                    {material.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{material.notes}</p>
                    )}
                  </div>

                  {can('materials.manage') ? (
                    <Select
                      aria-label={`Estado de ${material.name}`}
                      className="h-9 w-auto text-xs"
                      value={material.status}
                      disabled={update.isPending}
                      onChange={(e) =>
                        update.mutate({ id: material.id, status: e.target.value })
                      }
                    >
                      {MATERIAL_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {MATERIAL_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone={material.status === 'on_site' ? 'healthy' : 'neutral'}>
                      {MATERIAL_STATUS_LABELS[material.status]}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onSelect,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`h-9 rounded-full border px-3.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border text-muted-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );
}

function QuickAddForm({ onDone }: { onDone: () => void }) {
  const create = useCreateMaterial();
  const { data: activities } = useActivities();
  const [form, setForm] = useState({
    name: '',
    quantity: 1,
    unit: 'un',
    activity_id: '',
    estimated_cost: 0,
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-5">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            create.mutate(
              { ...form, activity_id: form.activity_id || null },
              {
                onSuccess: onDone,
                onError: (err) =>
                  setError(err instanceof Error ? err.message : 'No se pudo registrar'),
              },
            );
          }}
        >
          <div className="sm:col-span-2">
            <Field label="Material">
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Arena"
              />
            </Field>
          </div>
          <Field label="Cantidad">
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Unidad">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {['un', 'm', 'm2', 'm3', 'kg', 'lt', 'bolsa', 'caja', 'global'].map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Actividad que lo necesita" hint="Opcional, pero es lo que dispara la alerta de bloqueo">
            <Select
              value={form.activity_id}
              onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
            >
              <option value="">Sin actividad</option>
              {activities?.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Costo estimado">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={form.estimated_cost}
              onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : 'Registrar'}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
