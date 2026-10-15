import { useState } from 'react';
import type { OrganizationCrewMember } from '@luma/shared';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CrewDrawer } from '@/components/crew/crew-drawer';
import { CrewList } from '@/components/crew/crew-list';
import { PageLayout } from '@/components/layout/page-layout';
import { InviteMemberDialog, StaffList } from '@/components/organization/organization-panel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useOrganizationCrew,
  useOrganizationMembers,
} from '@/hooks/organizations/use-organization-queries';

type TeamTab = 'crew' | 'staff';

/**
 * Todos los empleados de la Empresa en una sola vista, separados en dos
 * pestañas: el personal de obra —sea cual sea el rubro— y el administrativo.
 *
 * Son empleados los dos; lo que cambia es lo que la app hace con cada uno. El
 * administrativo tiene cuenta y se le da acceso a obras; el de obra tiene
 * especialidad y se asigna a actividades. Por eso son dos listas y no una
 * mezclada: el alta, las acciones y los datos son distintos.
 *
 * Obra va primero y es la pestaña por defecto: es la mayoría de la gente y la
 * lista que más se mueve (altas, bajas, asignaciones). El botón de sumar es
 * uno solo, arriba a la derecha, y suma lo que muestra la pestaña abierta.
 */
export function TeamDirectory() {
  const { t } = useTranslation();
  const { data: staffData } = useOrganizationMembers();
  const { data: crewData } = useOrganizationCrew();

  const [tab, setTab] = useState<TeamTab>('crew');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [crewDrawerOpen, setCrewDrawerOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<OrganizationCrewMember | null>(null);

  const staffCount = staffData?.members.length ?? 0;
  const crewCount = crewData?.crewMembers.length ?? 0;

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as TeamTab)}>
    <PageLayout
      toolbar={
        <TabsList>
          <TabsTrigger value="crew">
            {t('team.groupCrew')} ({crewCount})
          </TabsTrigger>
          <TabsTrigger value="staff">
            {t('team.groupStaff')} ({staffCount})
          </TabsTrigger>
        </TabsList>
      }
      action={
        <Button
          onClick={() => {
            if (tab === 'crew') {
              setEditingCrew(null);
              setCrewDrawerOpen(true);
            } else {
              setInviteOpen(true);
            }
          }}
        >
          <Plus className="size-4" />
          {tab === 'crew' ? t('team.addCrew') : t('team.addStaff')}
        </Button>
      }
    >
        <TabsContent
          value="crew"
          className="rounded-lg border border-border bg-card p-4 shadow-surface"
        >
          <CrewList
            onEdit={(member) => {
              setEditingCrew(member);
              setCrewDrawerOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent
          value="staff"
          className="rounded-lg border border-border bg-card p-4 shadow-surface"
        >
          <StaffList />
        </TabsContent>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <CrewDrawer
        member={editingCrew}
        open={crewDrawerOpen}
        onOpenChange={(open) => {
          setCrewDrawerOpen(open);
          if (!open) setEditingCrew(null);
        }}
      />
    </PageLayout>
    </Tabs>
  );
}
