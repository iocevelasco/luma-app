import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { CrewGoalStatus, CrewGoalWithMember } from '@luma/shared';
import { ChevronLeft, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fromDayKey } from '@/components/common/date-range-filter';
import { CrewRosterDialog } from '@/components/crew/crew-roster-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useCreateCrewGoal,
  useCrewGoals,
  useCrewMembers,
  useDeleteCrewGoal,
  useUpdateCrewGoal,
} from '@/hooks/crew/use-crew-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { currentWeekRange, isSameWeek, shiftWeek, type WeekRange } from '@/lib/week';

const GOAL_STATUSES: CrewGoalStatus[] = ['pendiente', 'cumplida', 'no_cumplida'];

function statusVariant(status: CrewGoalStatus) {
  if (status === 'cumplida') return 'default' as const;
  if (status === 'no_cumplida') return 'destructive' as const;
  return 'secondary' as const;
}

/** Alta rápida: elegir a quién, escribir la meta, y opcionalmente atarla a una actividad. */
function NewGoalForm({ projectId, weekStart }: { projectId: string; weekStart: string }) {
  const { t } = useTranslation();
  const [crewMemberId, setCrewMemberId] = useState('');
  const [description, setDescription] = useState('');
  const [activityId, setActivityId] = useState('');
  const { data: crewData } = useCrewMembers(projectId);
  const { data: activitiesData } = useAllActivities(projectId);
  const createGoal = useCreateCrewGoal(projectId);

  const crewMembers = crewData?.crewMembers ?? [];

  if (crewMembers.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('crew.goals.needRoster')}</p>;
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!crewMemberId || !description.trim()) return;
        createGoal.mutate(
          {
            crewMemberId,
            weekStart,
            description: description.trim(),
            status: 'pendiente',
            ...(activityId ? { activityId } : {}),
          },
          {
            onSuccess: () => {
              setDescription('');
              setActivityId('');
            },
          },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-crew-member">{t('crew.goals.assignee')}</Label>
          <Select value={crewMemberId} onValueChange={setCrewMemberId}>
            <SelectTrigger id="goal-crew-member">
              <SelectValue placeholder={t('crew.goals.assigneePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {crewMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                  {member.kind === 'equipo' ? ` · ${t('crew.kind.equipo')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-activity">{t('crew.goals.activity')}</Label>
          <Select value={activityId} onValueChange={setActivityId}>
            <SelectTrigger id="goal-activity">
              <SelectValue placeholder={t('crew.goals.activityPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {(activitiesData?.activities ?? []).map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>
                  {activity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-description">{t('crew.goals.description')}</Label>
        <Input
          id="goal-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('crew.goals.descriptionPlaceholder')}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={createGoal.isPending}>
          <Plus className="size-4" />
          {t('crew.goals.add')}
        </Button>
      </div>
    </form>
  );
}

function GoalRow({
  projectId,
  goal,
  activityName,
  isEditor,
}: {
  projectId: string;
  goal: CrewGoalWithMember;
  activityName?: string;
  isEditor: boolean;
}) {
  const { t } = useTranslation();
  const updateGoal = useUpdateCrewGoal(projectId);
  const deleteGoal = useDeleteCrewGoal(projectId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{goal.description}</p>
        {activityName && <p className="text-xs text-muted-foreground">{activityName}</p>}
      </div>

      {isEditor ? (
        <div className="flex items-center gap-2">
          <Select
            value={goal.status}
            onValueChange={(status) =>
              updateGoal.mutate({ goalId: goal.id, payload: { status: status as CrewGoalStatus } })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`crew.goalStatus.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => deleteGoal.mutate(goal.id)}
            aria-label={t('crew.goals.delete')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <Badge variant={statusVariant(goal.status)}>{t(`crew.goalStatus.${goal.status}`)}</Badge>
      )}
    </div>
  );
}

/**
 * Metas de la semana, agrupadas por quién las tiene. La semana es la unidad
 * porque es así como el cliente planifica ("una o dos semanas antes"), y
 * porque ya es la unidad de planificación del producto (RF-01).
 */
export function CrewGoalsPanel({
  projectId,
  isEditor,
  isOwner,
}: {
  projectId: string;
  isEditor: boolean;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [week, setWeek] = useState<WeekRange>(() => currentWeekRange());
  const [rosterOpen, setRosterOpen] = useState(false);

  const { data: goalsData } = useCrewGoals(projectId, week.from);
  const { data: activitiesData } = useAllActivities(projectId);

  const activityNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const activity of activitiesData?.activities ?? []) map.set(activity.id, activity.name);
    return map;
  }, [activitiesData]);

  /** Agrupadas por destinatario: la pregunta diaria es "¿qué tiene fulano?". */
  const byMember = useMemo(() => {
    const groups = new Map<string, { name: string; goals: CrewGoalWithMember[] }>();
    for (const goal of goalsData?.goals ?? []) {
      const group = groups.get(goal.crewMemberId) ?? { name: goal.crewMemberName, goals: [] };
      group.goals.push(goal);
      groups.set(goal.crewMemberId, group);
    }
    return [...groups.values()];
  }, [goalsData]);

  const isCurrentWeek = isSameWeek(week, currentWeekRange());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeek((current) => shiftWeek(current, -1))}
            aria-label={t('crew.goals.prevWeek')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm">
            {format(fromDayKey(week.from), 'd MMM', { locale: dateLocale })} —{' '}
            {format(fromDayKey(week.to), 'd MMM', { locale: dateLocale })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeek((current) => shiftWeek(current, 1))}
            aria-label={t('crew.goals.nextWeek')}
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" onClick={() => setWeek(currentWeekRange())}>
              {t('crew.goals.currentWeek')}
            </Button>
          )}
        </div>

        {isEditor && (
          <Button variant="outline" size="sm" onClick={() => setRosterOpen(true)}>
            <Users className="size-4" />
            {t('crew.list.title')}
          </Button>
        )}
      </div>

      {isEditor && <NewGoalForm projectId={projectId} weekStart={week.from} />}

      {byMember.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('crew.goals.empty')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {byMember.map((group) => (
            <div key={group.name} className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">{group.name}</h3>
              {group.goals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  projectId={projectId}
                  goal={goal}
                  activityName={goal.activityId ? activityNameById.get(goal.activityId) : undefined}
                  isEditor={isEditor}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <CrewRosterDialog
        projectId={projectId}
        isOwner={isOwner}
        open={rosterOpen}
        onOpenChange={setRosterOpen}
      />
    </div>
  );
}

export default CrewGoalsPanel;
