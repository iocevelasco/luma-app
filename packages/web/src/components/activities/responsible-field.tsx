import { useMemo } from 'react';
import type { CreateActivityInput } from '@luma/shared';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrewMembers } from '@/hooks/crew/use-crew-queries';
import { useOrganizationMembers } from '@/hooks/organizations/use-organization-queries';
import { useAuth } from '@/providers/auth-provider';

/** El valor "responsable actual" cuando no coincide con ningún empleado de la lista. */
const LEGACY = 'legacy';

/**
 * Elegir quién es el responsable de una actividad entre los empleados de la
 * Empresa, en vez de escribir un nombre.
 *
 * Un nombre escrito a mano se desalinea solo —"Hernán", "Hernán D.", "hernan
 * duarte"— y deja de servir para saber qué tiene a cargo cada persona. Con
 * una lista se elige siempre al mismo.
 *
 * Salen de los dos grupos de Empleados: el personal de obra disponible para
 * esta obra y el administrativo. Quien está logueado va aparte porque el
 * dueño no figura entre los integrantes de su propia Empresa y muchas veces
 * es quien está a cargo.
 *
 * El responsable de una actividad vieja puede ser un nombre que ya no está en
 * ninguna lista: se conserva como opción para no perderlo al abrir el
 * formulario.
 */
export function ResponsibleField({
  control,
  projectId,
  id,
  hasError,
}: {
  control: Control<CreateActivityInput>;
  projectId: string;
  id: string;
  hasError: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: crewData } = useCrewMembers(projectId);
  const { data: staffData } = useOrganizationMembers();

  const crew = useMemo(
    // Los equipos (una hormigonera) no responden por una actividad.
    () => (crewData?.crewMembers ?? []).filter((m) => m.active && m.kind === 'persona'),
    [crewData],
  );
  const staff = useMemo(() => staffData?.members ?? [], [staffData]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t('activity.fields.responsible')}</Label>
      <Controller
        control={control}
        name="responsible"
        render={({ field }) => {
          const current = field.value;

          // Qué opción corresponde al valor guardado, para que el selector no
          // arranque vacío en una actividad que ya tiene responsable.
          let selected = '';
          if (current?.user && user && current.user === user.id) selected = `me:${user.id}`;
          else if (current?.user && staff.some((s) => s.userId === current.user)) {
            selected = `staff:${current.user}`;
          } else if (current?.name) {
            const crewMatch = crew.find((m) => m.name === current.name);
            selected = crewMatch ? `crew:${crewMatch.id}` : LEGACY;
          }

          return (
            <Select
              value={selected}
              onValueChange={(key) => {
                if (key === LEGACY) return;
                const [source, ref] = key.split(':') as [string, string];
                if (source === 'me' && user) field.onChange({ name: user.name, user: user.id });
                else if (source === 'staff') {
                  const member = staff.find((s) => s.userId === ref);
                  if (member) field.onChange({ name: member.name, user: member.userId });
                } else if (source === 'crew') {
                  const member = crew.find((m) => m.id === ref);
                  if (member) field.onChange({ name: member.name });
                }
              }}
            >
              <SelectTrigger id={id} aria-invalid={hasError}>
                <SelectValue placeholder={t('activity.fields.responsiblePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {selected === LEGACY && current?.name && (
                  <SelectItem value={LEGACY}>{current.name}</SelectItem>
                )}
                {user && (
                  <SelectItem value={`me:${user.id}`}>
                    {t('activity.fields.responsibleMe', { name: user.name })}
                  </SelectItem>
                )}
                {crew.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t('team.groupCrew')}</SelectLabel>
                    {crew.map((member) => (
                      <SelectItem key={member.id} value={`crew:${member.id}`}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {staff.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t('team.groupStaff')}</SelectLabel>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={`staff:${member.userId}`}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          );
        }}
      />
      {hasError && (
        <p className="text-sm text-destructive">{t('activity.fields.responsibleRequired')}</p>
      )}
      {crew.length === 0 && staff.length === 0 && (
        <p className="text-2xs text-muted-foreground">{t('activity.fields.responsibleEmpty')}</p>
      )}
    </div>
  );
}
