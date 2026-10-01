import { useMemo, useState } from 'react';
import type { Activity, ActivityAttendance as Attendance, ActivityCrewMember } from '@luma/shared';
import { Check, Phone, Plus, UserMinus, UserPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrewMembers } from '@/hooks/crew/use-crew-queries';
import {
  useAssignCrewToActivity,
  useUnassignCrewFromActivity,
  useUpsertLaborRecord,
} from '@/hooks/labor/use-labor-queries';
import { iconForSpecialty } from '@/lib/specialty-icons';
import { cn } from '@/lib/utils';

/**
 * Asistencia de una actividad: se tilda contra la cuadrilla asignada, no se
 * tipean nombres.
 *
 * Es el patrón de Procore y Raken —el capataz confirma contra una lista
 * conocida—, y es lo que hace posible todo lo demás: si el sistema sabe
 * QUIÉNES se esperan, puede decir quién faltó, mostrar su teléfono para
 * llamarlo, y registrar a quien lo cubrió. Con un número y nombres sueltos
 * sólo se podía decir "falta uno".
 */
export function ActivityAttendance({
  projectId,
  activity,
  attendance,
  date,
  isEditor,
}: {
  projectId: string;
  activity: Activity;
  /** Esperados y presentes del día, ya resueltos por la API. */
  attendance: Attendance | undefined;
  date: string;
  isEditor: boolean;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [coverFor, setCoverFor] = useState<string | null>(null);

  const { data: rosterData } = useCrewMembers(isEditor ? projectId : undefined);
  const upsert = useUpsertLaborRecord(projectId);
  const assignCrew = useAssignCrewToActivity(projectId, activity.id);
  const unassignCrew = useUnassignCrewFromActivity(projectId, activity.id);

  const expected = useMemo(() => attendance?.expected ?? [], [attendance]);
  const presentIds = useMemo(
    () => new Set(attendance?.presentCrewMemberIds ?? []),
    [attendance],
  );

  const expectedIds = useMemo(
    () => new Set(expected.map((member) => member.crewMemberId)),
    [expected],
  );

  /** Presentes que no estaban asignados: alguien cubrió. */
  const replacements = useMemo(() => {
    const roster = rosterData?.crewMembers ?? [];
    return [...presentIds]
      .filter((id) => !expectedIds.has(id))
      .map((id) => roster.find((member) => member.id === id))
      .filter((member): member is NonNullable<typeof member> => Boolean(member));
  }, [presentIds, expectedIds, rosterData]);

  const missing = expected.filter((member) => !presentIds.has(member.crewMemberId));

  // Los partes viejos no tienen gente del roster: su cuenta sale de los
  // nombres tipeados, igual que el resumen de arriba. Si no, un día ya
  // cargado se mostraría en 0 y parecería que no fue nadie.
  const legacyNames = attendance?.legacyPresentNames ?? [];
  const usesLegacy = expected.length === 0 && legacyNames.length > 0;
  const presentCount = usesLegacy ? legacyNames.length : presentIds.size;
  const expectedCount = usesLegacy
    ? (attendance?.legacyExpectedCount ?? 0)
    : expected.length;

  /** Quien no está asignado acá ni ya marcado presente, puede cubrir. */
  const availableToCover = (rosterData?.crewMembers ?? []).filter(
    (member) => !expectedIds.has(member.id) && !presentIds.has(member.id),
  );

  function togglePresent(crewMemberId: string) {
    const next = new Set(presentIds);
    if (next.has(crewMemberId)) next.delete(crewMemberId);
    else next.add(crewMemberId);
    upsert.mutate({ activityId: activity.id, date, presentCrewMemberIds: [...next] });
  }

  function addCover(crewMemberId: string) {
    upsert.mutate({
      activityId: activity.id,
      date,
      presentCrewMemberIds: [...presentIds, crewMemberId],
    });
    setCoverFor(null);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{activity.name}</h3>
          <p className="text-sm text-muted-foreground">{activity.area}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg tabular-nums">
            <span
              className={cn(
                'font-semibold',
                presentCount < expectedCount ? 'text-destructive' : 'text-foreground',
              )}
            >
              {presentCount}
            </span>
            <span className="text-muted-foreground"> / {expectedCount}</span>
          </span>
          {missing.length > 0 && (
            <Badge variant="destructive">{t('labor.deficit', { count: missing.length })}</Badge>
          )}
        </div>
      </header>

      {usesLegacy ? (
        // Sólo lectura: así quedó cargado antes de que existiera el roster.
        <div className="flex flex-col gap-1">
          <p className="text-2xs text-muted-foreground">{t('labor.legacyNotice')}</p>
          <p className="text-sm">{legacyNames.join(', ')}</p>
        </div>
      ) : expected.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('labor.crew.empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {expected.map((member) => (
            <CrewRow
              key={member.crewMemberId}
              member={member}
              present={presentIds.has(member.crewMemberId)}
              isEditor={isEditor}
              onToggle={() => togglePresent(member.crewMemberId)}
              onRemove={() => unassignCrew.mutate(member.crewMemberId)}
              onCover={() => setCoverFor(member.crewMemberId)}
              covering={coverFor === member.crewMemberId}
              availableToCover={availableToCover}
              onPickCover={addCover}
              onCancelCover={() => setCoverFor(null)}
            />
          ))}
        </ul>
      )}

      {replacements.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="text-2xs text-muted-foreground">{t('labor.crew.covering')}</p>
          <ul className="flex flex-col">
            {replacements.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <UserPlus className="size-4 text-muted-foreground" />
                  {member.name}
                </span>
                {isEditor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => togglePresent(member.id)}
                    aria-label={t('labor.crew.removeCover')}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEditor && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {adding ? (
            <>
              <Select
                onValueChange={(crewMemberId) => {
                  assignCrew.mutate(crewMemberId);
                  setAdding(false);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder={t('labor.crew.pickPerson')} />
                </SelectTrigger>
                <SelectContent>
                  {(rosterData?.crewMembers ?? [])
                    .filter((member) => !expectedIds.has(member.id))
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              {t('labor.crew.assign')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** Una persona de la cuadrilla: presente/ausente, su teléfono y su reemplazo. */
function CrewRow({
  member,
  present,
  isEditor,
  onToggle,
  onRemove,
  onCover,
  covering,
  availableToCover,
  onPickCover,
  onCancelCover,
}: {
  member: ActivityCrewMember;
  present: boolean;
  isEditor: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onCover: () => void;
  covering: boolean;
  availableToCover: { id: string; name: string }[];
  onPickCover: (crewMemberId: string) => void;
  onCancelCover: () => void;
}) {
  const { t } = useTranslation();
  const SpecialtyIcon = iconForSpecialty(member.specialty as never);

  return (
    <li className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!isEditor}
          onClick={onToggle}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left',
            isEditor && 'hover:bg-accent',
          )}
          aria-pressed={present}
        >
          {/*
            El estado es el elemento táctil: tocar la fila entera marca
            presente. En obra se opera con el pulgar y a veces con guante, así
            que el target es la fila, no una casilla de 16px.
          */}
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border',
              present
                ? 'border-success bg-success text-success-foreground'
                : 'border-border text-muted-foreground',
            )}
          >
            {present ? <Check className="size-4" /> : <X className="size-4" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className={cn('truncate', !present && 'text-muted-foreground')}>
                {member.name}
              </span>
              {member.isLead && (
                <Badge variant="secondary" className="shrink-0">
                  {t('crew.list.lead')}
                </Badge>
              )}
            </span>
            {member.specialty && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <SpecialtyIcon className="size-3" />
                {t(`provider.specialty.${member.specialty}`)}
              </span>
            )}
          </span>
        </button>

        {/* Las acciones del ausente: llamarlo o cubrirlo. Es el motivo de ser
            de esta pantalla — antes el que faltaba no existía en los datos. */}
        {!present && isEditor && (
          <div className="flex shrink-0 items-center gap-1">
            {member.phone && (
              <Button type="button" variant="outline" size="icon-sm" asChild>
                <a href={`tel:${member.phone}`} aria-label={t('labor.crew.call')}>
                  <Phone className="size-4" />
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCover}
              disabled={availableToCover.length === 0}
            >
              <UserPlus className="size-4" />
              {t('labor.crew.cover')}
            </Button>
          </div>
        )}

        {isEditor && present && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={t('labor.crew.unassign')}
          >
            <UserMinus className="size-4" />
          </Button>
        )}
      </div>

      {covering && (
        <div className="flex flex-wrap items-center gap-2 pl-10">
          <Select onValueChange={onPickCover}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('labor.crew.pickCover')} />
            </SelectTrigger>
            <SelectContent>
              {availableToCover.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="sm" onClick={onCancelCover}>
            {t('common.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}

export default ActivityAttendance;
