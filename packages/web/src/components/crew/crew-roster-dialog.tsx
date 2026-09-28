import { useState } from 'react';
import type { CrewMemberKind, ProviderSpecialty } from '@luma/shared';
import { Plus, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateCrewMember,
  useCrewMembers,
  useDeactivateCrewMember,
} from '@/hooks/crew/use-crew-queries';

/** Mismo catálogo que proveedores — un test en `@luma/shared` los mantiene alineados. */
const CREW_SPECIALTIES: ProviderSpecialty[] = [
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'cristaleria',
  'albanileria',
  'herreria',
  'redes',
  'mecanicas',
  'estructura',
  'acabados',
  'pintura',
  'climatizacion',
  'techos',
  'pisos_revestimientos',
  'jardineria',
  'demolicion',
  'otra',
];

const CREW_KINDS: CrewMemberKind[] = ['persona', 'equipo'];

/**
 * Personal fijo de obra: el que está toda la ejecución, a diferencia del
 * proveedor que entra y sale. Lo administra el dueño; el Asistente lo ve para
 * poder asignarle metas.
 */
export function CrewRosterDialog({
  projectId,
  isOwner,
  open,
  onOpenChange,
}: {
  projectId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CrewMemberKind>('persona');
  const [specialty, setSpecialty] = useState<string>('');
  const [isLead, setIsLead] = useState(false);
  const [onlyThisProject, setOnlyThisProject] = useState(false);

  const { data } = useCrewMembers(open ? projectId : undefined);
  const createMember = useCreateCrewMember(projectId);
  const deactivateMember = useDeactivateCrewMember(projectId);

  const crewMembers = data?.crewMembers ?? [];

  function resetForm() {
    setName('');
    setKind('persona');
    setSpecialty('');
    setIsLead(false);
    setOnlyThisProject(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('crew.list.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {crewMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('crew.list.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {crewMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{member.name}</span>
                      {member.kind === 'equipo' && (
                        <Badge variant="secondary">{t('crew.kind.equipo')}</Badge>
                      )}
                      {member.isLead && <Badge>{t('crew.list.lead')}</Badge>}
                    </div>
                    {member.specialty && (
                      <p className="text-xs text-muted-foreground">
                        {t(`provider.specialty.${member.specialty}`)}
                      </p>
                    )}
                  </div>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => deactivateMember.mutate(member.id)}
                      aria-label={t('crew.list.deactivate')}
                    >
                      <UserX className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isOwner && (
            <form
              className="flex flex-col gap-3 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) return;
                createMember.mutate(
                  {
                    name: name.trim(),
                    kind,
                    isLead,
                    scope: onlyThisProject ? 'project' : 'organization',
                    ...(specialty ? { specialty: specialty as ProviderSpecialty } : {}),
                  },
                  { onSuccess: resetForm },
                );
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="crew-name">{t('crew.fields.name')}</Label>
                <Input
                  id="crew-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="crew-kind">{t('crew.fields.kind')}</Label>
                  <Select value={kind} onValueChange={(value) => setKind(value as CrewMemberKind)}>
                    <SelectTrigger id="crew-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREW_KINDS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`crew.kind.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="crew-specialty">{t('crew.fields.specialty')}</Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger id="crew-specialty">
                      <SelectValue placeholder={t('crew.fields.specialtyPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CREW_SPECIALTIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`provider.specialty.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isLead} onCheckedChange={(next) => setIsLead(next === true)} />
                {t('crew.fields.isLead')}
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={onlyThisProject}
                  onCheckedChange={(next) => setOnlyThisProject(next === true)}
                />
                {t('crew.fields.onlyThisProject')}
              </label>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={createMember.isPending}>
                  <Plus className="size-4" />
                  {t('crew.list.add')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CrewRosterDialog;
