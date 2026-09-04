import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PROJECT_ROLES, PROJECT_ROLE_LABELS, inviteMemberSchema } from '@luma/shared';
import { projectsApi } from '@/api';
import { queryKeys } from '@/lib/query-keys';
import { useCurrentProjectId } from '@/stores/session-store';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Spinner,
} from '@/components/ui';

/**
 * Equipo del proyecto.
 *
 * Se puede invitar a más de un cliente sobre el mismo proyecto: la regla 6 lo
 * pide explícitamente, porque el que financia suele decidir acompañado de su
 * pareja o de un asesor de confianza.
 */
export function TeamPage() {
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useQuery({
    queryKey: queryKeys.members(projectId),
    queryFn: projectsApi.members,
    enabled: !!projectId,
  });

  const invite = useMutation({
    mutationFn: projectsApi.invite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(projectId) }),
  });

  const [form, setForm] = useState({ email: '', name: '', role: 'assistant' });
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-sm text-muted-foreground">Quién participa del proyecto y con qué rol</p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);

              const parsed = inviteMemberSchema.safeParse({
                ...form,
                name: form.name || undefined,
              });
              if (!parsed.success) {
                setError(parsed.error.errors[0].message);
                return;
              }

              invite.mutate(parsed.data, {
                onSuccess: () => setForm({ email: '', name: '', role: 'assistant' }),
                onError: (err) =>
                  setError(err instanceof Error ? err.message : 'No pudimos invitar'),
              });
            }}
          >
            <Field label="Email">
              <Input
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Nombre (opcional)">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Rol">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {PROJECT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {PROJECT_ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </Field>

            {error && (
              <p role="alert" className="text-sm text-danger sm:col-span-2">
                {error}
              </p>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? <Spinner /> : 'Invitar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {members?.map((member) => (
            <li key={member.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.user?.name ?? member.user?.email}
                    </p>
                    {member.user?.name && (
                      <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                    )}
                  </div>
                  <Badge tone="outline">{PROJECT_ROLE_LABELS[member.role]}</Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
